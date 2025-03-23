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
  
  // New properties for optimized multiplayer
  private lastStateBroadcast: number;
  private pendingEvents: GameEvent[];
  private lastStateSnapshot: any;
  private reconnectTokens: Map<string, string>; // Player ID -> Token for reconnection
  private latencyData: Map<string, { ping: number, lastPing: number }>; // Track player latency
  
  constructor(roomCode: string) {
    this.roomCode = roomCode;
    this.players = new Map();
    this.playerSockets = new Map();
    this.gameState = null;
    this.gameStarted = false;
    
    // Initialize new properties
    this.lastStateBroadcast = Date.now();
    this.pendingEvents = [];
    this.lastStateSnapshot = null;
    this.reconnectTokens = new Map();
    this.latencyData = new Map();
  }
  
  addPlayer(player: Player, socket: WebSocket): boolean {
    // Check if room is full
    if (this.players.size >= MAX_PLAYERS) {
      return false;
    }
    
    // Add player
    this.players.set(player.id, player);
    this.playerSockets.set(player.id, socket);
    
    // Create reconnection token for this player
    const reconnectToken = this.generateReconnectToken();
    this.reconnectTokens.set(player.id, reconnectToken);
    
    // Initialize latency tracking
    this.latencyData.set(player.id, { ping: 0, lastPing: Date.now() });
    
    // Send player their reconnection token
    this.sendToPlayer(player.id, {
      type: "connection_data",
      reconnectToken,
      playerId: player.id,
    });
    
    return true;
  }
  
  removePlayer(playerId: string): boolean {
    const playerRemoved = this.players.delete(playerId);
    const socketRemoved = this.playerSockets.delete(playerId);
    
    // Keep reconnect token for 5 minutes to allow rejoins
    setTimeout(() => {
      this.reconnectTokens.delete(playerId);
    }, 5 * 60 * 1000);
    
    return playerRemoved || socketRemoved;
  }
  
  /**
   * Allow a player to reconnect with their token
   */
  reconnectPlayer(playerId: string, reconnectToken: string, socket: WebSocket): boolean {
    // Verify token matches
    if (!this.reconnectTokens.has(playerId) || this.reconnectTokens.get(playerId) !== reconnectToken) {
      return false;
    }
    
    // Update socket reference
    this.playerSockets.set(playerId, socket);
    
    // Send current game state to the reconnected player
    if (this.gameStarted && this.gameState) {
      this.sendToPlayer(playerId, {
        type: "gameState",
        state: this.gameState.getGameState(),
      });
    }
    
    return true;
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
  
  getGameState(): GameState | null {
    return this.gameState;
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
    
    // Take initial state snapshot
    this.lastStateSnapshot = this.gameState.getGameState();
    
    return true;
  }
  
  /**
   * Handles an incoming game event, queuing it for batch processing
   */
  processGameEvent(event: GameEvent): void {
    if (!this.gameStarted || !this.gameState) {
      console.warn("Cannot process event: game not started");
      return;
    }
    
    // Add timestamp to event
    const timestampedEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    // Add to pending events queue
    this.pendingEvents.push(timestampedEvent);
    
    // Process the event immediately for responsive feedback
    const updatedState = this.gameState.processEvent(event);
    
    // Broadcast the event to all players as a responsive update
    // (State synchronization will happen during tick updates)
    if (updatedState) {
      this.broadcastToAll({
        type: "gameEvent",
        event: timestampedEvent
      });
    }
  }
  
  /**
   * Update game state as part of the server tick
   * @param deltaTime Time since last update in milliseconds
   */
  updateGameState(deltaTime: number): void {
    if (!this.gameStarted || !this.gameState) {
      return;
    }
    
    // Process any pending events in the queue
    if (this.pendingEvents.length > 0) {
      // Process accumulated events
      this.pendingEvents.forEach(event => {
        this.gameState?.processEvent(event);
      });
      
      // Clear the queue
      this.pendingEvents = [];
    }
    
    // Have the game state update itself based on the elapsed time
    // This handles continuous actions like resource gathering, unit movement, etc.
    this.gameState.update(deltaTime);
  }
  
  /**
   * Get state changes since last update for delta compression
   */
  getStateUpdate(): any {
    if (!this.gameState) return null;
    
    // Get current full state
    const currentState = this.gameState.getGameState();
    
    // Return full state the first time
    if (!this.lastStateSnapshot) {
      this.lastStateSnapshot = currentState;
      return currentState;
    }
    
    // Compare with last state snapshot to create delta update
    const delta = this.computeStateDelta(this.lastStateSnapshot, currentState);
    
    // Save current state as the new reference point
    this.lastStateSnapshot = currentState;
    
    return delta;
  }
  
  /**
   * Compute differences between old and new state
   * This implements delta compression for network efficiency
   */
  private computeStateDelta(oldState: any, newState: any): any {
    const delta: any = {};
    
    // Compare units
    if (newState.units) {
      delta.units = {};
      
      // Check for new or changed units
      Object.entries(newState.units).forEach(([unitId, unit]) => {
        const oldUnit = oldState.units?.[unitId];
        
        // New unit or changed unit
        if (!oldUnit || this.hasChanges(oldUnit, unit)) {
          delta.units[unitId] = unit;
        }
      });
      
      // Check for removed units
      if (oldState.units) {
        Object.keys(oldState.units).forEach(unitId => {
          if (!newState.units[unitId]) {
            delta.units[unitId] = null; // Null indicates removal
          }
        });
      }
    }
    
    // Compare buildings (similar approach)
    if (newState.buildings) {
      delta.buildings = {};
      
      // Check for new or changed buildings
      Object.entries(newState.buildings).forEach(([buildingId, building]) => {
        const oldBuilding = oldState.buildings?.[buildingId];
        
        if (!oldBuilding || this.hasChanges(oldBuilding, building)) {
          delta.buildings[buildingId] = building;
        }
      });
      
      // Check for removed buildings
      if (oldState.buildings) {
        Object.keys(oldState.buildings).forEach(buildingId => {
          if (!newState.buildings[buildingId]) {
            delta.buildings[buildingId] = null;
          }
        });
      }
    }
    
    // Compare resources
    if (newState.players) {
      delta.players = {};
      
      // Check player resource changes
      Object.entries(newState.players).forEach(([playerId, playerData]: [string, any]) => {
        const oldPlayerData = oldState.players?.[playerId] as any;
        
        if (!oldPlayerData || 
            oldPlayerData.resources.food !== playerData.resources.food || 
            oldPlayerData.resources.ore !== playerData.resources.ore) {
          delta.players[playerId] = {
            resources: playerData.resources
          };
        }
      });
    }
    
    // Only include non-empty sections
    Object.keys(delta).forEach(key => {
      if (Object.keys(delta[key]).length === 0) {
        delete delta[key];
      }
    });
    
    return delta;
  }
  
  /**
   * Check if object properties have changed
   */
  private hasChanges(oldObj: any, newObj: any): boolean {
    // For position changes, check x, y
    if (oldObj.x !== newObj.x || oldObj.y !== newObj.y) {
      return true;
    }
    
    // For health changes
    if (oldObj.health !== newObj.health) {
      return true;
    }
    
    // Check for state changes (attacking, gathering, etc.)
    if (oldObj.isAttacking !== newObj.isAttacking || 
        oldObj.isGathering !== newObj.isGathering || 
        oldObj.isMoving !== newObj.isMoving) {
      return true;
    }
    
    // For production progress
    if (oldObj.productionProgress !== newObj.productionProgress) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Send data to a specific player
   */
  sendToPlayer(playerId: string, data: any): void {
    const socket = this.playerSockets.get(playerId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }
  
  /**
   * Broadcast data to all connected players
   * Optionally exclude certain players
   */
  broadcastToAll(data: any, excludePlayerIds: string[] = []): void {
    const message = JSON.stringify(data);
    
    for (const [playerId, socket] of this.playerSockets.entries()) {
      if (excludePlayerIds.includes(playerId)) continue;
      
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }
  
  /**
   * Send ping request to a player to measure latency
   */
  pingPlayer(playerId: string): void {
    const socket = this.playerSockets.get(playerId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      const pingData = {
        type: "ping",
        timestamp: Date.now()
      };
      
      // Update last ping timestamp
      const latency = this.latencyData.get(playerId);
      if (latency) {
        latency.lastPing = Date.now();
        this.latencyData.set(playerId, latency);
      }
      
      socket.send(JSON.stringify(pingData));
    }
  }
  
  /**
   * Process ping response from player to update latency
   */
  processPong(playerId: string, originalTimestamp: number): void {
    const currentTime = Date.now();
    const pingTime = currentTime - originalTimestamp;
    
    // Update player's ping data
    const latency = this.latencyData.get(playerId);
    if (latency) {
      // Weighted average to smooth values
      latency.ping = latency.ping * 0.7 + pingTime * 0.3;
      this.latencyData.set(playerId, latency);
    }
  }
  
  /**
   * Get current player latency statistics
   */
  getPlayerLatencies(): Map<string, number> {
    const result = new Map<string, number>();
    
    for (const [playerId, data] of this.latencyData.entries()) {
      result.set(playerId, data.ping);
    }
    
    return result;
  }
  
  /**
   * Create a unique reconnection token
   */
  private generateReconnectToken(): string {
    const tokenChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < 32; i++) {
      token += tokenChars.charAt(Math.floor(Math.random() * tokenChars.length));
    }
    
    return token;
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
