import { WebSocket } from "ws";
import { Player } from "./Player";
import { GameState } from "./GameState";
import { GameEvent } from "../../shared/types";
import { MAX_PLAYERS } from "../../client/src/game/config";

export class GameRoom {
  private roomCode: string;
  private players: Map<string, Player>;
  private playerSockets: Map<string, WebSocket>;
  private gameState: GameState | null;
  private gameStarted: boolean;
  
  constructor(roomCode: string) {
    this.roomCode = roomCode;
    this.players = new Map();
    this.playerSockets = new Map();
    this.gameState = null;
    this.gameStarted = false;
  }
  
  addPlayer(player: Player, socket: WebSocket): boolean {
    // Check if room is full
    if (this.players.size >= MAX_PLAYERS) {
      return false;
    }
    
    // Add player
    this.players.set(player.id, player);
    this.playerSockets.set(player.id, socket);
    
    return true;
  }
  
  removePlayer(playerId: string): boolean {
    const playerRemoved = this.players.delete(playerId);
    const socketRemoved = this.playerSockets.delete(playerId);
    
    return playerRemoved || socketRemoved;
  }
  
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }
  
  getPlayerSocket(playerId: string): WebSocket | undefined {
    return this.playerSockets.get(playerId);
  }
  
  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }
  
  isEmpty(): boolean {
    return this.players.size === 0;
  }
  
  isFull(): boolean {
    return this.players.size >= MAX_PLAYERS;
  }
  
  isGameStarted(): boolean {
    return this.gameStarted;
  }
  
  canStartGame(): boolean {
    // Need at least 2 players
    if (this.players.size < 2) {
      return false;
    }
    
    // All players must be ready and have selected a faction
    for (const player of this.players.values()) {
      if (!player.isReady() || !player.getFaction()) {
        return false;
      }
    }
    
    return true;
  }
  
  startGame(): boolean {
    if (!this.canStartGame() || this.gameStarted) {
      return false;
    }
    
    // Create new game state
    this.gameState = new GameState(this.players);
    this.gameStarted = true;
    
    return true;
  }
  
  processGameEvent(event: GameEvent): void {
    if (!this.gameStarted || !this.gameState) {
      console.warn("Cannot process event: game not started");
      return;
    }
    
    // Process the event
    const updatedState = this.gameState.processEvent(event);
    
    if (updatedState) {
      // Broadcast the event to all players
      this.broadcastToAll({
        type: "gameEvent",
        event
      });
    }
  }
  
  broadcastToAll(data: any): void {
    const message = JSON.stringify(data);
    
    for (const socket of this.playerSockets.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }
  
  getRoomData(): any {
    return {
      roomCode: this.roomCode,
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        username: player.getUsername(),
        faction: player.getFaction(),
        ready: player.isReady()
      })),
      gameStarted: this.gameStarted
    };
  }
  
  getGameData(): any {
    if (!this.gameState) {
      return null;
    }
    
    return {
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        username: player.getUsername(),
        faction: player.getFaction(),
        ready: player.isReady()
      })),
      roomCode: this.roomCode,
      map: "standard"
    };
  }
}
