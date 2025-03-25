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
    
    // Add safety check for map
    if (!map || !Array.isArray(map) || map.length === 0) {
      console.error("Invalid map data when creating building");
      return null;
    }
    
    // Check area
    for (let ty = y - Math.floor(size/2); ty <= y + Math.floor(size/2); ty++) {
      for (let tx = x - Math.floor(size/2); tx <= x + Math.floor(size/2); tx++) {
        // Check if map index is valid
        if (ty < 0 || ty >= map.length || tx < 0 || !map[ty] || tx >= map[ty].length) {
          console.warn(`Cannot create building at invalid position: ${x}, ${y} - Out of bounds`);
          return null;
        }
        
        // Check if the tile at this position exists and is walkable
        if (!map[ty][tx] || !map[ty][tx].walkable) {
          console.warn(`Cannot create building at invalid position: ${x}, ${y} - Tile not walkable`);
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
    
    // Create a spawn animation at the building
    this.createSpawnAnimation(building, unitType);
    
    // Find a suitable spawn position
    for (const offset of spiralOffsets) {
      const x = buildingX + offset.x;
      const y = buildingY + offset.y;
      
      // Add safety check for map
      if (!map || !Array.isArray(map) || map.length === 0 || !map[0]) {
        console.error("Invalid map data when placing produced unit");
        return;
      }
      
      // Check if position is valid and walkable
      if (x >= 0 && y >= 0 && y < map.length && map[y] && x < map[y].length && map[y][x] && map[y][x].walkable) {
        // Create the unit with a spawn animation
        const unit = this.unitManager.createUnit(building.playerId, unitType as any, x, y);
        
        if (unit) {
          // Create a spawn-in effect for the unit
          this.createUnitSpawnEffect(unit);
        }
        
        // Display notification text
        this.showUnitProducedNotification(building, unitType);
        
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
  
  /**
   * Creates a visual spawn animation at the building when a unit is produced
   */
  private createSpawnAnimation(building: Building, unitType: string) {
    const scene = this.scene;
    const x = building.x;
    const y = building.y;
    
    // Create a flash effect
    const flash = scene.add.circle(x, y, 20, 0xffffff, 0.7);
    
    // Add scale animation
    scene.tweens.add({
      targets: flash,
      scale: { from: 0.5, to: 2 },
      alpha: { from: 0.7, to: 0 },
      duration: 500,
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Create a simpler particle effect using shapes instead of particles system
    // This avoids issues with different Phaser versions
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      const distance = 30 + Math.random() * 20;
      const size = 3 + Math.random() * 4;
      
      // Create a single particle
      const particle = scene.add.circle(
        x, 
        y, 
        size, 
        this.getColorForUnitType(unitType),
        0.7
      );
      
      // Animate the particle
      scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: { from: 1, to: 0.3 },
        duration: 500 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
  
  /**
   * Create an effect when a new unit spawns
   */
  private createUnitSpawnEffect(unit: any) {
    if (!unit || !unit.sprite) return;
    
    const scene = this.scene;
    
    // Flash effect
    scene.tweens.add({
      targets: unit.sprite,
      alpha: { from: 0.3, to: 1 },
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Cubic.out'
    });
    
    // Add a temporary circle expand effect
    const spawnCircle = scene.add.circle(0, 0, 15, 0xffffff, 0.4);
    unit.sprite.add(spawnCircle);
    
    scene.tweens.add({
      targets: spawnCircle,
      scale: { from: 0.8, to: 1.5 },
      alpha: { from: 0.4, to: 0 },
      duration: 700,
      onComplete: () => {
        spawnCircle.destroy();
      }
    });
  }
  
  /**
   * Shows a floating notification when a unit is produced
   */
  private showUnitProducedNotification(building: Building, unitType: string) {
    const x = building.x;
    const y = building.y - 30;
    
    // Create a notification text that floats up
    const text = this.scene.add.text(x, y, `${this.getReadableUnitName(unitType)} Ready!`, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Animate the text floating up and fading out
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 1500,
      ease: 'Cubic.out',
      onComplete: () => {
        text.destroy();
      }
    });
  }
  
  /**
   * Get a readable name for the unit type
   */
  private getReadableUnitName(unitType: string): string {
    switch (unitType) {
      case "worker": return "Worker";
      case "melee": return "Warrior";
      case "ranged": return "Archer";
      case "hero": return "Hero";
      default: return unitType;
    }
  }
  
  /**
   * Get the appropriate color for a unit type
   */
  private getColorForUnitType(unitType: string): number {
    switch (unitType) {
      case "worker": return 0x33cc33; // Green for workers
      case "melee": return 0xcc3333;  // Red for melee
      case "ranged": return 0x3333cc; // Blue for ranged
      case "hero": return 0xffcc00;   // Gold for hero
      default: return 0xaaaaaa;       // Gray for unknown
    }
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
