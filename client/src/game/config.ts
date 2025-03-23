// Game configuration constants

// Map & Rendering
export const TILE_SIZE = 32;
export const MAP_SIZE = 50; // 50x50 tiles map
export const CAMERA_SPEED = 400; // pixels per second

// UI
export const UI_PANEL_HEIGHT = 150;
export const MINIMAP_SIZE = 150;
export const RESOURCE_PANEL_HEIGHT = 30;

// Game mechanics - refined for better balance
export const RESOURCE_GATHER_RATE = 3; // Reduced base gather rate for more strategic decisions
export const RESOURCE_DECAY_RATE = 0.05; // Resources slowly deplete over time (5% per gather)
export const RESOURCE_CARRY_CAPACITY = {
  worker: 15,  // Max resources a worker can carry before returning to deposit
  hero: 8      // Heroes can gather a small amount in emergencies
};
export const FACTION_GATHER_BONUSES = {
  Nephites: { food: 1.25, ore: 0.9 },  // Nephites are better at farming
  Lamanites: { food: 0.9, ore: 1.25 }  // Lamanites are better at mining
};

export const COMBAT_UPDATE_RATE = 500; // ms between combat updates
export const UNIT_PRODUCTION_TIME = 10000; // ms to produce a unit
export const BUILDING_PRODUCTION_TIME = 15000; // ms to produce a building

// Unit stats base values with counter system (rock-paper-scissors)
export const UNIT_STATS = {
  worker: {
    health: 50,
    attack: 3,
    defense: 1,
    range: 1,
    speed: 100,
    cost: { food: 50, ore: 0 },
    description: "Gathers resources and builds structures. Weak in combat.",
    role: "economy"
  },
  melee: {
    health: 100,
    attack: 15,
    defense: 10,
    range: 1,
    speed: 80,
    cost: { food: 75, ore: 50 },
    description: "Strong warriors that excel against ranged units but vulnerable to cavalry.",
    role: "combat",
    counters: ["ranged"], // Melee counters ranged
    weakTo: ["cavalry"]   // Melee is weak to cavalry
  },
  ranged: {
    health: 60,
    attack: 12,
    defense: 3,
    range: 4,
    speed: 70,
    cost: { food: 60, ore: 80 },
    description: "Archers that excel against cavalry but vulnerable to melee warriors.",
    role: "combat",
    counters: ["cavalry"], // Ranged counters cavalry
    weakTo: ["melee"]      // Ranged is weak to melee
  },
  cavalry: {
    health: 85,
    attack: 14,
    defense: 7,
    range: 1,
    speed: 120,
    cost: { food: 90, ore: 60 },
    description: "Fast mounted warriors that excel against melee units but vulnerable to archers.",
    role: "combat",
    counters: ["melee"],  // Cavalry counters melee
    weakTo: ["ranged"]    // Cavalry is weak to ranged
  },
  hero: {
    health: 200,
    attack: 25,
    defense: 15,
    range: 2,
    speed: 90,
    cost: { food: 200, ore: 200 },
    description: "Powerful leader unit with special abilities. No direct counter.",
    role: "special"
  }
};

// Counter system damage multipliers
export const COUNTER_DAMAGE_MULTIPLIER = 1.5; // 50% more damage when using counter unit
export const WEAKNESS_DAMAGE_MULTIPLIER = 1.25; // 25% more damage when attacking unit's weakness

// Building stats base values
export const BUILDING_STATS = {
  cityCenter: {
    health: 1000,
    defense: 15,
    size: 3,
    cost: { food: 0, ore: 0 }
  },
  barracks: {
    health: 600,
    defense: 12,
    size: 2,
    cost: { food: 100, ore: 150 }
  },
  archeryRange: {
    health: 500,
    defense: 8,
    size: 2,
    cost: { food: 150, ore: 100 }
  },
  wall: {
    health: 800,
    defense: 20,
    size: 1,
    cost: { food: 50, ore: 200 }
  }
};

// Faction bonuses
export const FACTION_BONUSES = {
  Nephites: {
    defense: 2,
    buildingDefense: 5,
    wallHealthBonus: 200
  },
  Lamanites: {
    attack: 3,
    meleeAttackBonus: 2,
    startingResources: { food: 100, ore: 50 }
  }
};

// Tech tree
export const TECH_COSTS = {
  basic: { food: 100, ore: 50 },
  advanced: { food: 200, ore: 150 },
  elite: { food: 300, ore: 250 }
};

// Multiplayer
export const MAX_PLAYERS = 4;
export const SOCKET_EVENTS = {
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  UPDATE_PLAYER: 'updatePlayer',
  START_GAME: 'startGame',
  GAME_EVENT: 'gameEvent',
  ROOM_UPDATE: 'roomUpdate',
  GAME_UPDATE: 'gameUpdate',
  ERROR: 'error'
};
