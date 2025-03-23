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
  
  /**
   * Update the game state based on time elapsed
   * This handles continuous processes like:
   * - Resource gathering
   * - Unit movement
   * - Building production
   * - Combat
   * 
   * @param deltaTime Time since last update in milliseconds
   */
  update(deltaTime: number): void {
    // Calculate real seconds for game time scaling (speed up or slow down game)
    const seconds = deltaTime / 1000;
    
    // Update all units
    this.updateUnits(seconds);
    
    // Update all buildings
    this.updateBuildings(seconds);
    
    // Update all resources (automatic gathering, decay, etc.)
    this.updateResources(seconds);
  }
  
  /**
   * Update all units in the game (movement, gathering, combat)
   */
  private updateUnits(deltaSeconds: number): void {
    this.units.forEach((unit) => {
      // Process unit movement
      if (unit.isMoving && unit.path && unit.path.length > 0) {
        this.updateUnitMovement(unit, deltaSeconds);
      }
      
      // Process resource gathering
      if (unit.isGathering && unit.targetResourceX !== null && unit.targetResourceY !== null) {
        this.updateResourceGathering(unit, deltaSeconds);
      }
      
      // Handle automatic combat (units attacking when in range)
      if (unit.isAttacking && unit.targetUnitId) {
        this.updateCombat(unit, deltaSeconds);
      }
    });
  }
  
  /**
   * Update unit position based on its current path
   */
  private updateUnitMovement(unit: any, deltaSeconds: number): void {
    if (!unit.path || unit.path.length === 0) {
      unit.isMoving = false;
      return;
    }
    
    // Get next waypoint
    const nextWaypoint = unit.path[0];
    
    // Calculate distance to waypoint
    const dx = nextWaypoint.x - unit.x;
    const dy = nextWaypoint.y - unit.y;
    const distanceToWaypoint = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate how far unit can move this frame
    const moveDistance = unit.speed * deltaSeconds * 10; // Scale by 10 for better movement speed
    
    if (distanceToWaypoint <= moveDistance) {
      // Reached waypoint
      unit.x = nextWaypoint.x;
      unit.y = nextWaypoint.y;
      unit.path.shift();
      
      // If no more waypoints, stop moving
      if (unit.path.length === 0) {
        unit.isMoving = false;
      }
    } else {
      // Move toward waypoint
      const ratio = moveDistance / distanceToWaypoint;
      unit.x += dx * ratio;
      unit.y += dy * ratio;
    }
  }
  
  /**
   * Update resource gathering for workers
   */
  private updateResourceGathering(unit: any, deltaSeconds: number): void {
    // Only worker units can gather resources
    if (unit.type !== "worker") return;
    
    // Check if the resource exists
    const tileX = Math.floor(unit.targetResourceX);
    const tileY = Math.floor(unit.targetResourceY);
    
    if (!this.isValidPosition(tileX, tileY) || !this.map[tileY][tileX].resource) {
      unit.isGathering = false;
      unit.targetResourceX = null;
      unit.targetResourceY = null;
      return;
    }
    
    const resource = this.map[tileY][tileX].resource;
    
    // Calculate how much to gather this update
    // Based on gather rate and faction bonuses
    const player = this.players.get(unit.playerId);
    if (!player) return;
    
    // If not carrying any resources, gather from node
    if (!unit.carryingResource) {
      // Increase gather progress
      unit.gatherProgress = (unit.gatherProgress || 0) + deltaSeconds;
      
      // Complete a gathering cycle
      if (unit.gatherProgress >= 3) { // 3 seconds to gather
        unit.gatherProgress = 0;
        
        // Start carrying resource
        const amountToGather = Math.min(resource.amount, 10);
        
        if (amountToGather <= 0) {
          // Resource depleted
          this.map[tileY][tileX].resource = null;
          unit.isGathering = false;
          return;
        }
        
        // Player now carrying resource
        unit.carryingResource = {
          type: resource.type,
          amount: amountToGather
        };
        
        // Reduce resource node amount
        resource.amount -= amountToGather;
      }
    } else {
      // If already carrying resource, find dropoff point
      // Find nearest city center
      let nearestBuilding = null;
      let nearestDistance = Infinity;
      
      this.buildings.forEach((building) => {
        if (building.playerId === unit.playerId && building.type === "cityCenter") {
          const dist = Math.hypot(building.x - unit.x, building.y - unit.y);
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestBuilding = building;
          }
        }
      });
      
      // If close enough to dropoff, deposit resources
      if (nearestBuilding && nearestDistance < 3) {
        // Add resources to player
        const resourceAmount = unit.carryingResource.amount;
        if (unit.carryingResource.type === "food") {
          player.addResources(resourceAmount, 0);
        } else {
          player.addResources(0, resourceAmount);
        }
        
        // Clear carried resources
        unit.carryingResource = null;
      } else if (nearestBuilding) {
        // Move toward dropoff point
        unit.isMoving = true;
        unit.isGathering = false;
        unit.path = [{
          x: nearestBuilding.x,
          y: nearestBuilding.y
        }];
      } else {
        // No dropoff found, cancel gathering
        unit.isGathering = false;
        unit.carryingResource = null;
      }
    }
  }
  
  /**
   * Update combat between units
   */
  private updateCombat(unit: any, deltaSeconds: number): void {
    // Find target unit
    const targetUnit = this.units.get(unit.targetUnitId);
    
    // If target doesn't exist anymore, stop attacking
    if (!targetUnit) {
      unit.isAttacking = false;
      unit.targetUnitId = null;
      return;
    }
    
    // Check if in range
    const distance = Math.hypot(targetUnit.x - unit.x, targetUnit.y - unit.y);
    const inRange = distance <= unit.range;
    
    if (!inRange) {
      // Move toward target
      unit.isMoving = true;
      unit.path = [{
        x: targetUnit.x,
        y: targetUnit.y
      }];
      return;
    }
    
    // Attack cooldown
    unit.attackCooldown = (unit.attackCooldown || 0) - deltaSeconds;
    if (unit.attackCooldown <= 0) {
      // Reset cooldown
      unit.attackCooldown = 1; // 1 second between attacks
      
      // Calculate damage based on unit stats, counter bonuses, etc.
      let damage = unit.attack;
      
      // Apply counter bonuses if applicable
      if (this.isCounterUnit(unit.type, targetUnit.type)) {
        damage *= 1.5; // 50% more damage when using counter
      }
      
      // Apply weakness penalties
      if (this.isWeakToUnit(unit.type, targetUnit.type)) {
        damage *= 0.75; // 25% less damage when weak against target
      }
      
      // Apply defense reduction
      damage = Math.max(1, damage - targetUnit.defense);
      
      // Apply damage to target
      targetUnit.health -= damage;
      
      // Check if target is dead
      if (targetUnit.health <= 0) {
        this.units.delete(targetUnit.id);
        unit.isAttacking = false;
        unit.targetUnitId = null;
      }
    }
  }
  
  /**
   * Determine if unitType has a counter advantage against targetType
   */
  private isCounterUnit(unitType: string, targetType: string): boolean {
    const counterMap: Record<string, string[]> = {
      "melee": ["ranged"],
      "ranged": ["cavalry"],
      "cavalry": ["melee"],
      "hero": []
    };
    
    return counterMap[unitType]?.includes(targetType) || false;
  }
  
  /**
   * Determine if unitType is weak against targetType
   */
  private isWeakToUnit(unitType: string, targetType: string): boolean {
    const weaknessMap: Record<string, string[]> = {
      "melee": ["cavalry"],
      "ranged": ["melee"],
      "cavalry": ["ranged"],
      "hero": []
    };
    
    return weaknessMap[unitType]?.includes(targetType) || false;
  }
  
  /**
   * Update building production and capabilities
   */
  private updateBuildings(deltaSeconds: number): void {
    this.buildings.forEach((building) => {
      // Handle production queue
      if (building.productionQueue && building.productionQueue.length > 0) {
        const currentProduction = building.productionQueue[0];
        
        // Progress production
        currentProduction.remainingTime -= deltaSeconds * 1000; // Convert to ms
        
        // If production complete
        if (currentProduction.remainingTime <= 0) {
          // Remove from queue
          building.productionQueue.shift();
          
          // Create the produced unit
          if (currentProduction.type === "worker" || 
              currentProduction.type === "melee" || 
              currentProduction.type === "ranged" || 
              currentProduction.type === "cavalry" || 
              currentProduction.type === "hero") {
            
            // Create unit near building
            this.createUnitNearBuilding(building, currentProduction.type);
          }
        }
      }
    });
  }
  
  /**
   * Create a new unit near a building
   */
  private createUnitNearBuilding(building: any, unitType: string): string {
    // Find a valid position near the building
    const positions = [
      { x: building.x + 2, y: building.y },
      { x: building.x - 2, y: building.y },
      { x: building.x, y: building.y + 2 },
      { x: building.x, y: building.y - 2 },
      { x: building.x + 1, y: building.y + 1 },
      { x: building.x - 1, y: building.y - 1 },
      { x: building.x + 1, y: building.y - 1 },
      { x: building.x - 1, y: building.y + 1 }
    ];
    
    let validPosition = null;
    
    for (const pos of positions) {
      if (this.isValidAndWalkablePosition(pos.x, pos.y)) {
        validPosition = pos;
        break;
      }
    }
    
    // If no valid position found, try to find one nearby
    if (!validPosition) {
      for (let xOffset = -3; xOffset <= 3; xOffset++) {
        for (let yOffset = -3; yOffset <= 3; yOffset++) {
          const x = building.x + xOffset;
          const y = building.y + yOffset;
          
          if (this.isValidAndWalkablePosition(x, y)) {
            validPosition = { x, y };
            break;
          }
        }
        if (validPosition) break;
      }
    }
    
    // If still no valid position, return empty string (failed to create)
    if (!validPosition) {
      return "";
    }
    
    // Create the unit
    const unitId = `unit_${this.nextUnitId++}`;
    const player = this.players.get(building.playerId);
    
    if (!player) return "";
    
    const faction = player.getFaction() || "Nephites"; // Default to Nephites if not set
    
    // Get base stats for this unit type
    const stats = UNIT_STATS[unitType] || { 
      health: 100, attack: 10, defense: 5, range: 1, speed: 2 
    };
    
    // Create the unit object
    const unit = {
      id: unitId,
      playerId: building.playerId,
      type: unitType,
      faction,
      health: stats.health,
      maxHealth: stats.health,
      attack: stats.attack,
      defense: stats.defense,
      range: stats.range,
      speed: stats.speed,
      x: validPosition.x,
      y: validPosition.y,
      isMoving: false,
      isGathering: false,
      isAttacking: false,
      path: [],
      targetResourceX: null,
      targetResourceY: null,
      targetUnitId: null,
      carryingResource: null
    };
    
    // Add to units map
    this.units.set(unitId, unit);
    
    return unitId;
  }
  
  /**
   * Check if position is valid and walkable
   */
  private isValidAndWalkablePosition(x: number, y: number): boolean {
    return this.isValidPosition(x, y) && this.isWalkable(x, y);
  }
  
  /**
   * Update resource nodes and automatic player income
   */
  private updateResources(deltaSeconds: number): void {
    // Handle automatic income ticks for players (if implementing)
    // For example, 1 food per 10 seconds for each player
    
    this.players.forEach((player) => {
      // Example of minimal passive income
      const passiveIncome = deltaSeconds * 0.05; // 0.05 resource per second
      player.addResources(passiveIncome, passiveIncome / 2);
    });
  }

  getGameState(): any {
    return {
      players: Object.fromEntries(
        Array.from(this.players.entries()).map(([id, player]) => [
          id,
          {
            id,
            username: player.getUsername(),
            faction: player.getFaction(),
            resources: player.getResources()
          }
        ])
      ),
      units: Object.fromEntries(
        Array.from(this.units.entries()).map(([id, unit]) => [
          id,
          {
            id,
            playerId: unit.playerId,
            type: unit.type,
            x: unit.x,
            y: unit.y,
            health: unit.health,
            maxHealth: unit.maxHealth,
            isMoving: unit.isMoving || false,
            isGathering: unit.isGathering || false,
            isAttacking: unit.isAttacking || false,
            carryingResource: unit.carryingResource
          }
        ])
      ),
      buildings: Object.fromEntries(
        Array.from(this.buildings.entries()).map(([id, building]) => [
          id,
          {
            id,
            playerId: building.playerId,
            type: building.type,
            x: building.x,
            y: building.y,
            health: building.health,
            maxHealth: building.maxHealth,
            productionQueue: building.productionQueue || []
          }
        ])
      ),
      map: this.map,
      timestamp: Date.now() // Include timestamp for synchronization
    };
  }
}
