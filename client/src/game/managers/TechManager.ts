import Phaser from "phaser";
import { FactionType, TechInfo } from "../types";
import { TECH_COSTS } from "../config";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";

export class TechManager {
  private scene: Phaser.Scene;
  private technologies: Map<string, TechInfo>;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.technologies = new Map();
    this.initializeTechTree();
  }
  
  initializeTechTree() {
    // Common tech for both factions
    this.addTech({
      id: "fortifications",
      name: "Fortifications",
      description: "Stronger walls and better defenses",
      cost: TECH_COSTS.basic,
      prerequisites: [],
      effects: { buildingDefense: 5 },
      unlocks: { buildings: ["wall"] },
      researched: false
    });
    
    this.addTech({
      id: "advancedMetalworking",
      name: "Advanced Metalworking",
      description: "Better weapons and armor for all units",
      cost: TECH_COSTS.advanced,
      prerequisites: [],
      effects: { attack: 2, defense: 2 },
      unlocks: {},
      researched: false
    });
    
    this.addTech({
      id: "improvedAgriculture",
      name: "Improved Agriculture",
      description: "More efficient food production",
      cost: { food: 75, ore: 50 },
      prerequisites: [],
      effects: { foodGatherRate: 1.2 },
      unlocks: {},
      researched: false
    });
    
    // Nephite specific technologies
    this.addTech({
      id: "nephiteDefensiveTactics",
      name: "Defensive Tactics",
      description: "Nephite units gain improved defensive capabilities",
      cost: TECH_COSTS.basic,
      prerequisites: [],
      effects: { defense: 3 },
      unlocks: {},
      faction: "Nephites",
      researched: false
    });
    
    this.addTech({
      id: "nephiteArchery",
      name: "Advanced Archery",
      description: "Nephite ranged units gain increased range and damage",
      cost: TECH_COSTS.advanced,
      prerequisites: ["nephiteDefensiveTactics"],
      effects: { rangedAttack: 3, rangedRange: 1 },
      unlocks: { buildings: ["archeryRange"] },
      faction: "Nephites",
      researched: false
    });
    
    // Lamanite specific technologies
    this.addTech({
      id: "lamaniteWarriorTraining",
      name: "Warrior Training",
      description: "Lamanite melee units gain improved attack power",
      cost: TECH_COSTS.basic,
      prerequisites: [],
      effects: { meleeAttack: 4 },
      unlocks: {},
      faction: "Lamanites",
      researched: false
    });
    
    this.addTech({
      id: "lamaniteSwiftness",
      name: "Swiftness",
      description: "Lamanite units move faster",
      cost: TECH_COSTS.advanced,
      prerequisites: ["lamaniteWarriorTraining"],
      effects: { speed: 1.2 },
      unlocks: {},
      faction: "Lamanites",
      researched: false
    });
  }
  
  private addTech(tech: TechInfo) {
    this.technologies.set(tech.id, tech);
  }
  
  getTechnologies(playerId: string, faction: FactionType): TechInfo[] {
    const playerTechs: TechInfo[] = [];
    
    this.technologies.forEach(tech => {
      // Include tech if it's common (no faction) or matches player's faction
      if (!tech.faction || tech.faction === faction) {
        playerTechs.push({ ...tech });
      }
    });
    
    return playerTechs;
  }
  
  getResearchableTechs(playerId: string, faction: FactionType): TechInfo[] {
    const playerTechs = this.getTechnologies(playerId, faction);
    
    // Filter to only show technologies that can be researched
    return playerTechs.filter(tech => {
      // If already researched, skip
      if (tech.researched) {
        return false;
      }
      
      // Check prerequisites
      if (tech.prerequisites.length > 0) {
        for (const prereq of tech.prerequisites) {
          const prerequisiteTech = this.technologies.get(prereq);
          if (!prerequisiteTech || !prerequisiteTech.researched) {
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  researchTechnology(techId: string, playerId: string): boolean {
    const tech = this.technologies.get(techId);
    if (!tech) {
      console.warn(`Technology not found: ${techId}`);
      return false;
    }
    
    // Check if already researched
    if (tech.researched) {
      console.warn(`Technology already researched: ${techId}`);
      return false;
    }
    
    // Get resource manager
    const resourceManager = this.scene.game.registry.get("resourceManager");
    if (!resourceManager) {
      console.error("Resource manager not found");
      return false;
    }
    
    // Check if player has enough resources
    if (!resourceManager.hasEnoughResources(
      playerId,
      tech.cost.food,
      tech.cost.ore
    )) {
      console.warn(`Not enough resources to research: ${techId}`);
      return false;
    }
    
    // Deduct resources
    resourceManager.removeResource(playerId, "food", tech.cost.food);
    resourceManager.removeResource(playerId, "ore", tech.cost.ore);
    
    // Mark as researched
    tech.researched = true;
    this.technologies.set(techId, tech);
    
    // Apply effects
    this.applyTechEffects(tech, playerId);
    
    // Sync with server (in a real implementation)
    const multiplayerStore = useMultiplayer.getState();
    multiplayerStore.researchTech(techId);
    
    console.log(`Successfully researched technology: ${tech.name}`);
    return true;
  }
  
  private applyTechEffects(tech: TechInfo, playerId: string) {
    // This would apply stat bonuses to units and buildings
    // For demo, we'll just log the effects
    console.log(`Applied technology effects for ${tech.name}:`, tech.effects);
    
    // In a full implementation, this would:
    // 1. Update stats for existing units
    // 2. Update stats for future units
    // 3. Update building stats
    // 4. Unlock new unit types or buildings
    
    // For now, just notify UI to refresh
    const event = new CustomEvent("techResearched", {
      detail: { techId: tech.id, playerId }
    });
    document.dispatchEvent(event);
  }
  
  isTechResearched(techId: string): boolean {
    const tech = this.technologies.get(techId);
    return tech ? tech.researched : false;
  }
  
  getTechById(techId: string): TechInfo | undefined {
    return this.technologies.get(techId);
  }
  
  getUnitBonus(unitType: string, playerId: string, stat: string): number {
    let bonus = 0;
    
    // Sum up all bonuses from researched technologies
    this.technologies.forEach(tech => {
      if (tech.researched) {
        if (tech.effects[stat]) {
          bonus += tech.effects[stat];
        }
        
        // Check for unit-specific bonuses
        if (unitType === "ranged" && tech.effects[`ranged${stat.charAt(0).toUpperCase() + stat.slice(1)}`]) {
          bonus += tech.effects[`ranged${stat.charAt(0).toUpperCase() + stat.slice(1)}`];
        }
        
        if (unitType === "melee" && tech.effects[`melee${stat.charAt(0).toUpperCase() + stat.slice(1)}`]) {
          bonus += tech.effects[`melee${stat.charAt(0).toUpperCase() + stat.slice(1)}`];
        }
      }
    });
    
    return bonus;
  }
  
  getBuildingBonus(buildingType: string, playerId: string, stat: string): number {
    let bonus = 0;
    
    // Sum up all bonuses from researched technologies
    this.technologies.forEach(tech => {
      if (tech.researched && tech.effects[`building${stat.charAt(0).toUpperCase() + stat.slice(1)}`]) {
        bonus += tech.effects[`building${stat.charAt(0).toUpperCase() + stat.slice(1)}`];
      }
    });
    
    return bonus;
  }
}
