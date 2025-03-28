import Phaser from "phaser";
import { FactionType, ResourceType } from "../types";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { 
  RESOURCE_GATHER_RATE, 
  RESOURCE_DECAY_RATE, 
  RESOURCE_CARRY_CAPACITY,
  FACTION_GATHER_BONUSES 
} from "../config";
import { phaserEvents, EVENTS } from "../events/PhaserEvents";

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
    
    const resources = {
      food: startingFood,
      ore: startingOre
    };
    
    this.resources.set(playerId, resources);
    
    // Log initial resources
    console.log(`Player ${playerId} (${faction}) starting resources: ${startingFood} food, ${startingOre} ore`);
    
    // Emit resources updated event
    phaserEvents.emit(EVENTS.RESOURCES_UPDATED, {
      playerId,
      resources
    });
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
    
    // Emit resources updated event
    phaserEvents.emit(EVENTS.RESOURCES_UPDATED, {
      playerId,
      resources: playerResources
    });
    
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
    
    // Emit resources updated event
    phaserEvents.emit(EVENTS.RESOURCES_UPDATED, {
      playerId,
      resources: playerResources
    });
    
    return true;
  }
  
  updateResources(playerId: string, resources: { food: number; ore: number }) {
    this.resources.set(playerId, resources);
    
    // Emit resources updated event
    phaserEvents.emit(EVENTS.RESOURCES_UPDATED, {
      playerId,
      resources
    });
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
  
  /**
   * Apply faction-specific bonuses to resource gathering
   * @param playerId Player's ID
   * @param resourceType Type of resource being gathered
   * @param baseAmount Base amount without bonuses
   * @returns Final amount after applying bonuses
   */
  applyFactionGatheringBonuses(playerId: string, resourceType: ResourceType, baseAmount: number): number {
    // Get the player's faction
    const players = this.scene.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    
    if (!player) return baseAmount;
    
    const faction = player.faction as FactionType;
    
    // Apply faction-specific bonuses from config
    if (faction && FACTION_GATHER_BONUSES[faction]) {
      const bonus = FACTION_GATHER_BONUSES[faction][resourceType];
      if (bonus) {
        const adjustedAmount = Math.round(baseAmount * bonus);
        console.log(`Applied ${faction} gathering bonus for ${resourceType}: ${baseAmount} → ${adjustedAmount}`);
        return adjustedAmount;
      }
    }
    
    return baseAmount;
  }
  
  /**
   * Gets the maximum amount of resources a unit can carry
   * @param unitType Type of unit
   * @returns Maximum carry capacity
   */
  getResourceCarryCapacity(unitType: string): number {
    if (RESOURCE_CARRY_CAPACITY[unitType as keyof typeof RESOURCE_CARRY_CAPACITY]) {
      return RESOURCE_CARRY_CAPACITY[unitType as keyof typeof RESOURCE_CARRY_CAPACITY];
    }
    
    // Default capacity if not specified
    return 10;
  }
  
  /**
   * Calculates resource depletion based on gathering
   * @param currentAmount Current resource amount
   * @returns Updated resource amount after depletion
   */
  calculateResourceDepletion(currentAmount: number): number {
    // Apply decay rate
    const newAmount = Math.max(0, currentAmount - (currentAmount * RESOURCE_DECAY_RATE));
    return Math.floor(newAmount);
  }
}
