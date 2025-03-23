import Phaser from "phaser";
import { Unit } from "../entities/Unit";
import { UnitType, FactionType } from "../types";
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
    
    // For each unit, calculate path and set it
    unitIds.forEach(unitId => {
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
    });
    
    // If not from server and units belong to local player, send to server
    if (!fromServer && unitIds.length > 0) {
      const firstUnit = this.units.get(unitIds[0]);
      if (firstUnit && firstUnit.playerId === this.scene.game.registry.get("localPlayerId")) {
        const multiplayerStore = useMultiplayer.getState();
        multiplayerStore.moveUnits(unitIds, targetX, targetY);
      }
    }
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
      const gatherAmount = resourceType === 'food' ? 10 : 5; // Gather less ore per trip
      
      // Reduce resource amount from the tile
      map[tileY][tileX].resource!.amount -= gatherAmount;
      
      // Start carrying the resource
      unit.startCarryingResource(resourceType, gatherAmount);
      
      // Check if resource is depleted
      if (map[tileY][tileX].resource!.amount <= 0) {
        map[tileY][tileX].resource = null;
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
          // Deposit resource
          const resourceManager = this.scene.game.registry.get("resourceManager");
          if (resourceManager) {
            resourceManager.addResource(
              unit.playerId,
              unit.carryingResource.type,
              unit.carryingResource.amount
            );
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
