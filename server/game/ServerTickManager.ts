/**
 * Server Tick Manager - Responsible for server-side game tick processing
 * This implements the "heartbeat" of the game, handling state updates at regular intervals
 */

import { GameRoom } from "./GameRoom";

export class ServerTickManager {
  private tickRate: number; // Number of ticks per second
  private tickInterval: NodeJS.Timeout | null;
  private rooms: Map<string, GameRoom>;
  private lastTickTime: number;
  
  constructor(rooms: Map<string, GameRoom>, tickRate: number = 20) {
    this.rooms = rooms;
    this.tickRate = tickRate;
    this.tickInterval = null;
    this.lastTickTime = Date.now();
  }
  
  /**
   * Start the tick manager
   */
  start(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    
    const intervalMs = 1000 / this.tickRate;
    this.lastTickTime = Date.now();
    
    this.tickInterval = setInterval(() => this.tick(), intervalMs);
    console.log(`Server tick manager started. Tick rate: ${this.tickRate}/sec (${intervalMs}ms)`);
  }
  
  /**
   * Stop the tick manager
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      console.log("Server tick manager stopped");
    }
  }
  
  /**
   * Process a single tick for all active game rooms
   */
  private tick(): void {
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastTickTime;
    this.lastTickTime = currentTime;
    
    // Process each active game room
    this.rooms.forEach((room, roomCode) => {
      if (room.isGameStarted() && room.getGameState()) {
        // Update game state for this room
        room.updateGameState(deltaTime);
        
        // Send state updates to clients
        this.sendStateUpdates(room);
      }
    });
  }
  
  /**
   * Send optimized state updates to players in a room
   * This uses delta compression to only send changes since the last update
   */
  private sendStateUpdates(room: GameRoom): void {
    // Get delta state update (only changed values)
    const stateUpdate = room.getStateUpdate();
    
    // If there are meaningful changes, broadcast them
    if (stateUpdate && Object.keys(stateUpdate).length > 0) {
      room.broadcastToAll({
        type: "stateUpdate",
        tick: this.lastTickTime,
        changes: stateUpdate
      });
    }
  }
  
  /**
   * Change the tick rate
   */
  setTickRate(newTickRate: number): void {
    if (newTickRate < 1 || newTickRate > 60) {
      console.warn(`Invalid tick rate: ${newTickRate}. Must be between 1 and 60.`);
      return;
    }
    
    this.tickRate = newTickRate;
    
    // Restart with new tick rate if currently running
    if (this.tickInterval) {
      this.stop();
      this.start();
    }
  }
  
  /**
   * Get the current tick rate
   */
  getTickRate(): number {
    return this.tickRate;
  }
}