import Phaser from "phaser";
import { Building } from "../entities/Building";
import { BuildingType, FactionType } from "../types";
import { UnitManager } from "./UnitManager";
import { TILE_SIZE } from "../config";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { useAudio } from "../../lib/stores/useAudio";

export class BuildingManager {
  private scene: Phaser.Scene;
  private buildings: Map<string, Building>;
  private unitManager: UnitManager;
  private nextBuildingId: number;
  
  constructor(scene: Phaser.Scene, unitManager: UnitManager) {
    this.scene = scene;
    this.buildings = new Map();
    this.unitManager = unitManager;
    this.nextBuildingId = 1;
  }
  
  createBuilding(
    playerId: string,
    type: BuildingType,
    x: number,
    y: number,
    fromServer: boolean = false
  ): Building | null {
    // Get faction from player ID - first try GameScene's getPlayers method
    let faction: FactionType;
    
    // Use the GameScene's getPlayers method if available (type assertion needed)
    if (typeof (this.scene as any).getPlayers === 'function') {
      const players = (this.scene as any).getPlayers() || [];
      const player = players.find((p: any) => p.id === playerId);
      
      if (player) {
        faction = player.faction;
      } else {
        console.error(`Could not find player with ID: ${playerId} in GameScene players`);
        return null;
      }
    } else {
      // Fallback to registry
      const players = this.scene.game.registry.get("players") || [];
      const player = players.find((p: any) => p.id === playerId);
      
      if (!player) {
        console.error(`Could not find player with ID: ${playerId} in registry`);
        return null;
      }
      
      faction = player.faction as FactionType;
    }
    
    console.log(`Creating building for player ${playerId} with faction ${faction}`);
    
    // Ensure position is valid
    x = Math.floor(x);
    y = Math.floor(y);
    
    // Check if tiles are walkable (building needs a 2x2 area)
    let map;
    
    // First try to use GameScene's getMap method if available
    if (typeof (this.scene as any).getMap === 'function') {
      map = (this.scene as any).getMap();
    } else {
      // Fallback to registry
      map = this.scene.game.registry.get("map") || [];
    }
    
    // Get size based on building type (2 is default)
    let size = 2;
    if (type === "cityCenter") size = 3;
    else if (type === "wall") size = 1;
    
    // Check area
    for (let ty = y - Math.floor(size/2); ty <= y + Math.floor(size/2); ty++) {
      for (let tx = x - Math.floor(size/2); tx <= x + Math.floor(size/2); tx++) {
        if (ty < 0 || ty >= map.length || tx < 0 || tx >= map[0].length || !map[ty][tx].walkable) {
          console.warn(`Cannot create building at invalid position: ${x}, ${y}`);
          return null;
        }
      }
    }
    
    // Create unique ID
    const buildingId = `building_${playerId}_${this.nextBuildingId++}`;
    
    // Create building
    const building = new Building(this.scene, buildingId, type, playerId, faction, x, y);
    this.buildings.set(buildingId, building);
    
    // Mark tiles as occupied by the building
    for (let ty = y - Math.floor(size/2); ty <= y + Math.floor(size/2); ty++) {
      for (let tx = x - Math.floor(size/2); tx <= x + Math.floor(size/2); tx++) {
        if (ty >= 0 && ty < map.length && tx >= 0 && tx < map[0].length) {
          map[ty][tx].walkable = false;
        }
      }
    }
    
    // If not from server and this is the local player, send to server
    if (!fromServer && playerId === this.scene.game.registry.get("localPlayerId")) {
      const multiplayerStore = useMultiplayer.getState();
      multiplayerStore.createBuilding(playerId, type, x, y);
    }
    
    return building;
  }
  
