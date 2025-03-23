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
    // In a real implementation, this would connect to a WebSocket server
    // For now, we'll simulate it
    console.log("Connecting to multiplayer server...");
    
    // Create a simulated socket
    const mockSocket = {
      send: (data: string) => {
        console.log("Sending data to server:", data);
      },
      close: () => {
        console.log("Disconnecting from server");
      }
    };
    
    set({ 
      connected: true,
      socket: mockSocket as any
    });
    
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

// Helper function to notify all game event listeners
function notifyGameEventListeners(event: MultiplayerEvent) {
  const state = useMultiplayer.getState();
  state.gameEventListeners.forEach(listener => {
    listener(event);
  });
}
