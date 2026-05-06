/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, Match, AppState } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'acerank_data';

export const StorageService = {
  // --- LOCAL FALLBACK ---
  getLocal(): AppState {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { players: [], matches: [] };
    try {
      return JSON.parse(data);
    } catch {
      return { players: [], matches: [] };
    }
  },

  saveLocal(state: AppState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  // --- SUPABASE SYNC ---
  async fetchFromSupabase(): Promise<AppState | null> {
    const hasSupabase = this.hasConfig();

    if (!hasSupabase) {
      console.log('Supabase não configurado ou com valores padrão.');
      return null;
    }

    console.log('Sincronizando dados com Supabase...');
    try {
      const { data: playersData, error: pError } = await supabase
        .from('players')
        .select('*');
      
      const { data: matchesData, error: mError } = await supabase
        .from('matches')
        .select('*');

      if (pError || mError) {
        console.error('Erro na busca do Supabase:', pError || mError);
        return null;
      }

      const players: Player[] = (playersData || []).map(p => ({
        id: p.id,
        name: p.name,
        username: p.username,
        avatar: p.avatar,
        password: p.password,
        matchesPlayed: p.matches_played,
        wins: p.wins,
        losses: p.losses,
        points: p.points,
        lastActive: p.last_active,
        role: p.role
      }));

      const matches: Match[] = (matchesData || []).map(m => ({
        id: m.id,
        date: m.date,
        player1Id: m.player_1_id,
        player2Id: m.player_2_id,
        player1Name: m.player_1_name,
        player2Name: m.player_2_name,
        winnerId: m.winner_id,
        sets: m.sets,
        type: m.type as 'competitive' | 'friendly',
        status: (m.status || 'approved') as 'pending' | 'approved' | 'rejected',
        reportedBy: m.reported_by
      }));

      return { players, matches };
    } catch (e) {
      console.error('Conexão com Supabase falhou:', e);
      return null;
    }
  },

  hasConfig(): boolean {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!url && !!key && 
           url !== 'YOUR_SUPABASE_URL' && 
           url !== 'MY_SUPABASE_URL' && 
           url.includes('supabase.co');
  },

  generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  async addPlayer(name: string, username: string, password?: string, avatar?: string): Promise<{ success: boolean; error?: string; player?: Player }> {
    const id = this.generateUUID();
    
    const newPlayer: Player = {
      id,
      name,
      username: username.toLowerCase().replace(/\s/g, ''),
      avatar,
      password,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      points: 0,
      lastActive: new Date().toISOString(),
    };

    if (this.hasConfig()) {
      console.log('Tentando salvar no Supabase...');
      try {
        const payload = {
          id: newPlayer.id,
          name: newPlayer.name,
          username: newPlayer.username,
          avatar: newPlayer.avatar,
          password: newPlayer.password,
          matches_played: newPlayer.matchesPlayed,
          wins: newPlayer.wins,
          losses: newPlayer.losses,
          points: newPlayer.points,
          last_active: newPlayer.lastActive
        };
        
        const { error } = await supabase.from('players').insert([payload]);
        
        if (error) {
          console.error('Erro detalhado do Supabase:', error);
          if (error.code === '23505') return { success: false, error: 'Este username já existe.' };
          return { success: false, error: `Erro no Banco de Dados: ${error.message}` };
        }
        console.log('Jogador salvo com sucesso no Supabase');
      } catch (e) {
        console.error('Exceção ao acessar Supabase:', e);
        return { success: false, error: 'Falha crítica na conexão com Supabase.' };
      }
    }

    // Backup local sempre
    const state = this.getLocal();
    state.players.push(newPlayer);
    this.saveLocal(state);
    
    return { success: true, player: newPlayer };
  },

  async addMatch(matchData: Omit<Match, 'id' | 'player1Name' | 'player2Name' | 'status' | 'reportedBy'>): Promise<{ success: boolean; error?: string; match?: Match }> {
    const state = this.getLocal();
    const p1 = state.players.find(p => p.id === matchData.player1Id);
    const p2 = state.players.find(p => p.id === matchData.player2Id);

    if (!p1 || !p2) return { success: false, error: 'Jogador não encontrado' };

    const id = this.generateUUID();

    const match: Match = {
      ...matchData,
      id,
      player1Name: p1.name,
      player2Name: p2.name,
      status: 'approved'
    };

    // Update stats logic
    p1.matchesPlayed++;
    p2.matchesPlayed++;
    p1.lastActive = match.date;
    p2.lastActive = match.date;

    if (match.winnerId === p1.id) {
      p1.wins++;
      p1.points += 10;
      p2.losses++;
    } else {
      p2.wins++;
      p2.points += 10;
      p1.losses++;
    }

    if (this.hasConfig()) {
      console.log('Tentando registrar partida no Supabase...');
      try {
        // Create match
        const { error: mErr } = await supabase.from('matches').insert([{
          id: match.id,
          date: match.date,
          player_1_id: match.player1Id,
          player_2_id: match.player2Id,
          player_1_name: match.player1Name,
          player_2_name: match.player2Name,
          winner_id: match.winnerId,
          sets: match.sets,
          type: match.type,
          status: match.status
        }]);

        // Update players
        const { error: p1Err } = await supabase.from('players').update({
          matches_played: p1.matchesPlayed,
          wins: p1.wins,
          losses: p1.losses,
          points: p1.points,
          last_active: p1.lastActive
        }).eq('id', p1.id);

        const { error: p2Err } = await supabase.from('players').update({
          matches_played: p2.matchesPlayed,
          wins: p2.wins,
          losses: p2.losses,
          points: p2.points,
          last_active: p2.lastActive
        }).eq('id', p2.id);

        if (mErr || p1Err || p2Err) {
          console.error('Supabase addMatch error', { mErr, p1Err, p2Err });
          return { success: false, error: 'Erro ao sincronizar partida com Supabase.' };
        }
        console.log('Partida registrada com sucesso no Supabase');
      } catch (e) {
        console.error('Supabase connection error:', e);
        return { success: false, error: 'Falha na conexão com o banco de dados.' };
      }
    }

    state.matches.push(match);
    this.saveLocal(state);
    return { success: true, match };
  },

  async reportMatch(matchData: Omit<Match, 'id' | 'player1Name' | 'player2Name' | 'status'>, reporterId: string): Promise<{ success: boolean; error?: string; match?: Match }> {
    const state = this.getLocal();
    const p1 = state.players.find(p => p.id === matchData.player1Id);
    const p2 = state.players.find(p => p.id === matchData.player2Id);

    if (!p1 || !p2) return { success: false, error: 'Jogador não encontrado' };

    const id = this.generateUUID();

    const match: Match = {
      ...matchData,
      id,
      player1Name: p1.name,
      player2Name: p2.name,
      status: 'pending',
      reportedBy: reporterId
    };

    if (this.hasConfig()) {
      try {
        const { error } = await supabase.from('matches').insert([{
          id: match.id,
          date: match.date,
          player_1_id: match.player1Id,
          player_2_id: match.player2Id,
          player_1_name: match.player1Name,
          player_2_name: match.player2Name,
          winner_id: match.winnerId,
          sets: match.sets,
          type: match.type,
          status: match.status,
          reported_by: match.reportedBy
        }]);

        if (error) return { success: false, error: error.message };
      } catch (e) {
        return { success: false, error: 'Falha na conexão com Supabase.' };
      }
    }

    state.matches.push(match);
    this.saveLocal(state);
    return { success: true, match };
  },

  async approveMatch(matchId: string): Promise<{ success: boolean; error?: string }> {
    const state = this.getLocal();
    const match = state.matches.find(m => m.id === matchId);
    if (!match || match.status !== 'pending') return { success: false, error: 'Partida não encontrada ou já processada' };

    const p1 = state.players.find(p => p.id === match.player1Id);
    const p2 = state.players.find(p => p.id === match.player2Id);

    if (!p1 || !p2) return { success: false, error: 'Jogadores não encontrados' };

    // Update stats
    match.status = 'approved';
    p1.matchesPlayed++;
    p2.matchesPlayed++;
    p1.lastActive = new Date().toISOString();
    p2.lastActive = new Date().toISOString();

    if (match.winnerId === p1.id) {
      p1.wins++;
      p1.points += 10;
      p2.losses++;
    } else {
      p2.wins++;
      p2.points += 10;
      p1.losses++;
    }

    if (this.hasConfig()) {
      try {
        const { error: mErr } = await supabase.from('matches').update({ status: 'approved' }).eq('id', matchId);
        
        const { error: p1Err } = await supabase.from('players').update({
          matches_played: p1.matchesPlayed,
          wins: p1.wins,
          losses: p1.losses,
          points: p1.points,
          last_active: p1.lastActive
        }).eq('id', p1.id);

        const { error: p2Err } = await supabase.from('players').update({
          matches_played: p2.matchesPlayed,
          wins: p2.wins,
          losses: p2.losses,
          points: p2.points,
          last_active: p2.lastActive
        }).eq('id', p2.id);

        if (mErr || p1Err || p2Err) return { success: false, error: 'Erro ao sincronizar com Supabase' };
      } catch (e) {
        return { success: false, error: 'Conexão falhou' };
      }
    }

    this.saveLocal(state);
    return { success: true };
  },

  async rejectMatch(matchId: string): Promise<{ success: boolean; error?: string }> {
    const state = this.getLocal();
    const matchIndex = state.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return { success: false, error: 'Partida não encontrada' };

    if (this.hasConfig()) {
      try {
        const { error } = await supabase.from('matches').delete().eq('id', matchId);
        if (error) return { success: false, error: error.message };
      } catch (e) {
        return { success: false, error: 'Conexão falhou' };
      }
    }

    state.matches.splice(matchIndex, 1);
    this.saveLocal(state);
    return { success: true };
  },

  async resetPlayerStats(playerName: string): Promise<{ success: boolean; error?: string }> {
    const state = this.getLocal();
    const player = state.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    
    if (!player) return { success: false, error: 'Jogador não encontrado' };

    player.matchesPlayed = 0;
    player.wins = 0;
    player.losses = 0;
    player.points = 0;

    if (this.hasConfig()) {
      try {
        const { error } = await supabase.from('players').update({
          matches_played: 0,
          wins: 0,
          losses: 0,
          points: 0
        }).eq('id', player.id);

        if (error) return { success: false, error: error.message };
      } catch (e) {
        return { success: false, error: 'Falha na conexão com Supabase' };
      }
    }

    this.saveLocal(state);
    return { success: true };
  },

  async updatePlayer(playerId: string, updates: Partial<Pick<Player, 'name' | 'username' | 'avatar' | 'password'>>): Promise<{ success: boolean; error?: string }> {
    const state = this.getLocal();
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) return { success: false, error: 'Jogador não encontrado' };

    const player = state.players[playerIndex];
    const updatedPlayer = { ...player, ...updates };

    if (this.hasConfig()) {
      try {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.username !== undefined) payload.username = updates.username;
        if (updates.avatar !== undefined) payload.avatar = updates.avatar;
        if (updates.password !== undefined) payload.password = updates.password;

        const { error } = await supabase.from('players').update(payload).eq('id', playerId);

        if (error) {
          if (error.code === '23505') return { success: false, error: 'Este username já existe.' };
          return { success: false, error: error.message };
        }
      } catch (e) {
        return { success: false, error: 'Falha na conexão com Supabase' };
      }
    }

    state.players[playerIndex] = updatedPlayer;
    this.saveLocal(state);
    return { success: true };
  },

  getH2H(player1Id: string, player2Id: string, state: AppState) {
    const matches = state.matches.filter(m => 
      (m.player1Id === player1Id && m.player2Id === player2Id) ||
      (m.player1Id === player2Id && m.player2Id === player1Id)
    );

    const p1Wins = matches.filter(m => m.winnerId === player1Id).length;
    const p2Wins = matches.filter(m => m.winnerId === player2Id).length;

    return {
      matches,
      p1Wins,
      p2Wins,
      total: matches.length
    };
  },

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
};
