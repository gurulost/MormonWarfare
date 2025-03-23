import { create } from "zustand";
import { FactionType, MultiplayerEvent } from "../../game/types";
import { SOCKET_EVENTS } from "../../game/config";

interface MultiplayerState {
  connected: boolean;
  socket: WebSocket | null;
  roomCode: string | null;
  players: Array<{
    id: string;
    username: string;
    faction: FactionType | null;
    ready: boolean;
  }>;
  gameEventListeners: ((event: MultiplayerEvent) => void)[];
  
  // Socket connection
  connectToServer: () => void;
  disconnectFromServer: () => void;
  
  // Room management
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  
  // Player actions
  updateFaction: (faction: FactionType) => void;
  updateReadyState: (ready: boolean) => void;
  
  // Game actions
  startGame: () => void;
  moveUnits: (unitIds: string[], targetX: number, targetY: number) => void;
  createUnit: (playerId: string, type: string, x: number, y: number) => void;
  createBuilding: (playerId: string, type: string, x: number, y: number) => void;
  updateResources: (resources: { food: number; ore: number }) => void;
  researchTech: (techId: string) => void;
  
  // Event listeners
  subscribeToGameEvents: (listener: (event: MultiplayerEvent) => void) => () => void;
}

export const useMultiplayer = create<MultiplayerState>((set, get) => ({
  connected: false,
  socket: null,
  roomCode: null,
  players: [],
  gameEventListeners: [],
  
  connectToServer: () => {
    console.log("Connecting to multiplayer server...");
    
    try {
      // Create actual WebSocket connection (use secure connection if in production)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      // Use the specific path that matches our server WebSocket configuration
      const socket = new WebSocket(`${protocol}//${host}/gameserver`);
      
      socket.onopen = () => {
        console.log("WebSocket connection established");
        set({ connected: true, socket });
      };
      
      socket.onclose = () => {
        console.log("WebSocket connection closed");
        set({ connected: false, socket: null });
        
        // Try to reconnect after delay
        setTimeout(() => {
          const state = get();
          if (!state.connected && state.roomCode) {
            console.log("Attempting to reconnect...");
            get().connectToServer();
          }
        }, 3000);
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          console.error("Error parsing server message:", error);
        }
      };
      
      set({ socket });
    } catch (error) {
      console.error("Failed to connect to server:", error);
      
      // Fallback to mock socket for development without server
      console.log("Using mock socket for development");
      const mockSocket = {
        send: (data: string) => {
          console.log("Sending data to server (mock):", data);
        },
        close: () => {
          console.log("Disconnecting from server (mock)");
        }
      };
      
      set({ 
        connected: true,
        socket: mockSocket as any
      });
    }
    
    console.log("Connected to multiplayer server");
  },
  
  disconnectFromServer: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
    }
    
    set({ 
      connected: false,
      socket: null,
      roomCode: null,
      players: []
    });
  },
  
  joinRoom: (roomCode: string) => {
    const { socket, connected } = get();
    
    if (!connected || !socket) {
      console.error("Cannot join room: not connected to server");
      return;
    }
    
    console.log(`Joining room: ${roomCode}`);
    
    // In a real implementation, this would send a message to the server
    // For now, simulate joining a room
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.JOIN_ROOM,
      roomCode
    }));
    
    // Simulate receiving players in the room
    const username = "Player" + Math.floor(Math.random() * 1000);
    set({
      roomCode,
      players: [
        { id: "local", username, faction: null, ready: false }
      ]
    });
  },
  
  leaveRoom: () => {
    const { socket, roomCode } = get();
    
    if (socket && roomCode) {
      socket.send(JSON.stringify({
        type: SOCKET_EVENTS.LEAVE_ROOM,
        roomCode
      }));
    }
    
    set({ 
      roomCode: null,
      players: []
    });
  },
  
  updateFaction: (faction: FactionType) => {
    const { socket, roomCode, players } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot update faction: not in a room");
      return;
    }
    
    // Send update to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.UPDATE_PLAYER,
      roomCode,
      faction
    }));
    
    // Update local state
    const updatedPlayers = players.map(player => {
      if (player.id === "local") {
        return { ...player, faction };
      }
      return player;
    });
    
    set({ players: updatedPlayers });
  },
  
  updateReadyState: (ready: boolean) => {
    const { socket, roomCode, players } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot update ready state: not in a room");
      return;
    }
    
    // Send update to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.UPDATE_PLAYER,
      roomCode,
      ready
    }));
    
    // Update local state
    const updatedPlayers = players.map(player => {
      if (player.id === "local") {
        return { ...player, ready };
      }
      return player;
    });
    
    set({ players: updatedPlayers });
  },
  
  startGame: () => {
    const { socket, roomCode } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot start game: not in a room");
      return;
    }
    
    // Send start game command to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.START_GAME,
      roomCode
    }));
  },
  
  moveUnits: (unitIds: string[], targetX: number, targetY: number) => {
    const { socket, roomCode } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot move units: not in a game");
      return;
    }
    
    // Send move command to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.GAME_EVENT,
      roomCode,
      eventType: "unitMove",
      unitIds,
      targetX,
      targetY
    }));
    
    // In a real implementation, the server would validate and broadcast this
    // For demo, we'll simulate the command being processed
    notifyGameEventListeners({
      type: "unitMove",
      unitIds,
      targetX,
      targetY
    });
  },
  
  createUnit: (playerId: string, type: string, x: number, y: number) => {
    const { socket, roomCode } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot create unit: not in a game");
      return;
    }
    
    // Send create unit command to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.GAME_EVENT,
      roomCode,
      eventType: "unitCreate",
      playerId,
      unitType: type,
      x,
      y
    }));
    
    // Simulate event broadcast
    notifyGameEventListeners({
      type: "unitCreate",
      playerId,
      unitType: type,
      x,
      y
    });
  },
  
  createBuilding: (playerId: string, type: string, x: number, y: number) => {
    const { socket, roomCode } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot create building: not in a game");
      return;
    }
    
    // Send create building command to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.GAME_EVENT,
      roomCode,
      eventType: "buildingCreate",
      playerId,
      buildingType: type,
      x,
      y
    }));
    
    // Simulate event broadcast
    notifyGameEventListeners({
      type: "buildingCreate",
      playerId,
      buildingType: type,
      x,
      y
    });
  },
  
  updateResources: (resources: { food: number; ore: number }) => {
    const { socket, roomCode } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot update resources: not in a game");
      return;
    }
    
    // Send resource update to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.GAME_EVENT,
      roomCode,
      eventType: "resourceUpdate",
      resources
    }));
    
    // Simulate event broadcast
    notifyGameEventListeners({
      type: "resourceUpdate",
      resources
    });
  },
  
  researchTech: (techId: string) => {
    const { socket, roomCode } = get();
    
    if (!socket || !roomCode) {
      console.error("Cannot research technology: not in a game");
      return;
    }
    
    // Send tech research command to server
    socket.send(JSON.stringify({
      type: SOCKET_EVENTS.GAME_EVENT,
      roomCode,
      eventType: "researchTech",
      techId
    }));
    
    // Simulate event broadcast
    notifyGameEventListeners({
      type: "researchTech",
      techId
    });
  },
  
  subscribeToGameEvents: (listener) => {
    const { gameEventListeners } = get();
    
    // Add new listener
    const updatedListeners = [...gameEventListeners, listener];
    set({ gameEventListeners: updatedListeners });
    
    // Return unsubscribe function
    return () => {
      const { gameEventListeners } = get();
      set({
        gameEventListeners: gameEventListeners.filter(l => l !== listener)
      });
    };
  }
}));

