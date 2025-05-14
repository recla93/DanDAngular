export interface PgDto {
  id: number;
  name: string;
  description: string;
  hp: number; // Questo sarà trattato come HP corrente dal backend dopo le azioni
  atk: number;
  def: number;
  spd: number;
  actionsName: string[];
  actionsDescriptions: string[];
  actionTypes: string[];
  equipmentsName: string[];
  equipmentsDescriptions: string[];
  enumType: string;
  imageUrl: string;
  currentHp: number; // HP correnti per il frontend
  maxHp: number;     // HP massimi per il frontend
}

export interface MonsterDto {
  id: number;
  name: string;
  description: string;
  danger: string;
  hp: number; // Questo sarà trattato come HP corrente dal backend dopo le azioni
  atk: number;
  def: number;
  spd: number;
  actionsName: string[];
  actionsDescriptions: string[];
  imageUrl: string;
  currentHp: number; // HP correnti per il frontend
  maxHp: number;     // HP massimi per il frontend
}

export interface GameStateDto {
  good: PgDto[];
  evil: MonsterDto[];
  order: number[];
  currentEntity: number;
}

export enum ActionType {
  BASE = 'BASE',
  HEAVY = 'HEAVY',
  SPECIALE = 'SPECIALE',
}

export interface ActionRequest {
  previousDto: GameStateDto;
  target: number[];
  actionType: ActionType;
}
