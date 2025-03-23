import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { GameRoom } from "./game/GameRoom";
import { Player } from "./game/Player";
import { ServerTickManager } from "./game/ServerTickManager";

export class SocketServer {
  private wss: WebSocketServer;
  private rooms: Map<string, GameRoom>;
  private tickManager: ServerTickManager;
  private pingInterval: NodeJS.Timeout | null = null;
  
  constructor(server: Server) {
    // Use a specific path for our game WebSockets to avoid conflicts with Vite
    this.wss = new WebSocketServer({ 
      server,
      path: "/gameserver", // Use a specific path for our game WebSockets
      // Add error handling for WebSocket server
      clientTracking: true,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        concurrencyLimit: 10,
        threshold: 1024
      }
    });
    
    this.rooms = new Map();
    
    // Create tick manager for optimized game state updates
    this.tickManager = new ServerTickManager(this.rooms, 15); // 15 ticks per second
    
    this.setupSocketServer();
    this.startPingInterval();
    
    // Add error handler for the WebSocket server
    this.wss.on('error', (error) => {
      console.error('WebSocket Server Error:', error);
    });
  }
  
  private setupSocketServer() {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("New client connected");
      
      // Create a unique ID for this client
      const clientId = this.generateClientId();
      
      // Associate client ID with socket
      (ws as any).clientId = clientId;
      
      // Set up message handler
      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error("Error parsing message:", error);
          this.sendError(ws, "Invalid message format");
        }
      });
      
      // Handle disconnections
      ws.on("close", () => {
        console.log(`Client ${clientId} disconnected`);
        this.handleClientDisconnect(clientId);
      });
      
      // Send initial connection acknowledgment with timestamp for latency calculation
      this.sendToClient(ws, {
        type: "connection",
        clientId,
        timestamp: Date.now(),
        success: true
      });
    });
    
    // Start the tick manager when server is ready
    this.tickManager.start();
    console.log("WebSocket server initialized with tick-based synchronization");
  }
  
  /**
   * Start periodic ping to measure client latency
   */
  private startPingInterval() {
    // Send ping every 3 seconds to measure latency
    this.pingInterval = setInterval(() => {
      // For each room, ping all clients
      this.rooms.forEach(room => {
        // Get all players in the room
        const playerIds = Array.from(room.getPlayerIds ? room.getPlayerIds() : []);
        playerIds.forEach(playerId => {
          if (room.pingPlayer) {
            room.pingPlayer(playerId);
          }
        });
      });
    }, 3000);
  }
  
  private handleMessage(ws: WebSocket, data: any) {
    const clientId = (ws as any).clientId;
    
    // Handle different message types
    switch (data.type) {
      case "joinRoom":
        this.handleJoinRoom(ws, clientId, data);
        break;
        
      case "leaveRoom":
        this.handleLeaveRoom(clientId, data.roomCode);
        break;
        
      case "updatePlayer":
        this.handleUpdatePlayer(clientId, data);
        break;
        
      case "startGame":
        this.handleStartGame(clientId, data.roomCode);
        break;
        
      case "gameEvent":
        this.handleGameEvent(clientId, data);
        break;
        
      case "pong":
        this.handlePongResponse(clientId, data);
        break;
        
      case "reconnect":
        this.handleReconnection(ws, clientId, data);
        break;
        
      default:
        console.warn(`Unknown message type: ${data.type}`);
        this.sendError(ws, `Unknown message type: ${data.type}`);
    }
  }
  
  /**
   * Handle ping response from client for latency measurement
   */
  private handlePongResponse(clientId: string, data: any) {
    const { roomCode, timestamp } = data;
    
    if (!roomCode || !this.rooms.has(roomCode)) {
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    
    // Process pong to update latency data
    if (room.processPong && timestamp) {
      room.processPong(clientId, timestamp);
    }
  }
  
  /**
   * Handle client reconnection with token
   */
  private handleReconnection(ws: WebSocket, clientId: string, data: any) {
    const { roomCode, playerId, reconnectToken } = data;
    
    if (!roomCode || !this.rooms.has(roomCode) || !playerId || !reconnectToken) {
      this.sendError(ws, "Invalid reconnection data");
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    
    // Try to reconnect using token
    if (room.reconnectPlayer && room.reconnectPlayer(playerId, reconnectToken, ws)) {
      // Update the websocket's clientId to match the reconnected playerId
      (ws as any).clientId = playerId;
      
      // Send success response
      this.sendToClient(ws, {
        type: "reconnectSuccess",
        playerId,
        roomCode
      });
      
      console.log(`Player ${playerId} successfully reconnected to room ${roomCode}`);
      
      // Broadcast room update to all players
      this.broadcastRoomUpdate(roomCode);
    } else {
      this.sendError(ws, "Reconnection failed: invalid token");
    }
  }
  
  private handleJoinRoom(ws: WebSocket, clientId: string, data: any) {
    const { roomCode, username } = data;
    
    // Validate room code
    if (!roomCode) {
      this.sendError(ws, "Room code is required");
      return;
    }
    
    // Create room if it doesn't exist
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new GameRoom(roomCode));
    }
    
    const room = this.rooms.get(roomCode)!;
    
    // Check if room is full
    if (room.isFull()) {
      this.sendError(ws, "Room is full");
      return;
    }
    
    // Check if game already started
    if (room.isGameStarted()) {
      this.sendError(ws, "Game already in progress");
      return;
    }
    
    // Create player
    const player = new Player(clientId, username || `Player${clientId.substring(0, 4)}`);
    
    // Add player to room
    room.addPlayer(player, ws);
    
    // Send room state to all players
    this.broadcastRoomUpdate(roomCode);
    
    console.log(`Player ${clientId} joined room ${roomCode}`);
  }
  
  private handleLeaveRoom(clientId: string, roomCode: string) {
    if (!roomCode || !this.rooms.has(roomCode)) {
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    
    // Remove player from room
    room.removePlayer(clientId);
    
    // If room is empty, remove it
    if (room.isEmpty()) {
      this.rooms.delete(roomCode);
      console.log(`Room ${roomCode} removed (empty)`);
    } else {
      // Otherwise, broadcast room update
      this.broadcastRoomUpdate(roomCode);
    }
    
    console.log(`Player ${clientId} left room ${roomCode}`);
  }
  
  private handleUpdatePlayer(clientId: string, data: any) {
    const { roomCode, faction, ready } = data;
    
    if (!roomCode || !this.rooms.has(roomCode)) {
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    const player = room.getPlayer(clientId);
    
    if (!player) {
      return;
    }
    
    // Update player data
    if (faction !== undefined) {
      player.setFaction(faction);
    }
    
    if (ready !== undefined) {
      player.setReady(ready);
    }
    
    // Broadcast room update
    this.broadcastRoomUpdate(roomCode);
  }
  
  private handleStartGame(clientId: string, roomCode: string) {
    if (!roomCode || !this.rooms.has(roomCode)) {
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    
    // Check if game can be started
    if (!room.canStartGame()) {
      // Find the host's socket
      const hostSocket = room.getPlayerSocket(clientId);
      if (hostSocket) {
        this.sendError(hostSocket, "Cannot start game: not all players are ready");
      }
      return;
    }
    
    // Start the game
    room.startGame();
    
    // Broadcast game start
    room.broadcastToAll({
      type: "gameStart",
      gameData: room.getGameData()
    });
    
    console.log(`Game started in room ${roomCode}`);
  }
  
  private handleGameEvent(clientId: string, data: any) {
    const { roomCode, eventType, ...eventData } = data;
    
    if (!roomCode || !this.rooms.has(roomCode)) {
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    
    // Process the game event
    room.processGameEvent({
      playerId: clientId,
      type: eventType,
      ...eventData
    });
  }
  
  private handleClientDisconnect(clientId: string) {
    // Check all rooms for this client
    this.rooms.forEach((room, roomCode) => {
      if (room.hasPlayer(clientId)) {
        this.handleLeaveRoom(clientId, roomCode);
      }
    });
  }
  
  private broadcastRoomUpdate(roomCode: string) {
    if (!this.rooms.has(roomCode)) {
      return;
    }
    
    const room = this.rooms.get(roomCode)!;
    
    room.broadcastToAll({
      type: "roomUpdate",
      room: room.getRoomData()
    });
  }
  
  private sendToClient(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
  
  private sendError(ws: WebSocket, message: string) {
    this.sendToClient(ws, {
      type: "error",
      message
    });
  }
  
  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export function setupSocketServer(server: Server): SocketServer {
  return new SocketServer(server);
}
