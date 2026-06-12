export type GameState = 'idle' | 'playing' | 'paused' | 'gameover';
export type PlayerState = 'idle' | 'moving' | 'jumping' | 'hurt' | 'dead';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vector2 { x: number; y: number; }

export interface IEntity {
  id: string;
  position: Vector2;
  update(delta: number): void;
  destroy(): void;
}

export interface GameData {
  score: number;
  level: number;
  lives: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
}
