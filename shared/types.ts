import { FactionType } from "../client/src/game/types";

export type GameEventType = 
  | "unitMove" 
  | "unitCreate" 
  | "buildingCreate" 
  | "resourceUpdate"
  | "researchTech"
  | "attack";

export interface GameEvent {
  playerId: string;
  type: GameEventType;
  [key: string]: any;
}

export interface PlayerData {
  id: string;
  username: string;
  faction: FactionType | null;
  ready: boolean;
}

export interface RoomData {
  roomCode: string;
  players: PlayerData[];
  gameStarted: boolean;
}

export interface ServerMessage {
  type: string;
  [key: string]: any;
}

export interface ClientMessage {
  type: string;
  roomCode?: string;
  [key: string]: any;
}
