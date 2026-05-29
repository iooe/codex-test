export type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;
export type Phase = 'rolling' | 'assigning' | 'reward' | 'victory' | 'defeat';
export type EnemyTrait = 'armored' | 'poison' | 'split' | 'none';

export interface Die {
  id: string;
  value: DiceFace;
  used: boolean;
  boosted: boolean;
}

export interface EnemyCard {
  id: string;
  name: string;
  maxHealth: number;
  health: number;
  attack: number;
  coins: number;
  trait: EnemyTrait;
  folded: boolean;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
}

export interface Hero {
  maxHealth: number;
  health: number;
  shield: number;
  coins: number;
  diceCount: number;
  rerolls: number;
  relics: Relic[];
}

export interface RoomDefinition {
  id: string;
  title: string;
  enemies: Omit<EnemyCard, 'id' | 'health' | 'folded'>[];
}

export interface GameState {
  runId: number;
  phase: Phase;
  roomIndex: number;
  turn: number;
  hero: Hero;
  dice: Die[];
  enemies: EnemyCard[];
  log: string[];
  rewardChoices: Relic[];
}

export interface AssignResult {
  state: GameState;
  message: string;
}
