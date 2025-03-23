import Phaser from "phaser";
import { Unit } from "../entities/Unit";
import { UnitType, FactionType, ResourceType } from "../types";
import { PathfindingManager } from "./PathfindingManager";
import { TILE_SIZE, MAP_SIZE } from "../config";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { useAudio } from "../../lib/stores/useAudio";

export class UnitManager {
  private scene: Phaser.Scene;
  private units: Map<string, Unit>;
  private pathfindingManager: PathfindingManager;
  private nextUnitId: number;
  
  constructor(scene: Phaser.Scene, pathfindingManager: PathfindingManager) {
    this.scene = scene;
    this.units = new Map();
    this.pathfindingManager = pathfindingManager;
    this.nextUnitId = 1;
  }
  
  createUnit(
    playerId: string,
    type: UnitType,
    x: number,
    y: number,
    fromServer: boolean = false
  ): Unit | null {
    // Get faction from player ID
    const players = this.scene.game.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    
    if (!player) {
      console.error(`Could not find player with ID: ${playerId}`);
      return null;
    }
    
    const faction = player.faction as FactionType;
    
    // Ensure position is valid
    x = Math.floor(x);
    y = Math.floor(y);
    
    // Check if tile is walkable
    const map = this.scene.game.registry.get("map") || [];
    if (y >= map.length || x >= map[0].length || !map[y][x].walkable) {
      console.warn(`Cannot create unit at invalid position: ${x}, ${y}`);
      return null;
    }
    
    // Create unique ID
    const unitId = `unit_${playerId}_${this.nextUnitId++}`;
    
    // Create unit
    const unit = new Unit(this.scene, unitId, type, playerId, faction, x, y);
    this.units.set(unitId, unit);
    
    // If not from server and this is the local player, send to server
    if (!fromServer && playerId === this.scene.game.registry.get("localPlayerId")) {
      const multiplayerStore = useMultiplayer.getState();
      multiplayerStore.createUnit(playerId, type, x, y);
    }
    
    return unit;
  }
  
  removeUnit(unitId: string) {
    const unit = this.units.get(unitId);
    if (unit) {
      unit.sprite.destroy();
      this.units.delete(unitId);
    }
  }
  
