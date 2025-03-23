import { create } from "zustand";
import { FactionType, MultiplayerEvent } from "../../game/types";
import { SOCKET_EVENTS } from "../../game/config";

interface PendingAction {
  type: string;
  timestamp: number;
  data: any;
}

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
  
  // Improved server-client synchronization
  lastServerTimestamp: number;
  pendingActions: PendingAction[];
  clientPrediction: boolean;
  serverReconciliation: boolean;
  networkLatency: number;
  
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
  
  // Improved synchronization properties
  lastServerTimestamp: 0,
  pendingActions: [],
  clientPrediction: true, // Enable client-side prediction by default
  serverReconciliation: true, // Enable server reconciliation by default
  networkLatency: 0, // Track network latency for better prediction
  
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
    const state = get();
    const { socket, roomCode, clientPrediction } = state;
    
    if (!socket || !roomCode) {
      console.error("Cannot move units: not in a game");
      return;
    }
    
    // Create an action ID for tracking this command
    const actionId = `move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    // Create the move command
    const moveCommand = {
      type: SOCKET_EVENTS.GAME_EVENT,
      roomCode,
      eventType: "unitMove",
      unitIds,
      targetX,
      targetY,
      actionId, // Include the action ID for tracking
      timestamp // Include the timestamp for reconciliation
    };
    
    // Send move command to server
    socket.send(JSON.stringify(moveCommand));
    
    // Add to pending actions for reconciliation
    if (state.serverReconciliation) {
      state.pendingActions.push({
        type: "unitMove",
        timestamp,
        data: { unitIds, targetX, targetY, actionId }
      });
    }
    
    // Apply client-side prediction immediately if enabled
    if (clientPrediction) {
      console.log("Applying client-side prediction for unit movement");
      notifyGameEventListeners({
        type: "unitMove",
        unitIds,
        targetX,
        targetY,
        isPrediction: true
      });
    }
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
  
  // Store the server timestamp for reconciliation
  state.lastServerTimestamp = timestamp;
  
  // Track which predictions were confirmed by server
  if (state.pendingActions.length > 0 && state.serverReconciliation) {
    // Look for confirmed actions in the server update
    let actionConfirmations: string[] = [];
    
    // Extract unit move confirmations from changes
    if (changes.units) {
      Object.values(changes.units).forEach((unit: any) => {
        if (unit && unit.lastMoveAction && unit.lastMoveAction.actionId) {
          actionConfirmations.push(unit.lastMoveAction.actionId);
        }
      });
    }
    
    // Check for other types of confirmations in the future...
    
    // Filter out actions that have been confirmed by the server
    if (actionConfirmations.length > 0) {
      console.log(`Server confirmed ${actionConfirmations.length} actions`);
      
      state.pendingActions = state.pendingActions.filter(action => {
        // Keep action if it's not in the confirmed list
        if (action.data && action.data.actionId) {
          return !actionConfirmations.includes(action.data.actionId);
        }
        // For actions without IDs, use time-based filtering as fallback
        return action.timestamp > timestamp - 500; // Keep only very recent actions
      });
    } else {
      // Fallback to time-based filtering if no explicit confirmations
      state.pendingActions = state.pendingActions.filter(action => 
        action.timestamp > timestamp - 500 // Keep only very recent actions
      );
    }
    
    // If we have remaining pending actions that should be reapplied
    if (state.pendingActions.length > 0) {
      console.log(`${state.pendingActions.length} pending actions need to be reapplied after server update`);
      
      // Schedule reapplication on next frame to allow state update to complete first
      setTimeout(() => {
        const currentState = useMultiplayer.getState();
        currentState.pendingActions.forEach(action => {
          console.log(`Reapplying action: ${action.type}`);
          
          // Reapply the action based on type
          if (action.type === "unitMove" && action.data) {
            notifyGameEventListeners({
              type: "unitMove",
              unitIds: action.data.unitIds,
              targetX: action.data.targetX,
              targetY: action.data.targetY,
              isPrediction: true,
              isReapplied: true
            });
          }
          // Add other action types as needed
        });
      }, 0);
    }
  }
  
  // Notify listeners of state update
  notifyGameEventListeners({
    type: "stateUpdate",
    changes,
    timestamp
  });
}

// Respond to ping with pong and track network latency
function respondToPing(timestamp: number) {
  const state = useMultiplayer.getState();
  const { socket, roomCode } = state;
  
  if (socket && roomCode) {
    // Calculate current time before sending response
    const currentTime = Date.now();
    
    // Calculate one-way latency approximation (half of the round trip)
    const oneWayLatency = Math.floor((currentTime - timestamp) / 2);
    
    // Update latency in state (with some smoothing to avoid jitter)
    const newLatency = state.networkLatency === 0 
      ? oneWayLatency 
      : Math.floor(state.networkLatency * 0.7 + oneWayLatency * 0.3);
      
    useMultiplayer.setState({ networkLatency: newLatency });
    
    // Send pong response with original timestamp for server to calculate round-trip time
    socket.send(JSON.stringify({
      type: "pong",
      roomCode,
      timestamp,
      clientTime: currentTime // Include client time for more precise latency calculation
    }));
    
    // Log latency for debugging (can be removed in production)
    if (oneWayLatency > 100) {
      console.warn(`Network latency is high: ${oneWayLatency}ms`);
    }
  }
}

// Helper function to notify all game event listeners
function notifyGameEventListeners(event: MultiplayerEvent) {
  const state = useMultiplayer.getState();
  state.gameEventListeners.forEach(listener => {
    listener(event);
  });
}
