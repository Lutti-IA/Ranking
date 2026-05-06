/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  password?: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  lastActive: string;
  role?: 'admin' | 'player';
}

export interface SetScore {
  player1: number;
  player2: number;
}

export interface Match {
  id: string;
  date: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  winnerId: string;
  sets: SetScore[];
  type: 'competitive' | 'friendly';
  status: 'pending' | 'approved' | 'rejected';
  reportedBy?: string;
}

export interface AppState {
  players: Player[];
  matches: Match[];
}