  removeBuilding(buildingId: string) {
    const building = this.buildings.get(buildingId);
    if (building) {
      // Free up tiles occupied by the building
      let map;
    
      // First try to use GameScene's getMap method if available
      if (typeof (this.scene as any).getMap === 'function') {
        map = (this.scene as any).getMap();
      } else {
        // Fallback to registry
        map = this.scene.game.registry.get("map") || [];
      }
      
      // Get building position in grid coordinates
      const x = Math.floor(building.x / TILE_SIZE);
      const y = Math.floor(building.y / TILE_SIZE);
      
      // Get size based on building type (2 is default)
      let size = 2;
      if (building.type === "cityCenter") size = 3;
      else if (building.type === "wall") size = 1;
      
      // Mark tiles as walkable again
      for (let ty = y - Math.floor(size/2); ty <= y + Math.floor(size/2); ty++) {
        for (let tx = x - Math.floor(size/2); tx <= x + Math.floor(size/2); tx++) {
          if (ty >= 0 && ty < map.length && tx >= 0 && tx < map[0].length) {
            map[ty][tx].walkable = true;
          }
        }
      }
      
      // Destroy building sprite
      building.sprite.destroy();
      this.buildings.delete(buildingId);
    }
  }
  
  getBuilding(buildingId: string): Building | undefined {
    return this.buildings.get(buildingId);
  }
  
  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }
  
  getBuildingsByPlayer(playerId: string): Building[] {
    return Array.from(this.buildings.values()).filter(building => building.playerId === playerId);
  }
  
  getBuildingsByTypeAndPlayer(playerId: string, type: BuildingType): Building[] {
    return Array.from(this.buildings.values()).filter(
      building => building.playerId === playerId && building.type === type
    );
  }
  
  update(delta: number) {
    // Update all buildings
    this.buildings.forEach(building => {
      // Update building state
      const producedType = building.update(delta);
      
      // Handle produced units
      if (producedType) {
        this.handleProducedUnit(building, producedType);
      }
    });
  }
  
  private handleProducedUnit(building: Building, unitType: string) {
    // Find a valid position near the building to place the unit
    const buildingX = Math.floor(building.x / TILE_SIZE);
    const buildingY = Math.floor(building.y / TILE_SIZE);
    
    // Try positions in a spiral around the building
    const spiralOffsets = [
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
      { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
      { x: 0, y: 2 }, { x: -1, y: 2 }, { x: -2, y: 2 }, { x: -2, y: 1 },
      { x: -2, y: 0 }, { x: -2, y: -1 }, { x: -2, y: -2 }, { x: -1, y: -2 },
      { x: 0, y: -2 }, { x: 1, y: -2 }, { x: 2, y: -2 }, { x: 2, y: -1 }
    ];
    
    let map;
    
    // First try to use GameScene's getMap method if available
    if (typeof (this.scene as any).getMap === 'function') {
      map = (this.scene as any).getMap();
    } else {
      // Fallback to registry
      map = this.scene.game.registry.get("map") || [];
    }
    
    for (const offset of spiralOffsets) {
      const x = buildingX + offset.x;
      const y = buildingY + offset.y;
      
      // Check if position is valid and walkable
      if (x >= 0 && x < map[0].length && y >= 0 && y < map.length && map[y][x].walkable) {
        // Create the unit
        this.unitManager.createUnit(building.playerId, unitType as any, x, y);
        
        // Play success sound
        const audioStore = useAudio.getState();
        if (!audioStore.isMuted) {
          audioStore.playSuccess();
        }
        
        return;
      }
    }
    
    console.warn(`Could not find a valid position to place unit ${unitType} from building ${building.id}`);
  }
  
  queueUnitProduction(buildingId: string, unitType: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) {
      console.warn(`Building not found: ${buildingId}`);
      return false;
    }
    
    // Check if building can produce this unit type
    if (!this.canBuildingProduceUnitType(building.type, unitType)) {
      console.warn(`Building ${building.type} cannot produce unit type ${unitType}`);
      return false;
    }
    
    // Add unit to production queue
    building.queueProduction(unitType);
    return true;
  }
  
  cancelUnitProduction(buildingId: string, index: number): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) {
      console.warn(`Building not found: ${buildingId}`);
      return false;
    }
    
    building.cancelProduction(index);
    return true;
  }
  
  private canBuildingProduceUnitType(buildingType: BuildingType, unitType: string): boolean {
    if (buildingType === "cityCenter") {
      return unitType === "worker";
    } else if (buildingType === "barracks") {
      return unitType === "melee";
    } else if (buildingType === "archeryRange") {
      return unitType === "ranged";
    }
    
    return false;
  }
}