  getUnit(unitId: string): Unit | undefined {
    return this.units.get(unitId);
  }
  
  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }
  
  getUnitsByPlayer(playerId: string): Unit[] {
    return Array.from(this.units.values()).filter(unit => unit.playerId === playerId);
  }
  
  getUnitsByTypeAndPlayer(playerId: string, type: UnitType): Unit[] {
    return Array.from(this.units.values()).filter(
      unit => unit.playerId === playerId && unit.type === type
    );
  }
  
  selectUnitsInBounds(bounds: Phaser.Geom.Rectangle, playerId: string): string[] {
    const selectedUnitIds: string[] = [];
    
    this.units.forEach(unit => {
      // Only select units owned by the player
      if (unit.playerId === playerId) {
        // Check if unit is within selection bounds
        if (bounds.contains(unit.x, unit.y)) {
          unit.setSelected(true);
          selectedUnitIds.push(unit.id);
        } else {
          unit.setSelected(false);
        }
      }
    });
    
    return selectedUnitIds;
  }
  
  selectUnitAtPosition(x: number, y: number, playerId: string): string | null {
    // Create a small rectangle around the click position
    const selectRadius = 15;
    const selectBounds = new Phaser.Geom.Rectangle(
      x - selectRadius,
      y - selectRadius,
      selectRadius * 2,
      selectRadius * 2
    );
    
    let closestUnit: Unit | null = null;
    let closestDistance = Infinity;
    
    this.units.forEach(unit => {
      // Only select units owned by the player
      if (unit.playerId === playerId) {
        // Calculate distance to click position
        const distance = Phaser.Math.Distance.Between(x, y, unit.x, unit.y);
        
        // Check if unit is within selection bounds and closer than current closest
        if (selectBounds.contains(unit.x, unit.y) && distance < closestDistance) {
          closestUnit = unit;
          closestDistance = distance;
        }
        
        // Deselect all units initially
        unit.setSelected(false);
      }
    });
    
    // Select the closest unit if found
    if (closestUnit) {
      closestUnit.setSelected(true);
      return closestUnit.id;
    }
    
    return null;
  }
  
  moveUnitsTo(
    unitIds: string[],
    targetX: number,
    targetY: number,
    fromServer: boolean = false
  ) {
    // Check if target position is valid
    if (targetX < 0 || targetY < 0 || targetX >= MAP_SIZE || targetY >= MAP_SIZE) {
      console.warn(`Target position out of bounds: ${targetX}, ${targetY}`);
      return;
    }
    
    // Check if target is walkable
    const map = this.scene.game.registry.get("map") || [];
    if (!map[targetY][targetX].walkable) {
      console.warn(`Target position is not walkable: ${targetX}, ${targetY}`);
      return;
    }
    
    // Use a formation approach if multiple units are selected
    if (unitIds.length > 1) {
      this.moveUnitsInFormation(unitIds, targetX, targetY);
    } else {
      // Single unit - just move directly
      const unitId = unitIds[0];
      const unit = this.units.get(unitId);
      if (unit) {
        // Cancel any current actions
        unit.stopGathering();
        unit.stopAttacking();
        
        // Calculate starting position (in grid coordinates)
        const startX = Math.floor(unit.x / TILE_SIZE);
        const startY = Math.floor(unit.y / TILE_SIZE);
        
        // If already at target, do nothing
        if (startX === targetX && startY === targetY) {
          return;
        }
        
        // Get path from pathfinding manager
        const path = this.pathfindingManager.findPath(startX, startY, targetX, targetY);
        
        if (path.length > 0) {
          unit.setPath(path);
        }
      }
    }
    
    // If not from server and units belong to local player, send to server
    if (!fromServer && unitIds.length > 0) {
      const firstUnit = this.units.get(unitIds[0]);
      if (firstUnit && firstUnit.playerId === this.scene.game.registry.get("localPlayerId")) {
        const multiplayerStore = useMultiplayer.getState();
        multiplayerStore.moveUnits(unitIds, targetX, targetY);
      }
    }
  }
  
  /**
   * Move units in a formation pattern appropriate for Book of Mormon battles
   */
  private moveUnitsInFormation(unitIds: string[], targetX: number, targetY: number) {
    // Categorize units by type
    const heroUnits: Unit[] = [];
    const meleeUnits: Unit[] = [];
    const rangedUnits: Unit[] = [];
    const workerUnits: Unit[] = [];
    
    // Group units by type
    unitIds.forEach(unitId => {
      const unit = this.units.get(unitId);
      if (unit) {
        // Cancel any current actions
        unit.stopGathering();
        unit.stopAttacking();
        
        // Add to appropriate group
        if (unit.type === "hero") {
          heroUnits.push(unit);
        } else if (unit.type === "melee") {
          meleeUnits.push(unit);
        } else if (unit.type === "ranged") {
          rangedUnits.push(unit);
        } else if (unit.type === "worker") {
          workerUnits.push(unit);
        }
      }
    });
    
    // Get formation pattern based on unit composition
    const formationOffsets = this.getFormationOffsets(
      heroUnits.length,
      meleeUnits.length,
      rangedUnits.length,
      workerUnits.length
    );
    
    // Apply the formation by assigning positions to units
    let heroIndex = 0;
    let meleeIndex = 0;
    let rangedIndex = 0;
    let workerIndex = 0;
    
    // First position hero units (in the center or front)
    heroUnits.forEach(unit => {
      if (heroIndex < formationOffsets.heroPositions.length) {
        const offset = formationOffsets.heroPositions[heroIndex];
        const destX = targetX + offset.x;
        const destY = targetY + offset.y;
        
        if (this.isValidAndWalkablePosition(destX, destY)) {
          this.setUnitPath(unit, destX, destY);
        } else {
          // Fall back to the target position if invalid
          this.setUnitPath(unit, targetX, targetY);
        }
        
        heroIndex++;
      }
    });
    
    // Position melee units (typically in front to protect others)
    meleeUnits.forEach(unit => {
      if (meleeIndex < formationOffsets.meleePositions.length) {
        const offset = formationOffsets.meleePositions[meleeIndex];
        const destX = targetX + offset.x;
        const destY = targetY + offset.y;
        
        if (this.isValidAndWalkablePosition(destX, destY)) {
          this.setUnitPath(unit, destX, destY);
        } else {
          // Try to find a nearby valid position
          const alternatePos = this.findNearbyWalkablePosition(targetX, targetY, 3);
          if (alternatePos) {
            this.setUnitPath(unit, alternatePos.x, alternatePos.y);
          } else {
            this.setUnitPath(unit, targetX, targetY);
          }
        }
        
        meleeIndex++;
      }
    });
    
    // Position ranged units (typically behind melee units)
    rangedUnits.forEach(unit => {
      if (rangedIndex < formationOffsets.rangedPositions.length) {
        const offset = formationOffsets.rangedPositions[rangedIndex];
        const destX = targetX + offset.x;
        const destY = targetY + offset.y;
        
        if (this.isValidAndWalkablePosition(destX, destY)) {
          this.setUnitPath(unit, destX, destY);
        } else {
          // Try to find a nearby valid position
          const alternatePos = this.findNearbyWalkablePosition(targetX, targetY, 4);
          if (alternatePos) {
            this.setUnitPath(unit, alternatePos.x, alternatePos.y);
          } else {
            this.setUnitPath(unit, targetX, targetY);
          }
        }
        
        rangedIndex++;
      }
    });
    
    // Position worker units (typically behind everyone else)
    workerUnits.forEach(unit => {
      if (workerIndex < formationOffsets.workerPositions.length) {
        const offset = formationOffsets.workerPositions[workerIndex];
        const destX = targetX + offset.x;
        const destY = targetY + offset.y;
        
        if (this.isValidAndWalkablePosition(destX, destY)) {
          this.setUnitPath(unit, destX, destY);
        } else {
          // Try to find a nearby valid position
          const alternatePos = this.findNearbyWalkablePosition(targetX, targetY, 5);
          if (alternatePos) {
            this.setUnitPath(unit, alternatePos.x, alternatePos.y);
          } else {
            this.setUnitPath(unit, targetX, targetY);
          }
        }
        
        workerIndex++;
      }
    });
  }
  
  /**
   * Get appropriate formation offsets based on unit composition
   */
  private getFormationOffsets(numHeroes: number, numMelee: number, numRanged: number, numWorkers: number) {
    const heroPositions: { x: number, y: number }[] = [];
    const meleePositions: { x: number, y: number }[] = [];
    const rangedPositions: { x: number, y: number }[] = [];
    const workerPositions: { x: number, y: number }[] = [];
    
    // Position the hero units in the center or slightly forward
    for (let i = 0; i < numHeroes; i++) {
      heroPositions.push({ x: 0, y: -1 });
    }
    
    // Position melee units in front, forming a line or arc
    const meleeWidth = Math.min(numMelee, 7); // Limit width to 7 units
    const meleeRows = Math.ceil(numMelee / meleeWidth);
    
    let meleeIndex = 0;
    for (let row = 0; row < meleeRows; row++) {
      const rowWidth = Math.min(meleeWidth, numMelee - (row * meleeWidth));
      for (let col = 0; col < rowWidth; col++) {
        const xOffset = (col - Math.floor(rowWidth / 2));
        const yOffset = row - 1; // One row ahead of the target
        meleePositions.push({ x: xOffset, y: yOffset });
        meleeIndex++;
      }
    }
    
    // Position ranged units behind in an arc
    const rangedWidth = Math.min(numRanged, 5); // Limit width to 5 units
    const rangedRows = Math.ceil(numRanged / rangedWidth);
    
    let rangedIndex = 0;
    for (let row = 0; row < rangedRows; row++) {
      const rowWidth = Math.min(rangedWidth, numRanged - (row * rangedWidth));
      for (let col = 0; col < rowWidth; col++) {
        const xOffset = (col - Math.floor(rowWidth / 2));
        const yOffset = row + 1; // One row behind the target
        rangedPositions.push({ x: xOffset, y: yOffset });
        rangedIndex++;
      }
    }
    
    // Position worker units at the back or sides
    const workerWidth = Math.min(numWorkers, 3);
    const workerRows = Math.ceil(numWorkers / workerWidth);
    
    let workerIndex = 0;
    for (let row = 0; row < workerRows; row++) {
      const rowWidth = Math.min(workerWidth, numWorkers - (row * workerWidth));
      for (let col = 0; col < rowWidth; col++) {
        const xOffset = (col - Math.floor(rowWidth / 2));
        const yOffset = row + 2; // Two rows behind the target
        workerPositions.push({ x: xOffset, y: yOffset });
        workerIndex++;
      }
    }
    
    return {
      heroPositions,
      meleePositions,
      rangedPositions,
      workerPositions
    };
  }
  
  /**
   * Set a unit's path to a destination
   */
  private setUnitPath(unit: Unit, destX: number, destY: number) {
    const startX = Math.floor(unit.x / TILE_SIZE);
    const startY = Math.floor(unit.y / TILE_SIZE);
    
    // If already at destination, do nothing
    if (startX === destX && startY === destY) {
      return;
    }
    
    // Get path from pathfinding manager
    const path = this.pathfindingManager.findPath(startX, startY, destX, destY);
    
    if (path.length > 0) {
      unit.setPath(path);
    }
  }
  
  /**
   * Check if position is valid and walkable
   */
  private isValidAndWalkablePosition(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) {
      return false;
    }
    
    const map = this.scene.game.registry.get("map") || [];
    return map[y][x].walkable;
  }
  
  /**
   * Find a nearby walkable position within a radius
   */
  private findNearbyWalkablePosition(centerX: number, centerY: number, maxRadius: number): { x: number, y: number } | null {
    // Try concentric circles from the center
    for (let radius = 1; radius <= maxRadius; radius++) {
      // Check positions in a square around the center
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Skip if not on the perimeter of the square
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
            continue;
          }
          
          const testX = centerX + dx;
          const testY = centerY + dy;
          
          if (this.isValidAndWalkablePosition(testX, testY)) {
            return { x: testX, y: testY };
          }
        }
      }
    }
    
    return null;
  }
  
  orderUnitsToGatherResource(unitIds: string[], tileX: number, tileY: number) {
    // Check if tile has a resource
    const map = this.scene.game.registry.get("map") || [];
    if (!map[tileY][tileX].resource) {
      console.warn(`No resource at position: ${tileX}, ${tileY}`);
      return;
    }
    
    // Only worker units can gather resources
    const workerUnitIds = unitIds.filter(unitId => {
      const unit = this.units.get(unitId);
      return unit && unit.type === "worker";
    });
    
    if (workerUnitIds.length === 0) {
      console.warn("No worker units selected for gathering");
      return;
    }
    
    // First move units to the resource tile
    this.moveUnitsTo(workerUnitIds, tileX, tileY);
    
    // Then set them to gather once they arrive
    workerUnitIds.forEach(unitId => {
      const unit = this.units.get(unitId);
      if (unit) {
        unit.setGatheringResource(tileX, tileY);
      }
    });
  }
  
  update(delta: number) {
    // Update all units
    this.units.forEach(unit => {
      unit.update(delta);
      
      // Handle resource gathering for worker units
      if (unit.isGathering && unit.type === "worker" && !unit.isMoving) {
        this.handleResourceGathering(unit);
      }
    });
  }
  
  private handleResourceGathering(unit: Unit) {
    // Get map and check if we're at the target resource
    const map = this.scene.game.registry.get("map") || [];
    
    if (!unit.targetResourceX || !unit.targetResourceY) {
      unit.stopGathering();
      return;
    }
    
    const tileX = unit.targetResourceX;
    const tileY = unit.targetResourceY;
    
    // Check if we're at the resource tile
    const unitTileX = Math.floor(unit.x / TILE_SIZE);
    const unitTileY = Math.floor(unit.y / TILE_SIZE);
    
    // If not at resource tile, move there
    if (unitTileX !== tileX || unitTileY !== tileY) {
      const path = this.pathfindingManager.findPath(unitTileX, unitTileY, tileX, tileY);
      if (path.length > 0) {
        unit.setPath(path);
      }
      return;
    }
    
    // Check if resource still exists
    if (!map[tileY][tileX].resource) {
      unit.stopGathering();
      return;
    }
    
    // If not carrying a resource, gather it
    if (!unit.carryingResource) {
      const resourceType = map[tileY][tileX].resource!.type;
      
      // Update gathering rate based on faction bonuses
      let gatherAmount = resourceType === 'food' ? 10 : 5; // Base gather rates
      
      // Apply faction bonuses
      if (unit.faction === "Nephites" && resourceType === "food") {
        // Nephites are better at farming
        gatherAmount += 2;
      } else if (unit.faction === "Lamanites" && resourceType === "ore") {
        // Lamanites are better at mining
        gatherAmount += 2;
      }
      
      // Gathering animation - show worker harvesting with a small pause
      unit.playGatheringAnimation();
      
      // Create gathering particle effect
      this.createGatheringEffect(unit.x, unit.y, resourceType);
      
      // Reduce resource amount from the tile
      map[tileY][tileX].resource!.amount -= gatherAmount;
      
      // Update resource visual
      // Access the GameScene instance to call updateResourceVisual
      if (this.scene.scene.key === 'GameScene') {
        // The method exists on the GameScene instance
        (this.scene as any).updateResourceVisual(tileX, tileY);
      }
      
      // Play gathering sound
      this.playGatheringSound(resourceType);
      
      // Start carrying the resource
      unit.startCarryingResource(resourceType, gatherAmount);
      
      // Check if resource is depleted
      if (map[tileY][tileX].resource!.amount <= 0) {
        // Resource is depleted - remove it and show depletion effect
        this.createResourceDepletionEffect(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, resourceType);
        map[tileY][tileX].resource = null;
        
        // Remove the resource visual
        const resourceMarkers = this.scene.registry.get('resourceMarkers');
        if (resourceMarkers && resourceMarkers[`${tileX},${tileY}`]) {
          resourceMarkers[`${tileX},${tileY}`].destroy();
          delete resourceMarkers[`${tileX},${tileY}`];
        }
        
        unit.stopGathering();
      }
      
      // Find nearest city center to return resources
      const cityCenter = this.findNearestBuilding(unit.x, unit.y, unit.playerId, "cityCenter");
      if (cityCenter) {
        // Calculate city center position in grid coordinates
        const cityCenterX = Math.floor(cityCenter.x / TILE_SIZE);
        const cityCenterY = Math.floor(cityCenter.y / TILE_SIZE);
        
        // Move to city center
        const path = this.pathfindingManager.findPath(unitTileX, unitTileY, cityCenterX, cityCenterY);
        if (path.length > 0) {
          unit.setPath(path);
        }
      } else {
        // No city center found, stop gathering
        unit.stopGathering();
        unit.stopCarryingResource();
      }
    } else {
      // Already carrying a resource, find nearest city center
      const cityCenter = this.findNearestBuilding(unit.x, unit.y, unit.playerId, "cityCenter");
      if (cityCenter) {
        // Calculate city center position in grid coordinates
        const cityCenterX = Math.floor(cityCenter.x / TILE_SIZE);
        const cityCenterY = Math.floor(cityCenter.y / TILE_SIZE);
        
        // Check if we're at the city center
        if (unitTileX === cityCenterX && unitTileY === cityCenterY) {
          // Deposit animation and effect
          this.createDepositEffect(unit.x, unit.y, unit.carryingResource.type);
          
          // Deposit resource
          const resourceManager = this.scene.game.registry.get("resourceManager");
          if (resourceManager) {
            resourceManager.addResource(
              unit.playerId,
              unit.carryingResource.type,
              unit.carryingResource.amount
            );
            
            // Play deposit sound
            this.playDepositSound(unit.carryingResource.type);
          }
          
          // Stop carrying
          unit.stopCarryingResource();
          
          // Go back to resource if it still exists
          if (map[tileY][tileX].resource) {
            const path = this.pathfindingManager.findPath(unitTileX, unitTileY, tileX, tileY);
            if (path.length > 0) {
              unit.setPath(path);
            }
          } else {
            // Resource depleted, stop gathering
            unit.stopGathering();
            
            // Look for similar nearby resources to continue gathering
            const newResourceTile = this.findNearbyResource(unitTileX, unitTileY, unit.carryingResource.type);
            if (newResourceTile) {
              // Set unit to gather from the new resource
              this.orderUnitsToGatherResource([unit.id], newResourceTile.x, newResourceTile.y);
            }
          }
        } else {
          // Not at city center yet, move there
          const path = this.pathfindingManager.findPath(unitTileX, unitTileY, cityCenterX, cityCenterY);
          if (path.length > 0) {
            unit.setPath(path);
          }
        }
      } else {
        // No city center found, stop gathering
        unit.stopGathering();
        unit.stopCarryingResource();
      }
    }
  }
  
  /**
   * Create particle effect for resource gathering
   */
  private createGatheringEffect(x: number, y: number, resourceType: ResourceType) {
    // Create particles based on resource type
    const particleColor = resourceType === 'food' ? 0x44ff44 : 0xcc8844;
    
    // Create particle emitter
    const particles = this.scene.add.particles(0, 0, 'particle', {
      x: x,
      y: y,
      speed: { min: 20, max: 50 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: 600,
      quantity: 5,
      tint: particleColor
    });
    
    // Auto-destroy after animation completes
    this.scene.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }
  
  /**
   * Create effect for resource depletion
   */
  private createResourceDepletionEffect(x: number, y: number, resourceType: ResourceType) {
    // Create a more dramatic particle effect for resource depletion
    const particleColor = resourceType === 'food' ? 0x44ff44 : 0xcc8844;
    
    // Create particle emitter
    const particles = this.scene.add.particles(0, 0, 'particle', {
      x: x,
      y: y,
      speed: { min: 50, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 1500,
      quantity: 20,
      tint: particleColor
    });
    
    // Add explosion effect
    const explosion = this.scene.add.circle(x, y, 25, particleColor, 0.7);
    this.scene.tweens.add({
      targets: explosion,
      alpha: 0,
      scale: 2,
      duration: 1000,
      onComplete: () => {
        explosion.destroy();
      }
    });
    
    // Display depletion text
    const depletionText = this.scene.add.text(x, y, "Depleted!", {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: depletionText,
      y: y - 40,
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        depletionText.destroy();
      }
    });
    
    // Auto-destroy particles after animation completes
    this.scene.time.delayedCall(1500, () => {
      particles.destroy();
    });
  }
  
  /**
   * Create effect for resource deposit at city center
   */
  private createDepositEffect(x: number, y: number, resourceType: ResourceType) {
    // Create particles based on resource type
    const particleColor = resourceType === 'food' ? 0x44ff44 : 0xcc8844;
    
    // Create deposit particles that rise up
    const particles = this.scene.add.particles(0, 0, 'particle', {
      x: x,
      y: y,
      speed: { min: 20, max: 50 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.5, end: 0 },
      lifespan: 800,
      quantity: 10,
      tint: particleColor
    });
    
    // Create visual effect showing resource amount
    const depositText = this.scene.add.text(
      x, y - 20,
      `+${resourceType === 'food' ? '🌽' : '⛏️'}`,
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: resourceType === 'food' ? '#44ff44' : '#cc8844',
        stroke: '#000000',
        strokeThickness: 3
      }
    ).setOrigin(0.5);
    
    // Animate the resource text rising
    this.scene.tweens.add({
      targets: depositText,
      y: y - 50,
      alpha: 0,
      duration: 1500,
      onComplete: () => depositText.destroy()
    });
    
    // Auto-destroy particles after animation completes
    this.scene.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }
  
  /**
   * Play gathering sound based on resource type
   */
  private playGatheringSound(resourceType: ResourceType) {
    const audioStore = useAudio.getState();
    if (audioStore.isMuted) return;
    
    // Sound effect not loaded in audio store yet, using simple audio for now
    const sound = this.scene.sound.add(
      resourceType === 'food' ? 'gatherFood' : 'gatherOre', 
      { volume: 0.3 }
    );
    sound.play();
  }
  
  /**
   * Play deposit sound based on resource type
   */
  private playDepositSound(resourceType: ResourceType) {
    const audioStore = useAudio.getState();
    if (audioStore.isMuted) return;
    
    // Use success sound from audio store
    if (audioStore.successSound) {
      audioStore.playSuccess();
    } else {
      // Fallback if success sound not loaded
      const sound = this.scene.sound.add('deposit', { volume: 0.4 });
      sound.play();
    }
  }
  
  /**
   * Find a nearby resource of the same type
   */
  private findNearbyResource(centerX: number, centerY: number, resourceType: ResourceType, searchRadius: number = 8): { x: number, y: number } | null {
    const map = this.scene.game.registry.get("map") || [];
    
    // Check in increasing radius
    for (let radius = 2; radius <= searchRadius; radius++) {
      // Check positions in a square around the center
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Skip if not on the perimeter of the square (for efficiency)
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
            continue;
          }
          
          const testX = centerX + dx;
          const testY = centerY + dy;
          
          // Check if valid position
          if (testX >= 0 && testX < MAP_SIZE && testY >= 0 && testY < MAP_SIZE) {
            // Check if this tile has a resource of the desired type
            if (map[testY][testX].resource && map[testY][testX].resource.type === resourceType) {
              return { x: testX, y: testY };
            }
          }
        }
      }
    }
    
    return null;
  }
  
  private findNearestBuilding(x: number, y: number, playerId: string, type: string) {
    // Get building manager
    const buildingManager = this.scene.game.registry.get("buildingManager");
    if (!buildingManager) return null;
    
    // Get buildings of the specified type and player
    const buildings = buildingManager.getBuildingsByTypeAndPlayer(playerId, type);
    
    if (buildings.length === 0) return null;
    
    // Find nearest building
    let nearestBuilding = null;
    let nearestDistance = Infinity;
    
    for (const building of buildings) {
      const distance = Phaser.Math.Distance.Between(x, y, building.x, building.y);
      if (distance < nearestDistance) {
        nearestBuilding = building;
        nearestDistance = distance;
      }
    }
    
    return nearestBuilding;
  }
}
