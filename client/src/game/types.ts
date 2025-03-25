// Game types and interfaces

export type FactionType = "Nephites" | "Lamanites";
export type UnitType = "worker" | "melee" | "ranged" | "cavalry" | "hero" | "striplingWarrior" | "lamaniteScout";
export type BuildingType = "cityCenter" | "barracks" | "archeryRange" | "wall" | "nephiteTemple" | "lamaniteTower";
export type ResourceType = "food" | "ore";
export type GamePhase = "menu" | "lobby" | "playing" | "gameOver";

export interface ResourceNode {
  type: ResourceType;
  amount: number;
}

export interface MapTile {
  x: number;
  y: number;
  type: 'grass' | 'forest' | 'hills' | 'water';
  walkable: boolean;
  resource: ResourceNode | null;
}

export interface PlayerResources {
  food: number;
  ore: number;
}

export interface GameData {
  players: Array<{
    id: string;
    username: string;
    faction: FactionType | null;
    ready: boolean;
  }>;
  roomCode: string;
  map: string;
}

export interface UnitStats {
  health: number;
  attack: number;
  defense: number;
  range: number;
  speed: number;
  cost: { food: number; ore: number };
  description: string;
  role: string;
  counters?: UnitType[];
  weakTo?: UnitType[];
}

export interface UnitData {
  id: string;
  type: UnitType;
  playerId: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
}

export interface BuildingData {
  id: string;
  type: BuildingType;
  playerId: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
}

export interface MultiplayerEvent {
  type: string;
  [key: string]: any;
}

export interface TechInfo {
  id: string;
  name: string;
  description: string;
  cost: { food: number; ore: number };
  prerequisites: string[];
  effects: { [key: string]: any };
  unlocks: { units?: UnitType[]; buildings?: BuildingType[] };
  faction?: FactionType;
  researched: boolean;
}
