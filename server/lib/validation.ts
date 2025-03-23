import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
// Define faction type inline to avoid import issues
const factionValues = ['Nephites', 'Lamanites'] as const;
type FactionType = typeof factionValues[number];

// Base message schema for all incoming socket messages
const baseMessageSchema = z.object({
  type: z.string({
    required_error: "Message type is required",
    invalid_type_error: "Message type must be a string"
  })
});

// Join room message schema
export const joinRoomSchema = baseMessageSchema.extend({
  type: z.literal('joinRoom'),
  roomCode: z.string().min(3).max(10),
  username: z.string().min(2).max(20).optional()
});

// Leave room message schema
export const leaveRoomSchema = baseMessageSchema.extend({
  type: z.literal('leaveRoom'),
  roomCode: z.string().min(3).max(10)
});

// Update player message schema
export const updatePlayerSchema = baseMessageSchema.extend({
  type: z.literal('updatePlayer'),
  roomCode: z.string().min(3).max(10),
  faction: z.enum(['Nephites', 'Lamanites']).optional(),
  ready: z.boolean().optional()
});

// Start game message schema
export const startGameSchema = baseMessageSchema.extend({
  type: z.literal('startGame'),
  roomCode: z.string().min(3).max(10)
});

// Unit move event schema
export const unitMoveEventSchema = baseMessageSchema.extend({
  type: z.literal('gameEvent'),
  roomCode: z.string().min(3).max(10),
  eventType: z.literal('unitMove'),
  unitIds: z.array(z.string()),
  targetX: z.number().int(),
  targetY: z.number().int()
});

// Unit create event schema
export const unitCreateEventSchema = baseMessageSchema.extend({
  type: z.literal('gameEvent'),
  roomCode: z.string().min(3).max(10),
  eventType: z.literal('unitCreate'),
  playerId: z.string(),
  unitType: z.string(),
  x: z.number().int(),
  y: z.number().int()
});

// Building create event schema
export const buildingCreateEventSchema = baseMessageSchema.extend({
  type: z.literal('gameEvent'),
  roomCode: z.string().min(3).max(10),
  eventType: z.literal('buildingCreate'),
  playerId: z.string(),
  buildingType: z.string(),
  x: z.number().int(),
  y: z.number().int()
});

// Resource update event schema
export const resourceUpdateEventSchema = baseMessageSchema.extend({
  type: z.literal('gameEvent'),
  roomCode: z.string().min(3).max(10),
  eventType: z.literal('resourceUpdate'),
  resources: z.object({
    food: z.number().nonnegative(),
    ore: z.number().nonnegative()
  })
});

// Research tech event schema
export const researchTechEventSchema = baseMessageSchema.extend({
  type: z.literal('gameEvent'),
  roomCode: z.string().min(3).max(10),
  eventType: z.literal('researchTech'),
  techId: z.string()
});

// Attack event schema
export const attackEventSchema = baseMessageSchema.extend({
  type: z.literal('gameEvent'),
  roomCode: z.string().min(3).max(10),
  eventType: z.literal('attack'),
  attackerIds: z.array(z.string()),
  targetId: z.string()
});

// Pong message schema for latency measurement
export const pongSchema = baseMessageSchema.extend({
  type: z.literal('pong'),
  roomCode: z.string().min(3).max(10),
  timestamp: z.number()
});

// Reconnect message schema
export const reconnectSchema = baseMessageSchema.extend({
  type: z.literal('reconnect'),
  roomCode: z.string().min(3).max(10),
  playerId: z.string(),
  reconnectToken: z.string()
});

// Combined event schema
export const gameEventSchema = z.discriminatedUnion('eventType', [
  unitMoveEventSchema.omit({ type: true }),
  unitCreateEventSchema.omit({ type: true }),
  buildingCreateEventSchema.omit({ type: true }),
  resourceUpdateEventSchema.omit({ type: true }),
  researchTechEventSchema.omit({ type: true }),
  attackEventSchema.omit({ type: true })
]);

// A function that validates incoming messages and returns proper error messages
export function validateMessage(message: unknown, schema: z.ZodSchema) {
  try {
    return { 
      success: true, 
      data: schema.parse(message) 
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return { 
        success: false, 
        error: validationError.message
      };
    }
    return { 
      success: false, 
      error: 'Invalid message format' 
    };
  }
}

// A utility function that returns the appropriate schema based on message type
export function getSchemaForMessageType(type: string, eventType?: string) {
  switch (type) {
    case 'joinRoom':
      return joinRoomSchema;
    case 'leaveRoom':
      return leaveRoomSchema;
    case 'updatePlayer':
      return updatePlayerSchema;
    case 'startGame':
      return startGameSchema;
    case 'gameEvent':
      if (!eventType) {
        return null;
      }
      switch (eventType) {
        case 'unitMove':
          return unitMoveEventSchema;
        case 'unitCreate':
          return unitCreateEventSchema;
        case 'buildingCreate':
          return buildingCreateEventSchema;
        case 'resourceUpdate':
          return resourceUpdateEventSchema;
        case 'researchTech':
          return researchTechEventSchema;
        case 'attack':
          return attackEventSchema;
        default:
          return null;
      }
    case 'pong':
      return pongSchema;
    case 'reconnect':
      return reconnectSchema;
    default:
      return null;
  }
}

/**
 * Validates that coordinates are within the game map bounds
 * @param x X coordinate
 * @param y Y coordinate
 * @param mapSize Size of the map (default: 50x50)
 * @returns True if coordinates are valid
 */
export function validateMapCoordinates(x: number, y: number, mapSize: number = 50): boolean {
  return x >= 0 && x < mapSize && y >= 0 && y < mapSize;
}

/**
 * Validates that a player has sufficient resources for an action
 * @param playerResources Current player resources
 * @param requiredFood Food required for action
 * @param requiredOre Ore required for action
 * @returns True if player has sufficient resources
 */
export function validateResourceRequirement(
  playerResources: { food: number; ore: number },
  requiredFood: number,
  requiredOre: number
): boolean {
  return playerResources.food >= requiredFood && playerResources.ore >= requiredOre;
}

/**
 * Validates that the specified entities exist and belong to the player
 * @param entityIds Array of entity IDs to check
 * @param entityMap Map of all entities
 * @param playerId ID of the player
 * @returns True if all entities exist and belong to the player
 */
export function validateEntityOwnership<T extends { playerId: string }>(
  entityIds: string[],
  entityMap: Map<string, T>,
  playerId: string
): boolean {
  return entityIds.every(id => {
    const entity = entityMap.get(id);
    return entity && entity.playerId === playerId;
  });
}

/**
 * Create an error response with a standardized format
 * @param code Error code
 * @param message Error message
 * @returns Standardized error object
 */
export function createErrorResponse(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message
    }
  };
}