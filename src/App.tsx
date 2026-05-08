/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent, ChangeEvent, ReactNode, FC } from 'react';
import { 
  Trophy, 
  History, 
  Users, 
  PlusCircle, 
  BarChart3, 
  LogOut, 
  TrendingUp, 
  Calendar,
  Sword,
  Search,
  User as UserIcon,
  ChevronRight,
  RotateCcw,
  Pencil,
  X,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StorageService } from './lib/storage.ts';
import { exportRankingToPDF } from './lib/pdf.ts';
import { Player, Match, AppState } from './types';

type View = 'dashboard' | 'ranking' | 'history' | 'players' | 'h2h' | 'add-match' | 'reports';

export default function App() {
  const [state, setState] = useState<AppState>({ players: [], matches: [] });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string, name: string, role: 'admin' | 'player' } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Form states
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerAvatar, setNewPlayerAvatar] = useState<string | undefined>(undefined);
  const [newPlayerUsername, setNewPlayerUsername] = useState('');
  const [newPlayerPassword, setNewPlayerPassword] = useState('');
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');
  const [winner, setWinner] = useState('');
  const [matchSets, setMatchSets] = useState([{ p1: 0, p2: 0 }]);

  // Editing states
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | undefined>(undefined);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Stats
  const topPlayers = useMemo(() => {
    return [...state.players]
      .filter(p => p.role !== 'admin')
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [state.players]);

  const recentMatches = useMemo(() => {
    return state.matches
      .filter(m => m.status === 'approved')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [state.matches]);

  const pendingMatches = useMemo(() => {
    return state.matches.filter(m => m.status === 'pending');
  }, [state.matches]);

  useEffect(() => {
    async function loadData() {
      // 1. Load from Supabase if possible
      const supabaseData = await StorageService.fetchFromSupabase();
      if (supabaseData) {
        setState(supabaseData);
        StorageService.saveLocal(supabaseData); // Keep local in sync

        // One-time fix for Ricci stats
        const hasReset = localStorage.getItem('ricci_stats_reset_v1');
        const ricci = supabaseData.players.find(p => p.name.toLowerCase() === 'ricci');
        if (!hasReset && ricci && (ricci.points > 0 || ricci.matchesPlayed > 0)) {
          console.log('Executando reset de pontos para Ricci...');
          await StorageService.resetPlayerStats('Ricci');
          localStorage.setItem('ricci_stats_reset_v1', 'true');
          const refreshed = await StorageService.fetchFromSupabase();
          if (refreshed) setState(refreshed);
        }
      } else {
        // 2. Fallback to local
        setState(StorageService.getLocal());
      }
      setLoading(false);
    }
    loadData();

    const savedSession = localStorage.getItem('acerank_session');
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        setIsLoggedIn(true);
        setCurrentUser(user);
      } catch {
        localStorage.removeItem('acerank_session');
      }
    }
  }, []);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    
    // Check Admin
    if (username === 'admin') {
      const user = { id: 'admin', name: 'Administrador', role: 'admin' as const };
      setIsLoggedIn(true);
      setCurrentUser(user);
      localStorage.setItem('acerank_session', JSON.stringify(user));
      setLoginError('');
      return;
    }

    // Check Players
    const player = state.players.find(p => p.username === username.toLowerCase() && p.password === password);
    if (player) {
      const user = { id: player.id, name: player.name, role: 'player' as const };
      setIsLoggedIn(true);
      setCurrentUser(user);
      localStorage.setItem('acerank_session', JSON.stringify(user));
      setLoginError('');
    } else {
      setLoginError('Usuário ou senha incorretos.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('acerank_session');
  };

  const handleResetDatabase = async () => {
    if (!isResetConfirming) {
      setIsResetConfirming(true);
      setTimeout(() => setIsResetConfirming(false), 3000);
      return;
    }
    StorageService.reset();
    setState(StorageService.getLocal());
    handleLogout();
    setIsResetConfirming(false);
  };

  const handleAddPlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerUsername.trim() || !newPlayerPassword.trim()) {
      setPlayerError('Preencha nome, usuário e senha.');
      return;
    }
    
    if (newPlayerPassword.length !== 6 || !/^\d+$/.test(newPlayerPassword)) {
      setPlayerError('A senha deve conter exatamente 6 dígitos numéricos.');
      return;
    }

    if (state.players.some(p => p.username === newPlayerUsername.toLowerCase().trim())) {
      setPlayerError('Este username já está em uso.');
      return;
    }

    const result = await StorageService.addPlayer(
      newPlayerName.trim(), 
      newPlayerUsername.toLowerCase().trim(), 
      newPlayerPassword,
      newPlayerAvatar
    );
    
    if (!result.success) {
      setPlayerError(result.error || 'Erro ao cadastrar participante.');
      return;
    }

    setState(StorageService.getLocal());
    setNewPlayerName('');
    setNewPlayerAvatar(undefined);
    setNewPlayerUsername('');
    setNewPlayerPassword('');
    setPlayerError('');
  };

  const handleAddMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedP1 || !selectedP2 || !winner) return;
    if (selectedP1 === selectedP2) return;

    let result;
    if (currentUser?.role === 'admin') {
      result = await StorageService.addMatch({
        date: new Date().toISOString(),
        player1Id: selectedP1,
        player2Id: selectedP2,
        winnerId: winner,
        sets: matchSets.map(s => ({ player1: s.p1, player2: s.p2 })),
        type: 'competitive'
      });
    } else {
      result = await StorageService.reportMatch({
        date: new Date().toISOString(),
        player1Id: selectedP1,
        player2Id: selectedP2,
        winnerId: winner,
        sets: matchSets.map(s => ({ player1: s.p1, player2: s.p2 })),
        type: 'competitive'
      }, currentUser?.id || 'anonymous');
    }

    if (!result.success) {
      alert(result.error || 'Erro ao registrar partida.');
      return;
    }

    alert(currentUser?.role === 'admin' ? 'Partida registrada com sucesso!' : 'Resultado enviado para validação do administrador.');

    setState(StorageService.getLocal());
    setActiveView('dashboard');
    setSelectedP1('');
    setSelectedP2('');
    setWinner('');
    setMatchSets([{ p1: 0, p2: 0 }]);
  };

  const handleApproveMatch = async (matchId: string) => {
    const result = await StorageService.approveMatch(matchId);
    if (!result.success) {
      alert(result.error || 'Erro ao aprovar partida.');
      return;
    }
    setState(StorageService.getLocal());
  };

  const handleRejectMatch = async (matchId: string) => {
    if (confirm('Deseja realmente descartar este registro?')) {
      const result = await StorageService.rejectMatch(matchId);
      if (!result.success) {
        alert(result.error || 'Erro ao descartar partida.');
        return;
      }
      setState(StorageService.getLocal());
    }
  };

  const handleResetStats = async (playerName: string) => {
    if (window.confirm(`Deseja realmente zerar todos os pontos de ${playerName}?`)) {
      setLoading(true);
      await StorageService.resetPlayerStats(playerName);
      const updatedData = await StorageService.fetchFromSupabase();
      if (updatedData) {
        setState(updatedData);
      } else {
        setState(StorageService.getLocal());
      }
      setLoading(false);
    }
  };

  const handleAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit
        setPlayerError('A foto é muito grande. Use uma imagem de até 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPlayerAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startEditing = (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.name);
    setEditUsername(player.username);
    setEditAvatar(player.avatar);
    setEditPassword(player.password || '');
  };

  const handleUpdatePlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    if (!editName.trim() || !editUsername.trim() || !editPassword.trim()) {
      alert('Nome, usuário e senha são obrigatórios.');
      return;
    }

    setLoading(true);
    const result = await StorageService.updatePlayer(editingPlayer.id, {
      name: editName.trim(),
      username: editUsername.toLowerCase().trim(),
      avatar: editAvatar,
      password: editPassword
    });

    if (!result.success) {
      alert(result.error);
      setLoading(false);
      return;
    }

    setState(StorageService.getLocal());
    setEditingPlayer(null);
    setLoading(false);
  };
  
  const handleSyncData = async () => {
    if (!StorageService.hasConfig()) {
      alert('Configure as chaves do Supabase primeiro nos "Secrets".');
      return;
    }
    
    setIsSyncing(true);
    const result = await StorageService.syncLocalToSupabase();
    if (result.success) {
      alert(`Sincronização concluída! ${result.count || 0} jogadores processados.`);
      const refreshed = await StorageService.fetchFromSupabase();
      if (refreshed) setState(refreshed);
    } else {
      alert(`Erro na sincronização: ${result.error}`);
    }
    setIsSyncing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-lime-400 font-black italic text-4xl"
        >
          ACERANK...
        </motion.div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900 rounded-[2rem] shadow-2xl p-10 border border-slate-800"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-lime-400 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-lime-400/20 rotate-3">
              <Trophy className="text-slate-950 w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter italic">ACERANK</h1>
            <p className="text-slate-400 text-sm mt-2 font-medium tracking-widest uppercase">Tennis Tracker // Friends</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Usuário</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu_usuario"
                className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-lime-400 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Senha / PIN</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-lime-400 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            {loginError && <p className="text-red-400 text-xs mt-2 font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20">{loginError}</p>}
            <button className="w-full py-5 bg-lime-400 text-slate-950 rounded-2xl font-black text-lg shadow-xl hover:bg-lime-300 active:scale-95 transition-all mt-4 tracking-tight">
              ENTRAR NO CLUBE
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-600 mt-8 italic font-mono">Build v2.2.0 • Admin ou Jogador (PIN 6 dígitos)</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 z-30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="text-lime-400 w-6 h-6" />
          <h1 className="text-lg font-black italic text-white">ACERANK</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-400"
        >
          <div className="w-6 h-0.5 bg-current mb-1.5" />
          <div className="w-6 h-0.5 bg-current mb-1.5" />
          <div className="w-6 h-0.5 bg-current" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-80 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-[100dvh] z-50 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-10 border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-lime-400 rounded-2xl flex items-center justify-center rotate-3 shadow-lg shadow-lime-400/10">
              <Trophy className="text-slate-950 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter text-white">ACERANK</h1>
              <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Amigos Elite</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-6 py-8 space-y-2 overflow-y-auto scrollbar-hide">
          <NavItem active={activeView === 'dashboard'} icon={<BarChart3 size={20} />} label="Dashboard" onClick={() => { setActiveView('dashboard'); setIsSidebarOpen(false); }} />
          <NavItem active={activeView === 'ranking'} icon={<Trophy size={20} />} label="Ranking Geral" onClick={() => { setActiveView('ranking'); setIsSidebarOpen(false); }} />
          <NavItem active={activeView === 'history'} icon={<History size={20} />} label="Partidas" onClick={() => { setActiveView('history'); setIsSidebarOpen(false); }} />
          <NavItem active={activeView === 'players'} icon={<Users size={20} />} label="Participantes" onClick={() => { setActiveView('players'); setIsSidebarOpen(false); }} />
          <NavItem active={activeView === 'h2h'} icon={<Sword size={20} />} label="Confronto Direto" onClick={() => { setActiveView('h2h'); setIsSidebarOpen(false); }} />
          
          {currentUser?.role === 'admin' && (
            <div className="relative">
              <NavItem 
                active={activeView === 'reports'} 
                icon={<BarChart3 size={20} />} 
                label="Validações" 
                onClick={() => { setActiveView('reports'); setIsSidebarOpen(false); }} 
              />
              {pendingMatches.length > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-lime-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-lime-400/20">
                  {pendingMatches.length}
                </span>
              )}
            </div>
          )}
          <div className="pt-6 mt-6 border-t border-slate-800/50">
            <NavItem 
              active={activeView === 'add-match'} 
              icon={<PlusCircle size={20} />} 
              label="LOG MATCH +" 
              onClick={() => { setActiveView('add-match'); setIsSidebarOpen(false); }} 
              color="text-lime-400" 
            />
          </div>
        </nav>

        <div className="p-8 border-t border-slate-800/50 space-y-4 bg-slate-900">
          {currentUser?.role === 'admin' && (
            <button 
              onClick={handleResetDatabase}
              className={`flex items-center gap-3 transition-all w-full px-5 py-3 font-bold text-[10px] tracking-widest uppercase border rounded-xl ${isResetConfirming ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'text-red-500/50 border-red-500/10 hover:bg-red-500/5 hover:text-red-500'}`}
            >
              <History size={14} />
              <span>{isResetConfirming ? 'Confirmar Reset?' : 'Zerar Sistema'}</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-slate-500 hover:text-red-400 transition-colors w-full px-5 py-3 font-bold text-xs tracking-widest uppercase"
          >
            <LogOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-80 p-6 lg:p-12 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div className="flex justify-between items-end mb-10">
                  <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic">DASHBOARD</h2>
                    <p className="text-slate-400 font-medium mt-3 tracking-widest uppercase text-xs">Bem-vindo, {currentUser?.name}</p>
                  </div>
                  <button 
                    onClick={() => setActiveView('add-match')}
                    className="px-8 py-4 bg-lime-400 text-slate-950 rounded-2xl shadow-xl shadow-lime-400/20 flex items-center gap-3 hover:scale-105 transition-transform font-bold text-sm tracking-tight"
                  >
                    <PlusCircle size={20} />
                    REGISTRAR PARTIDA
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard label="Partidas Oficiais" value={state.matches.filter(m => m.status === 'approved').length} icon={<History className="text-lime-400" />} />
                  <StatCard label="Jogadores Ativos" value={state.players.length} icon={<Users className="text-lime-400" />} />
                  {currentUser?.role === 'admin' ? (
                    <StatCard label="Aguardando Validação" value={pendingMatches.length} icon={<BarChart3 className={pendingMatches.length > 0 ? "text-amber-400" : "text-slate-600"} />} />
                  ) : (
                    <StatCard label="Head to Head" value={Math.floor(state.players.length * (state.players.length - 1) / 2)} icon={<Sword className="text-lime-400" />} />
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Ranking Preview */}
                  <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                        <TrendingUp size={16} className="text-lime-400" />
                        Líderes do Ranking
                      </h3>
                      <button onClick={() => setActiveView('ranking')} className="text-[10px] font-black text-lime-400 uppercase tracking-widest border border-lime-400/20 px-4 py-2 rounded-xl hover:bg-lime-400/5 transition-colors">
                        Ver Ranking
                      </button>
                    </div>
                    <div className="space-y-4">
                      {topPlayers.map((player, index) => (
                        <div key={player.id} className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 hover:border-lime-400/20 transition-all group">
                          <div className="flex items-center gap-5">
                            <span className="text-2xl font-black text-slate-800 italic w-8 group-hover:text-lime-400/30 transition-colors">0{index + 1}</span>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-950 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                {player.avatar ? (
                                  <img src={player.avatar} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center italic text-slate-800 font-black">
                                    {player.name.substring(0, 1)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-white text-lg">{player.name}</p>
                                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{player.wins}V - {player.losses}D</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-lime-400 font-mono tracking-tighter">{player.points}</p>
                            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600">PTS</p>
                          </div>
                        </div>
                      ))}
                      {topPlayers.length === 0 && <p className="text-center text-slate-600 py-12 font-mono text-xs italic">Nenhum jogador em quadra ainda.</p>}
                    </div>
                  </div>

                  {/* Recent Matches */}
                  <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                        <Calendar size={16} className="text-lime-400" />
                        Histórico Recente
                      </h3>
                      <button onClick={() => setActiveView('history')} className="text-[10px] font-black text-lime-400 uppercase tracking-widest border border-lime-400/20 px-4 py-2 rounded-xl hover:bg-lime-400/5 transition-colors">
                        Histórico
                      </button>
                    </div>
                    <div className="space-y-3">
                      {recentMatches.map((match: Match) => (
                        <MatchRow key={match.id} match={match} />
                      ))}
                      {recentMatches.length === 0 && <p className="text-center text-slate-600 py-12 font-mono text-xs italic">Aguardando o primeiro saque.</p>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}


            {activeView === 'reports' && currentUser?.role === 'admin' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-10"
              >
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic uppercase">VALIDAÇÕES</h2>
                  <p className="text-slate-400 font-medium mt-3 tracking-widest uppercase text-xs">Aprovar resultados reportados pelos competidores</p>
                </div>

                <div className="space-y-6">
                  {pendingMatches.length === 0 ? (
                    <div className="bg-slate-900 rounded-[2.5rem] p-20 text-center border border-slate-800">
                      <PlusCircle size={48} className="mx-auto text-slate-800 mb-6" />
                      <p className="text-slate-500 font-mono italic">Não há partidas pendentes de validação no momento.</p>
                      <button onClick={() => setActiveView('dashboard')} className="mt-8 text-lime-400 font-black uppercase text-xs tracking-widest hover:underline">Voltar ao Painel</button>
                    </div>
                  ) : (
                    pendingMatches.map(match => (
                      <div key={match.id} className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 group">
                        <div className="flex items-center gap-10">
                          <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-2">{new Date(match.date).toLocaleDateString()}</span>
                            <div className="w-12 h-12 bg-lime-400/10 rounded-2xl flex items-center justify-center">
                              <Calendar className="text-lime-400" size={20} />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-8">
                            <div className={`text-right ${match.winnerId === match.player1Id ? 'text-white' : 'text-slate-600'}`}>
                              <p className="text-2xl font-black italic">{match.player1Name}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest">{match.winnerId === match.player1Id ? 'Vencedor' : 'Derrotado'}</p>
                            </div>
                            <div className="px-6 py-2 bg-slate-950 rounded-full border border-slate-800 font-black text-lime-400 italic text-xl">
                              VS
                            </div>
                            <div className={`text-left ${match.winnerId === match.player2Id ? 'text-white' : 'text-slate-600'}`}>
                              <p className="text-2xl font-black italic">{match.player2Name}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest">{match.winnerId === match.player2Id ? 'Vencedor' : 'Derrotado'}</p>
                            </div>
                          </div>

                          <div className="hidden lg:flex gap-2">
                            {match.sets.map((set, i) => (
                              <div key={i} className="flex flex-col items-center justify-center w-10 h-10 bg-slate-950 rounded-lg border border-slate-800">
                                <span className="text-[10px] font-bold text-white leading-none">{set.player1}</span>
                                <div className="h-[1px] w-4 bg-slate-800 my-1" />
                                <span className="text-[10px] font-bold text-white leading-none">{set.player2}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <button 
                            onClick={() => handleRejectMatch(match.id)}
                            className="flex-1 md:flex-none px-8 py-4 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-500/10 transition-colors font-bold text-sm"
                          >
                            REJEITAR
                          </button>
                          <button 
                            onClick={() => handleApproveMatch(match.id)}
                            className="flex-1 md:flex-none px-8 py-4 bg-lime-400 text-slate-950 rounded-2xl shadow-xl shadow-lime-400/20 hover:bg-lime-300 transition-colors font-black text-sm"
                          >
                            APROVAR
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}


            {activeView === 'ranking' && (
              <motion.div 
                key="ranking"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-10"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                  <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic uppercase">RANKING</h2>
                    <p className="text-slate-400 font-medium mt-3 tracking-widest uppercase text-xs">Classificação Oficial da Temporada</p>
                  </div>
                  <button 
                    onClick={() => exportRankingToPDF(state.players)}
                    className="flex items-center justify-center gap-3 bg-slate-900 text-teal-400 border border-teal-400/20 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-teal-400/10 hover:border-teal-400/50 transition-all shadow-xl shadow-teal-400/5"
                  >
                    <FileDown size={18} />
                    Exportar PDF
                  </button>
                </div>
                
                <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pos</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Jogador</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">PJ</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">V</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">D</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[...state.players]
                        .filter(p => p.role !== 'admin')
                        .sort((a, b) => {
                          if (b.points !== a.points) return b.points - a.points;
                          if (b.wins !== a.wins) return b.wins - a.wins;
                          return a.name.localeCompare(b.name);
                        })
                        .map((player, index) => (
                        <tr key={player.id} className="hover:bg-white/5 transition-colors cursor-default group">
                          <td className="px-10 py-8 font-black text-slate-700 italic group-hover:text-lime-400/50 transition-colors text-2xl">0{index + 1}</td>
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-950 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                {player.avatar ? (
                                  <img src={player.avatar} className="w-full h-full object-cover" alt={player.name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center italic text-slate-800 font-black text-xs">
                                    {player.name.substring(0, 1)}
                                  </div>
                                )}
                              </div>
                              <span className="font-bold text-white text-lg">{player.name}</span>
                            </div>
                          </td>
                          <td className="px-10 py-8 font-mono text-slate-400">{player.matchesPlayed}</td>
                          <td className="px-10 py-8 font-mono text-lime-400 font-bold">{player.wins}</td>
                          <td className="px-10 py-8 font-mono text-red-400">{player.losses}</td>
                          <td className="px-10 py-8 text-right font-black text-lime-400 text-3xl font-mono tracking-tighter">{player.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}


            {activeView === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-10"
              >
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic uppercase">HISTÓRICO</h2>
                  <p className="text-slate-400 font-medium mt-3 tracking-widest uppercase text-xs">Todos os Resultados Registrados</p>
                </div>
                
                <div className="space-y-4">
                  {state.matches.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(match => (
                    <div key={match.id} className="bg-slate-900 rounded-[2rem] p-10 shadow-2xl border border-slate-800 flex justify-between items-center group hover:border-lime-400/20 transition-all">
                      <div className="flex items-center gap-16 flex-1">
                        <div className="text-center w-16">
                          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">{new Date(match.date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                          <p className="text-3xl font-black text-lime-400 font-mono tracking-tighter">{new Date(match.date).getDate()}</p>
                        </div>
                        
                        <div className="flex-1 grid grid-cols-3 items-center gap-12">
                          <div className={`text-right text-xl ${match.winnerId === match.player1Id ? 'font-black text-white italic' : 'text-slate-500 font-medium'}`}>
                            {match.player1Name}
                          </div>
                          
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-[10px] font-black text-slate-700 tracking-[0.3em] uppercase mb-1">SCORE</div>
                            <div className="flex gap-2">
                              {match.sets.map((set, i) => (
                                <div key={i} className="bg-slate-950 px-4 py-2 rounded-xl text-sm font-black font-mono border border-white/5 flex gap-3 shadow-inner">
                                  <span className={set.player1 > set.player2 ? 'text-lime-400' : 'text-slate-600'}>{set.player1}</span>
                                  <span className="text-slate-800">/</span>
                                  <span className={set.player2 > set.player1 ? 'text-lime-400' : 'text-slate-600'}>{set.player2}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={`text-left text-xl ${match.winnerId === match.player2Id ? 'font-black text-white italic' : 'text-slate-500 font-medium'}`}>
                            {match.player2Name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {state.matches.length === 0 && <p className="text-center text-slate-600 py-24 font-mono italic">A história ainda não começou...</p>}
                </div>
              </motion.div>
            )}


            {activeView === 'players' && (
              <motion.div 
                key="players"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic uppercase">PARTICIPANTES</h2>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-3">
                    <p className="text-slate-400 font-medium tracking-widest uppercase text-xs">Membros Ativos do Ranking</p>
                    {currentUser?.role === 'admin' && StorageService.hasConfig() && (
                      <button 
                        onClick={handleSyncData}
                        disabled={isSyncing}
                        className="flex items-center gap-2 text-[10px] font-black text-lime-400 hover:text-lime-300 transition-colors uppercase tracking-widest px-4 py-2 rounded-xl bg-lime-400/5 border border-lime-400/20 disabled:opacity-50"
                      >
                        <RotateCcw size={12} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR COM NUVEM'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {!StorageService.hasConfig() && (
                    <div className="bg-amber-500/10 border border-amber-500/50 text-amber-500 p-4 rounded-2xl text-xs font-bold flex flex-col gap-1 items-center text-center">
                      <p>⚠️ SUPABASE NÃO CONFIGURADO NO PAINEL "SECRETS"</p>
                      <p className="opacity-70 font-medium">Os dados serão salvos apenas neste navegador até você configurar as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
                    </div>
                  )}
                  
                  <div className="bg-slate-900 rounded-[2.5rem] p-12 shadow-2xl border border-slate-800">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 border-l-4 border-lime-400 pl-4">Pré-Cadastrar Jogador</h3>
                      <form onSubmit={handleAddPlayer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div className="space-y-2 lg:col-span-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Foto</label>
                          <div className="relative group">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleAvatarSelect}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div className="h-[58px] bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center overflow-hidden transition-all group-hover:border-lime-400/50">
                              {newPlayerAvatar ? (
                                <img src={newPlayerAvatar} className="w-full h-full object-cover" />
                              ) : (
                                <PlusCircle className="text-slate-700 w-6 h-6" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Nome Completo</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Roger Federer"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 transition-all font-bold placeholder:text-slate-800 shadow-inner"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Login (Username)</label>
                          <input 
                            type="text" 
                            placeholder="roger_fed"
                            value={newPlayerUsername}
                            onChange={(e) => setNewPlayerUsername(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 transition-all font-bold placeholder:text-slate-800 shadow-inner"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Senha (6 dígitos)</label>
                          <input 
                            type="password" 
                            maxLength={6}
                            placeholder="••••••"
                            value={newPlayerPassword}
                            onChange={(e) => setNewPlayerPassword(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 transition-all font-bold placeholder:text-slate-800 shadow-inner"
                          />
                        </div>
                        <button className="w-full px-6 py-4 bg-lime-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-lime-400/10 hover:bg-lime-300 active:scale-95 transition-all text-sm uppercase tracking-widest h-[58px]">
                          CADASTRAR
                        </button>
                      </form>
                      {playerError && <p className="text-red-400 text-xs font-bold font-mono tracking-tight bg-red-400/5 px-4 py-2 rounded-lg border border-red-400/10 inline-block mt-4">{playerError}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[...state.players]
                    .filter(p => p.role !== 'admin')
                    .sort((a, b) => {
                      // Se tem pontuação/vitórias, prioriza quem tem pontos
                      if (b.points !== a.points) return b.points - a.points;
                      if (b.wins !== a.wins) return b.wins - a.wins;
                      // Se empatado (ou ambos 0), ordem alfabética
                      return a.name.localeCompare(b.name);
                    })
                    .map(player => (
                    <div key={player.id} className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 flex flex-col items-center text-center group hover:border-lime-400/20 transition-all">
                      <div className="w-24 h-24 bg-slate-950 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-lime-400/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity" />
                        {player.avatar ? (
                          <img src={player.avatar} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        ) : (
                          <UserIcon className="text-slate-700 w-12 h-12 group-hover:text-lime-400 transition-colors" />
                        )}
                      </div>
                      <h4 className="text-2xl font-black text-white italic">{player.name}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 mb-8">Ativo desde {new Date(player.lastActive).toLocaleDateString()}</p>
                      
                      <div className="w-full grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
                        <div>
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">PJ</p>
                          <p className="font-bold text-slate-300 font-mono text-lg">{player.matchesPlayed}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">V</p>
                          <p className="font-bold text-lime-400 font-mono text-lg">{player.wins}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">PTS</p>
                          <p className="font-black text-white font-mono text-lg">{player.points}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => handleResetStats(player.name)}
                          className="mt-6 flex-1 flex items-center justify-center gap-2 text-[10px] font-black text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-red-400/5 group/btn border border-transparent hover:border-red-400/20"
                        >
                          <RotateCcw size={12} className="group-hover/btn:rotate-[-45deg] transition-transform" />
                          Zerar
                        </button>

                        <button 
                          onClick={() => startEditing(player)}
                          className="mt-6 flex-1 flex items-center justify-center gap-2 text-[10px] font-black text-slate-600 hover:text-lime-400 transition-colors uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-lime-400/5 group/btn border border-transparent hover:border-lime-400/20"
                        >
                          <Pencil size={12} className="group-hover/btn:scale-110 transition-transform" />
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}


            {activeView === 'h2h' && (
              <motion.div 
                key="h2h"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                <div className="mb-10 text-center">
                  <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic uppercase">HEAD TO HEAD</h2>
                  <p className="text-slate-400 font-medium mt-3 tracking-widest uppercase text-xs">Análise Detalhada de Confrontos</p>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-12 shadow-2xl border border-slate-800 max-w-3xl mx-auto">
                  <div className="flex items-center gap-10">
                    <div className="flex-1 space-y-4">
                      <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase ml-2">Jogador 1</label>
                      <select 
                        value={selectedP1}
                        onChange={(e) => setSelectedP1(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 shadow-inner appearance-none"
                      >
                        <option value="">Selecione Jogador 1</option>
                        {state.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col items-center pt-8">
                       <Sword className="text-lime-400 opacity-20" size={40} />
                    </div>
                    <div className="flex-1 space-y-4">
                      <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase ml-2">Jogador 2</label>
                      <select 
                        value={selectedP2}
                        onChange={(e) => setSelectedP2(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 shadow-inner appearance-none"
                      >
                        <option value="">Selecione Jogador 2</option>
                        {state.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {selectedP1 && selectedP2 && selectedP1 !== selectedP2 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12">
                     {(() => {
                        const h2h = StorageService.getH2H(selectedP1, selectedP2, state);
                        const p1 = state.players.find(p => p.id === selectedP1);
                        const p2 = state.players.find(p => p.id === selectedP2);
                        return (
                          <div className="space-y-12">
                            <div className="flex justify-between items-center max-w-5xl mx-auto bg-slate-900 rounded-[3rem] p-16 shadow-2xl border border-slate-800 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-lime-400/5 to-transparent pointer-events-none" />
                              <div className="text-center flex-1 relative z-10">
                                <div className="text-7xl font-black text-lime-400 mb-4 font-mono tracking-tighter">{h2h.p1Wins}</div>
                                <div className="text-2xl font-black text-white italic uppercase tracking-tight">{p1?.name}</div>
                                <div className="text-[10px] font-bold text-slate-500 tracking-[0.3em] mt-2 italic uppercase">VITÓRIAS</div>
                              </div>
                              <div className="px-16 text-center relative z-10">
                                <div className="text-[10px] font-black text-slate-600 tracking-[0.5em] mb-4 uppercase">CONFRONTOS</div>
                                <div className="text-4xl font-black bg-slate-950 text-white px-10 py-4 rounded-3xl border border-white/5 shadow-inner font-mono">{h2h.total}</div>
                              </div>
                              <div className="text-center flex-1 relative z-10">
                                <div className="text-7xl font-black text-slate-500 mb-4 font-mono tracking-tighter">{h2h.p2Wins}</div>
                                <div className="text-2xl font-black text-white italic uppercase tracking-tight">{p2?.name}</div>
                                <div className="text-[10px] font-bold text-slate-500 tracking-[0.3em] mt-2 italic uppercase">VITÓRIAS</div>
                              </div>
                            </div>

                            <div className="max-w-4xl mx-auto space-y-6">
                              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-center text-slate-600 mb-8 border-b border-white/5 pb-4">Análise de Pontuação Recente</h4>
                              {h2h.matches.map((m: Match) => (
                                <MatchRow key={m.id} match={m} />
                              ))}
                            </div>
                          </div>
                        );
                     })()}
                  </motion.div>
                )}
              </motion.div>
            )}


            {activeView === 'add-match' && (
              <motion.div 
                key="add-match"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-white tracking-tighter leading-none italic uppercase">LOG MATCH</h2>
                  <p className="text-slate-400 font-medium mt-3 tracking-widest uppercase text-xs">Registrar Novo Resultado Oficial</p>
                </div>

                <form onSubmit={handleAddMatch} className="bg-slate-900 rounded-[2.5rem] p-12 shadow-2xl border border-slate-800 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Jogador 1</label>
                      <select 
                        required
                        value={selectedP1}
                        onChange={(e) => setSelectedP1(e.target.value)}
                        className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 shadow-inner appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {state.players.filter(p => p.id !== selectedP2).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Jogador 2</label>
                      <select 
                        required
                        value={selectedP2}
                        onChange={(e) => setSelectedP2(e.target.value)}
                        className="w-full px-8 py-5 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 shadow-inner appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {state.players.filter(p => p.id !== selectedP1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {selectedP1 && selectedP2 && (
                    <div className="space-y-8 pt-8 border-t border-white/5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Score por Set</label>
                        <button 
                          type="button"
                          onClick={() => setMatchSets([...matchSets, { p1: 0, p2: 0 }])}
                          className="px-4 py-2 bg-slate-800 text-[10px] font-black text-lime-400 rounded-lg hover:bg-slate-700 transition-colors tracking-widest uppercase"
                        >+ ADICIONAR SET</button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {matchSets.map((set, i) => (
                          <div key={i} className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-inner">
                            <span className="w-8 text-center text-xs font-black text-slate-700 font-mono">#{i+1}</span>
                            <input 
                              type="number" 
                              value={set.p1}
                              onChange={(e) => {
                                const newSets = [...matchSets];
                                newSets[i].p1 = parseInt(e.target.value) || 0;
                                setMatchSets(newSets);
                              }}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center font-black text-white font-mono"
                            />
                            <span className="text-slate-800 font-black">:</span>
                            <input 
                              type="number" 
                              value={set.p2}
                              onChange={(e) => {
                                const newSets = [...matchSets];
                                newSets[i].p2 = parseInt(e.target.value) || 0;
                                setMatchSets(newSets);
                              }}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center font-black text-white font-mono"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-6 pt-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Declarar Vencedor</label>
                        <div className="grid grid-cols-2 gap-6">
                          <button 
                            type="button"
                            onClick={() => setWinner(selectedP1)}
                            className={`py-6 rounded-3xl font-black text-lg border-4 italic transition-all ${winner === selectedP1 ? 'bg-lime-400 text-slate-950 border-lime-400 shadow-2xl shadow-lime-400/20' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700 uppercase tracking-tighter'}`}
                          >
                            {state.players.find(p => p.id === selectedP1)?.name}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setWinner(selectedP2)}
                            className={`py-6 rounded-3xl font-black text-lg border-4 italic transition-all ${winner === selectedP2 ? 'bg-lime-400 text-slate-950 border-lime-400 shadow-2xl shadow-lime-400/20' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700 uppercase tracking-tighter'}`}
                          >
                            {state.players.find(p => p.id === selectedP2)?.name}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-10 flex gap-6">
                    <button 
                      type="button"
                      onClick={() => setActiveView('dashboard')}
                      className="flex-1 py-6 bg-slate-950 border border-slate-800 rounded-3xl font-black text-slate-600 hover:bg-slate-800 transition-colors uppercase tracking-[0.2em] text-xs"
                    >CANCELAR</button>
                    <button 
                      type="submit"
                      disabled={!selectedP1 || !selectedP2 || !winner}
                      className="flex-[2] py-6 bg-lime-400 text-slate-950 rounded-3xl font-black text-xl shadow-2xl shadow-lime-400/20 hover:bg-lime-300 transition-all disabled:opacity-20 disabled:grayscale uppercase tracking-tighter italic"
                    >CONFIRMAR VITÓRIA</button>
                  </div>
                </form>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Edit Player Modal */}
          <AnimatePresence>
            {editingPlayer && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden"
                >
                  <div className="p-10 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Editar Cadastro</h3>
                    <button onClick={() => setEditingPlayer(null)} className="p-3 text-slate-500 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <form onSubmit={handleUpdatePlayer} className="p-10 space-y-8">
                    <div className="flex justify-center mb-8">
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleEditAvatarSelect}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-32 h-32 bg-slate-950 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-800 group-hover:border-lime-400/50 transition-all shadow-inner">
                          {editAvatar ? (
                            <img src={editAvatar} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="text-slate-800 w-12 h-12" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <PlusCircle className="text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nome Completo</label>
                        <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Login (Username)</label>
                        <input 
                          type="text" 
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nova Senha (PIN 6 dígitos)</label>
                      <input 
                        type="password" 
                        maxLength={6}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-lime-400 text-center tracking-[1em] font-black shadow-inner"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        type="button" 
                        onClick={() => setEditingPlayer(null)}
                        className="flex-1 py-5 bg-slate-950 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs border border-slate-800"
                      >CANCELAR</button>
                      <button 
                        type="submit"
                        className="flex-[2] py-5 bg-lime-400 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-lime-400/20"
                      >SALVAR ALTERAÇÕES</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, icon, label, onClick, color = "text-slate-500" }: { active: boolean, icon: ReactNode, label: string, onClick: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl font-black transition-all group relative overflow-hidden ${active ? 'bg-lime-400 text-slate-950 shadow-xl shadow-lime-400/10 scale-105 italic' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
      <span className={`${active ? 'text-slate-950' : color + ' group-hover:text-lime-400'} transition-colors`}>
        {icon}
      </span>
      <span className="text-xs uppercase tracking-widest">{label}</span>
      {active && (
        <motion.div 
          layoutId="activeNav" 
          className="absolute right-0 top-0 bottom-0 w-1.5 bg-slate-950 rounded-l-full" 
        />
      )}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string | number, icon: ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-[2rem] p-10 shadow-2xl border border-slate-800 relative overflow-hidden group hover:border-lime-400/20 transition-all">
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.07] transition-all duration-700">
        {icon}
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-950 rounded-lg border border-white/5">
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
      </div>
      <p className="text-5xl font-black text-white font-mono tracking-tighter">{value}</p>
    </div>
  );
}

interface MatchRowProps {
  match: Match;
}

const MatchRow: FC<MatchRowProps> = ({ match }) => {
  return (
    <div className="flex items-center justify-between p-6 bg-slate-950 rounded-3xl border border-white/5 hover:border-lime-400/10 transition-all group">
      <div className="flex items-center gap-5 flex-1">
        <p className={`font-bold flex-1 text-right truncate text-sm transition-colors ${match.winnerId === match.player1Id ? 'text-white' : 'text-slate-600'}`}>{match.player1Name}</p>
        <div className="bg-slate-900 text-slate-500 text-[9px] font-black px-2 py-1 rounded border border-white/5 group-hover:text-lime-400 group-hover:border-lime-400/20 transition-colors">VS</div>
        <p className={`font-bold flex-1 truncate text-sm transition-colors ${match.winnerId === match.player2Id ? 'text-white' : 'text-slate-600'}`}>{match.player2Name}</p>
      </div>
      <div className="ml-8 text-right flex flex-col items-end gap-2">
        <div className="flex gap-1.5">
          {match.sets.slice(0, 3).map((s, i) => (
            <span key={i} className={`text-[10px] font-black font-mono px-2 py-1 rounded ${s.player1 > s.player2 ? 'bg-lime-400/10 text-lime-400' : 'bg-slate-900 text-slate-500'}`}>
              {s.player1}:{s.player2}
            </span>
          ))}
        </div>
        <p className="text-[9px] uppercase font-black text-slate-700 tracking-tighter font-mono group-hover:text-slate-500 transition-colors">
          {new Date(match.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}


