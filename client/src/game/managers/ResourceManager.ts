import Phaser from "phaser";
import { FactionType, ResourceType } from "../types";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";

export class ResourceManager {
  private scene: Phaser.Scene;
  private resources: Map<string, { food: number; ore: number }>;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.resources = new Map();
  }
  
  initializePlayerResources(playerId: string, faction: FactionType) {
    // Set starting resources based on faction
    let startingFood = 200;
    let startingOre = 100;
    
    // Faction bonuses
    if (faction === "Lamanites") {
      // Lamanites start with more resources
      startingFood += 100;
      startingOre += 50;
    }
    
    this.resources.set(playerId, {
      food: startingFood,
      ore: startingOre
    });
    
    // Log initial resources
    console.log(`Player ${playerId} (${faction}) starting resources: ${startingFood} food, ${startingOre} ore`);
  }
  
  getPlayerResources(playerId: string) {
    return this.resources.get(playerId) || { food: 0, ore: 0 };
  }
  
  addResource(playerId: string, type: ResourceType, amount: number) {
    const playerResources = this.getPlayerResources(playerId);
    
    if (type === "food") {
      playerResources.food += amount;
    } else if (type === "ore") {
      playerResources.ore += amount;
    }
    
    this.resources.set(playerId, playerResources);
    
    // If this is the local player, sync with server
    if (playerId === this.scene.game.registry.get("localPlayerId")) {
      this.syncResourcesWithServer(playerId);
    }
    
    return playerResources;
  }
  
  removeResource(playerId: string, type: ResourceType, amount: number): boolean {
    const playerResources = this.getPlayerResources(playerId);
    
    // Check if player has enough resources
    if (type === "food" && playerResources.food < amount) {
      return false;
    } else if (type === "ore" && playerResources.ore < amount) {
      return false;
    }
    
    // Deduct resources
    if (type === "food") {
      playerResources.food -= amount;
    } else if (type === "ore") {
      playerResources.ore -= amount;
    }
    
    this.resources.set(playerId, playerResources);
    
    // If this is the local player, sync with server
    if (playerId === this.scene.game.registry.get("localPlayerId")) {
      this.syncResourcesWithServer(playerId);
    }
    
    return true;
  }
  
  updateResources(playerId: string, resources: { food: number; ore: number }) {
    this.resources.set(playerId, resources);
  }
  
  hasEnoughResources(playerId: string, foodCost: number, oreCost: number): boolean {
    const playerResources = this.getPlayerResources(playerId);
    return playerResources.food >= foodCost && playerResources.ore >= oreCost;
  }
  
  deductResourcesForUnit(playerId: string, unitType: string): boolean {
    let foodCost = 0;
    let oreCost = 0;
    
    // Set costs based on unit type
    if (unitType === "worker") {
      foodCost = 50;
      oreCost = 0;
    } else if (unitType === "melee") {
      foodCost = 75;
      oreCost = 50;
    } else if (unitType === "ranged") {
      foodCost = 60;
      oreCost = 80;
    }
    
    return this.removeResource(playerId, "food", foodCost) && 
           this.removeResource(playerId, "ore", oreCost);
  }
  
  deductResourcesForBuilding(playerId: string, buildingType: string): boolean {
    let foodCost = 0;
    let oreCost = 0;
    
    // Set costs based on building type
    if (buildingType === "barracks") {
      foodCost = 100;
      oreCost = 150;
    } else if (buildingType === "archeryRange") {
      foodCost = 150;
      oreCost = 100;
    } else if (buildingType === "wall") {
      foodCost = 50;
      oreCost = 200;
    }
    
    return this.removeResource(playerId, "food", foodCost) && 
           this.removeResource(playerId, "ore", oreCost);
  }
  
  private syncResourcesWithServer(playerId: string) {
    const playerResources = this.getPlayerResources(playerId);
    
    // Use the multiplayer store to sync resources
    const multiplayerStore = useMultiplayer.getState();
    multiplayerStore.updateResources(playerResources);
  }
  
  // Get resource costs for UI display
  getUnitCost(unitType: string): { food: number; ore: number } {
    if (unitType === "worker") {
      return { food: 50, ore: 0 };
    } else if (unitType === "melee") {
      return { food: 75, ore: 50 };
    } else if (unitType === "ranged") {
      return { food: 60, ore: 80 };
    }
    
    return { food: 0, ore: 0 };
  }
  
  getBuildingCost(buildingType: string): { food: number; ore: number } {
    if (buildingType === "barracks") {
      return { food: 100, ore: 150 };
    } else if (buildingType === "archeryRange") {
      return { food: 150, ore: 100 };
    } else if (buildingType === "wall") {
      return { food: 50, ore: 200 };
    }
    
    return { food: 0, ore: 0 };
  }
}
