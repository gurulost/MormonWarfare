import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { GameRoom } from "./game/GameRoom";
import { Player } from "./game/Player";

export class SocketServer {
  private wss: WebSocketServer;
  private rooms: Map<string, GameRoom>;
  
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.rooms = new Map();
    
    this.setupSocketServer();
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
      
      // Send initial connection acknowledgment
      this.sendToClient(ws, {
        type: "connection",
        clientId,
        success: true
      });
    });
    
    console.log("WebSocket server initialized");
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
        
      default:
        console.warn(`Unknown message type: ${data.type}`);
        this.sendError(ws, `Unknown message type: ${data.type}`);
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