// Handle incoming server messages
function handleServerMessage(message: any) {
  const state = useMultiplayer.getState();
  
  switch (message.type) {
    case "connection":
      console.log("Connection acknowledged, client ID:", message.clientId);
      
      // Store connection data like reconnection tokens
      localStorage.setItem("clientId", message.clientId);
      
      // If we have a room saved from previous session, try to reconnect
      const savedRoomCode = localStorage.getItem("roomCode");
      const savedPlayerId = localStorage.getItem("playerId");
      const reconnectToken = localStorage.getItem("reconnectToken");
      
      if (savedRoomCode && savedPlayerId && reconnectToken && state.socket) {
        console.log("Attempting to reconnect to previous room:", savedRoomCode);
        state.socket.send(JSON.stringify({
          type: "reconnect",
          roomCode: savedRoomCode,
          playerId: savedPlayerId,
          reconnectToken
        }));
      }
      break;
      
    case "connection_data":
      // Store reconnection token securely
      if (message.reconnectToken && message.playerId) {
        localStorage.setItem("reconnectToken", message.reconnectToken);
        localStorage.setItem("playerId", message.playerId);
      }
      break;
      
    case "reconnectSuccess":
      console.log("Successfully reconnected to game");
      useMultiplayer.setState({ 
        roomCode: message.roomCode
      });
      localStorage.setItem("roomCode", message.roomCode);
      break;
      
    case "roomUpdate":
      console.log("Room update received:", message.room);
      useMultiplayer.setState({
        roomCode: message.room.roomCode,
        players: message.room.players
      });
      localStorage.setItem("roomCode", message.room.roomCode);
      break;
      
    case "gameStart":
      console.log("Game started:", message.gameData);
      // Forward game start event to listeners
      notifyGameEventListeners({
        type: "gameStart",
        gameData: message.gameData
      });
      break;
      
    case "gameEvent":
      // Forward game events to listeners
      notifyGameEventListeners(message.event);
      break;
      
    case "stateUpdate":
      // Process delta state updates
      processStateUpdate(message.changes, message.tick);
      break;
      
    case "ping":
      // Respond to ping with pong to measure latency
      respondToPing(message.timestamp);
      break;
      
    case "error":
      console.error("Server error:", message.message);
      break;
      
    default:
      console.warn("Unknown message type received:", message.type);
  }
}

// Process delta state updates from server
function processStateUpdate(changes: any, timestamp: number) {
  // Apply delta changes to game state
  const state = useMultiplayer.getState();
  
  // Notify listeners of state update
  notifyGameEventListeners({
    type: "stateUpdate",
    changes,
    timestamp
  });
}

// Respond to ping with pong
function respondToPing(timestamp: number) {
  const state = useMultiplayer.getState();
  const { socket, roomCode } = state;
  
  if (socket && roomCode) {
    socket.send(JSON.stringify({
      type: "pong",
      roomCode,
      timestamp
    }));
  }
}

// Helper function to notify all game event listeners
function notifyGameEventListeners(event: MultiplayerEvent) {
  const state = useMultiplayer.getState();
  state.gameEventListeners.forEach(listener => {
    listener(event);
  });
}
