import { Player } from "./Player";
import { GameEvent, GameEventType } from "../../shared/types";
import { MAP_SIZE, BUILDING_STATS, UNIT_STATS } from "../../client/src/game/config";

export class GameState {
  private players: Map<string, Player>;
  private units: Map<string, any>;
  private buildings: Map<string, any>;
  private map: any[][];
  private nextUnitId: number;
  private nextBuildingId: number;
  
  constructor(players: Map<string, Player>) {
    this.players = new Map(players);
    this.units = new Map();
    this.buildings = new Map();
    this.nextUnitId = 1;
    this.nextBuildingId = 1;
    
    // Generate map
    this.map = this.generateMap();
    
    // Initialize starting resources based on faction
    this.initializePlayerResources();
    
    // Create starting units and buildings
    this.setupStartingEntities();
  }
  
  processEvent(event: GameEvent): boolean {
    const { playerId, type } = event;
    
    // Check if player exists
    if (!this.players.has(playerId)) {
      console.warn(`Unknown player: ${playerId}`);
      return false;
    }
    
    // Process event based on type
    switch (type as GameEventType) {
      case "unitMove":
        return this.handleUnitMove(event);
        
      case "unitCreate":
        return this.handleUnitCreate(event);
        
      case "buildingCreate":
        return this.handleBuildingCreate(event);
        
      case "resourceUpdate":
        return this.handleResourceUpdate(event);
        
      case "researchTech":
        return this.handleResearchTech(event);
        
      case "attack":
        return this.handleAttack(event);
        
      default:
        console.warn(`Unknown event type: ${type}`);
        return false;
    }
  }
  
  private handleUnitMove(event: GameEvent): boolean {
    const { unitIds, targetX, targetY } = event;
    
    // Validate target position
    if (
      !this.isValidPosition(targetX, targetY) ||
      !this.isWalkable(targetX, targetY)
    ) {
      return false;
    }
    
    // In a full implementation, this would update unit positions
    // For now, just return true to indicate success
    return true;
  }
  
  private handleUnitCreate(event: GameEvent): boolean {
    const { playerId, unitType, x, y } = event;
    
    // Validate position
    if (!this.isValidPosition(x, y) || !this.isWalkable(x, y)) {
      return false;
    }
    
    // Check if player has enough resources
    const player = this.players.get(playerId);
    if (!player) return false;
    
    const unitCost = UNIT_STATS[unitType as keyof typeof UNIT_STATS]?.cost;
    if (!unitCost) return false;
    
    if (!player.hasEnoughResources(unitCost.food, unitCost.ore)) {
      return false;
    }
    
    // Deduct resources
    player.deductResources(unitCost.food, unitCost.ore);
    
    // Create unit
    const unitId = `unit_${playerId}_${this.nextUnitId++}`;
    this.units.set(unitId, {
      id: unitId,
      type: unitType,
      playerId,
      x,
      y,
      health: 100,
      maxHealth: 100
    });
    
    return true;
  }
  
  private handleBuildingCreate(event: GameEvent): boolean {
    const { playerId, buildingType, x, y } = event;
    
    // Validate position
    if (!this.isValidPosition(x, y)) {
      return false;
    }
    
    // Get building size
    const buildingSize = BUILDING_STATS[buildingType as keyof typeof BUILDING_STATS]?.size || 2;
    
    // Check if area is clear
    for (let dx = -Math.floor(buildingSize/2); dx <= Math.floor(buildingSize/2); dx++) {
      for (let dy = -Math.floor(buildingSize/2); dy <= Math.floor(buildingSize/2); dy++) {
        const checkX = x + dx;
        const checkY = y + dy;
        
        if (!this.isValidPosition(checkX, checkY) || !this.isWalkable(checkX, checkY)) {
          return false;
        }
      }
    }
    
    // Check if player has enough resources
    const player = this.players.get(playerId);
    if (!player) return false;
    
    const buildingCost = BUILDING_STATS[buildingType as keyof typeof BUILDING_STATS]?.cost;
    if (!buildingCost) return false;
    
    if (!player.hasEnoughResources(buildingCost.food, buildingCost.ore)) {
      return false;
    }
    
    // Deduct resources
    player.deductResources(buildingCost.food, buildingCost.ore);
    
    // Create building
    const buildingId = `building_${playerId}_${this.nextBuildingId++}`;
    this.buildings.set(buildingId, {
      id: buildingId,
      type: buildingType,
      playerId,
      x,
      y,
      health: 100,
      maxHealth: 100
    });
    
    // Mark tiles as occupied
    for (let dx = -Math.floor(buildingSize/2); dx <= Math.floor(buildingSize/2); dx++) {
      for (let dy = -Math.floor(buildingSize/2); dy <= Math.floor(buildingSize/2); dy++) {
        const tileX = x + dx;
        const tileY = y + dy;
        
        if (this.isValidPosition(tileX, tileY)) {
          this.map[tileY][tileX].walkable = false;
        }
      }
    }
    
    return true;
  }
  
  private handleResourceUpdate(event: GameEvent): boolean {
    const { playerId, resources } = event;
    
    const player = this.players.get(playerId);
    if (!player) return false;
    
    // Update player resources
    player.setResources(resources);
    
    return true;
  }
  
  private handleResearchTech(event: GameEvent): boolean {
    const { playerId, techId } = event;
    
    // In a full implementation, this would check tech prerequisites,
    // deduct resources, and apply research effects
    // For now, just return true to indicate success
    return true;
  }
  
  private handleAttack(event: GameEvent): boolean {
    const { attackerId, targetId } = event;
    
    // In a full implementation, this would handle combat
    // For now, just return true to indicate success
    return true;
  }
  
  private generateMap(): any[][] {
    const map = [];
    
    // Create empty map
    for (let y = 0; y < MAP_SIZE; y++) {
      map[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        // Default to grass
        let terrainType: 'grass' | 'forest' | 'hills' | 'water' = 'grass';
        
        // Create simple terrain patterns
        const noise = Math.random();
        if (noise < 0.1) {
          terrainType = 'water';
        } else if (noise < 0.3) {
          terrainType = 'forest';
        } else if (noise < 0.4) {
          terrainType = 'hills';
        }
        
        map[y][x] = {
          x,
          y,
          type: terrainType,
          walkable: terrainType !== 'water',
          resource: null
        };
        
        // Add resources with some probability
        if (terrainType !== 'water') {
          if (terrainType === 'forest' && Math.random() < 0.4) {
            this.addResource(map, x, y, 'food');
          } else if (terrainType === 'hills' && Math.random() < 0.6) {
            this.addResource(map, x, y, 'ore');
          }
        }
      }
    }
    
    return map;
  }
  
  private addResource(map: any[][], x: number, y: number, type: 'food' | 'ore'): void {
    map[y][x].resource = {
      type,
      amount: type === 'food' ? 300 : 500 // Ore has more resources
    };
  }
  
  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE;
  }
  
  private isWalkable(x: number, y: number): boolean {
    if (!this.isValidPosition(x, y)) {
      return false;
    }
    
    return this.map[y][x].walkable;
  }
  
  private initializePlayerResources(): void {
    this.players.forEach(player => {
      const faction = player.getFaction();
      
      // Set starting resources based on faction
      let startingFood = 200;
      let startingOre = 100;
      
      // Faction bonuses
      if (faction === "Lamanites") {
        // Lamanites start with more resources
        startingFood += 100;
        startingOre += 50;
      }
      
      player.setResources({ food: startingFood, ore: startingOre });
    });
  }
  
  private setupStartingEntities(): void {
    // Determine starting positions for each player
    const startPositions = [
      { x: 5, y: 5 },
      { x: MAP_SIZE - 10, y: MAP_SIZE - 10 },
      { x: 5, y: MAP_SIZE - 10 },
      { x: MAP_SIZE - 10, y: 5 }
    ];
    
    let playerIndex = 0;
    this.players.forEach(player => {
      const startPos = startPositions[playerIndex % startPositions.length];
      playerIndex++;
      
      // Clear area around starting position
      this.clearAreaForStartingPosition(startPos.x, startPos.y);
      
      // Create city center
      const cityCenterId = `building_${player.id}_${this.nextBuildingId++}`;
      this.buildings.set(cityCenterId, {
        id: cityCenterId,
        type: "cityCenter",
        playerId: player.id,
        x: startPos.x,
        y: startPos.y,
        health: 1000,
        maxHealth: 1000
      });
      
      // Mark tiles as occupied by the city center (3x3)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tileX = startPos.x + dx;
          const tileY = startPos.y + dy;
          
          if (this.isValidPosition(tileX, tileY)) {
            this.map[tileY][tileX].walkable = false;
          }
        }
      }
      
      // Create initial workers
      for (let w = 0; w < 3; w++) {
        const workerX = startPos.x + Math.cos(w * 2.1) * 2;
        const workerY = startPos.y + Math.sin(w * 2.1) * 2;
        
        // Round to valid tile position
        const tileX = Math.floor(workerX);
        const tileY = Math.floor(workerY);
        
        if (this.isValidPosition(tileX, tileY) && this.isWalkable(tileX, tileY)) {
          const workerId = `unit_${player.id}_${this.nextUnitId++}`;
          this.units.set(workerId, {
            id: workerId,
            type: "worker",
            playerId: player.id,
            x: tileX,
            y: tileY,
            health: 50,
            maxHealth: 50
          });
        }
      }
    });
  }
  
  private clearAreaForStartingPosition(x: number, y: number): void {
    // Clear 5x5 area around starting position
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tileX = x + dx;
        const tileY = y + dy;
        
        if (this.isValidPosition(tileX, tileY)) {
          // Set to grass and walkable
          this.map[tileY][tileX].type = 'grass';
          this.map[tileY][tileX].walkable = true;
          // Remove resources
          this.map[tileY][tileX].resource = null;
        }
      }
    }
  }
  
  getGameState(): any {
    return {
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        username: player.getUsername(),
        faction: player.getFaction(),
        resources: player.getResources()
      })),
      units: Array.from(this.units.values()),
      buildings: Array.from(this.buildings.values()),
      map: this.map
    };
  }
}
