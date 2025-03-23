import Phaser from "phaser";
import { FactionType, TechInfo, UnitType, BuildingType } from "../types";
import { TECH_COSTS } from "../config";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { Unit } from "../entities/Unit";
import { Building } from "../entities/Building";

export class TechManager {
  private scene: Phaser.Scene;
  private technologies: Map<string, TechInfo>;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.technologies = new Map();
    this.initializeTechTree();
  }
  
  initializeTechTree() {
    // ----- MILITARY TECHNOLOGIES -----
    
    // Common military technologies
    this.addTech({
      id: "advancedMetalworking",
      name: "Advanced Metalworking",
      description: "Better weapons and armor for all units",
      cost: TECH_COSTS.basic,
      prerequisites: [],
      effects: { attack: 2, defense: 2 },
      unlocks: {},
      researched: false
    });
    
    this.addTech({
      id: "improvedWeaponry",
      name: "Improved Weaponry",
      description: "Steel-crafted weapons increase unit attack power",
      cost: TECH_COSTS.advanced,
      prerequisites: ["advancedMetalworking"],
      effects: { attack: 3 },
      unlocks: {},
      researched: false
    });
    
    this.addTech({
      id: "combatFormations",
      name: "Combat Formations",
      description: "Units fight more effectively in groups",
      cost: TECH_COSTS.advanced,
      prerequisites: ["advancedMetalworking"],
      effects: { attack: 1, groupBonus: 0.5 },
      unlocks: {},
      researched: false
    });
    
    this.addTech({
      id: "advancedTraining",
      name: "Advanced Training",
      description: "Units gain combat experience faster",
      cost: TECH_COSTS.elite,
      prerequisites: ["combatFormations"],
      effects: { experienceRate: 1.5 },
      unlocks: {},
      researched: false
    });
    
    // Nephite military technologies
    this.addTech({
      id: "nephiteShields",
      name: "Nephite Shields",
      description: "Improved shield design offers better protection",
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
      prerequisites: ["nephiteShields"],
      effects: { rangedAttack: 3, rangedRange: 1 },
      unlocks: { buildings: ["archeryRange"] },
      faction: "Nephites",
      researched: false
    });
    
    this.addTech({
      id: "captainMoroniTactics",
      name: "Captain Moroni's Tactics",
      description: "Inspired military tactics greatly improve unit coordination",
      cost: TECH_COSTS.elite,
      prerequisites: ["nephiteArchery"],
      effects: { attack: 2, defense: 2, rangedAttack: 1 },
      unlocks: { units: ["hero"] },
      faction: "Nephites",
      researched: false
    });
    
    // Lamanite military technologies
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
    
    this.addTech({
      id: "lamaniteAmbushTactics",
      name: "Ambush Tactics",
      description: "Units gain significant attack bonus when initiating combat",
      cost: TECH_COSTS.elite,
      prerequisites: ["lamaniteSwiftness"],
      effects: { firstStrikeBonus: 5 },
      unlocks: { units: ["hero"] },
      faction: "Lamanites",
      researched: false
    });
    
    // ----- ECONOMY TECHNOLOGIES -----
    
    // Common economy technologies
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
    
    this.addTech({
      id: "advancedMining",
      name: "Advanced Mining",
      description: "Improved ore extraction techniques",
      cost: { food: 100, ore: 25 },
      prerequisites: [],
      effects: { oreGatherRate: 1.2 },
      unlocks: {},
      researched: false
    });
    
    this.addTech({
      id: "economyManagement",
      name: "Economy Management",
      description: "Better resource allocation and storage",
      cost: TECH_COSTS.advanced,
      prerequisites: ["improvedAgriculture", "advancedMining"],
      effects: { resourceStorage: 1.5 },
      unlocks: {},
      researched: false
    });
    
    // Nephite economy technologies
    this.addTech({
      id: "nephiteCraftsmen",
      name: "Nephite Craftsmen",
      description: "More efficient building construction",
      cost: { food: 120, ore: 80 },
      prerequisites: ["economyManagement"],
      effects: { buildingCostReduction: 0.9 },
      unlocks: {},
      faction: "Nephites",
      researched: false
    });
    
    // Lamanite economy technologies
    this.addTech({
      id: "lamaniteHunters",
      name: "Lamanite Hunters",
      description: "More efficient food gathering",
      cost: { food: 100, ore: 70 },
      prerequisites: ["improvedAgriculture"],
      effects: { foodGatherRate: 1.3 },
      unlocks: {},
      faction: "Lamanites",
      researched: false
    });
    
    // ----- DEFENSE TECHNOLOGIES -----
    
    // Common defense technologies
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
      id: "advancedFortifications",
      name: "Advanced Fortifications",
      description: "Improved defensive structures",
      cost: TECH_COSTS.advanced,
      prerequisites: ["fortifications"],
      effects: { buildingDefense: 8, buildingHealth: 1.2 },
      unlocks: {},
      researched: false
    });
    
    // Nephite defense technologies
    this.addTech({
      id: "nephiteDefensiveTactics",
      name: "Defensive Tactics",
      description: "Advanced defensive formations inspired by Captain Moroni",
      cost: TECH_COSTS.basic,
      prerequisites: ["fortifications"],
      effects: { defense: 3, buildingDefense: 2 },
      unlocks: {},
      faction: "Nephites",
      researched: false
    });
    
    this.addTech({
      id: "cityFortifications",
      name: "City Fortifications",
      description: "Heavily fortified cities modeled after Nephite strongholds",
      cost: TECH_COSTS.elite,
      prerequisites: ["nephiteDefensiveTactics", "advancedFortifications"],
      effects: { buildingHealth: 1.5, buildingDefense: 10 },
      unlocks: {},
      faction: "Nephites",
      researched: false
    });
    
    // Lamanite defense technologies
    this.addTech({
      id: "lamaniteOutposts",
      name: "Lamanite Outposts",
      description: "Strategic outposts to rally troops",
      cost: TECH_COSTS.advanced,
      prerequisites: ["fortifications"],
      effects: { unitProductionSpeed: 1.2 },
      unlocks: {},
      faction: "Lamanites",
      researched: false
    });
    
    // ----- SPECIAL TECHNOLOGIES -----
    
    // Nephite special technologies
    this.addTech({
      id: "nephiteRecords",
      name: "Nephite Record Keeping",
      description: "Knowledge from ancient records improves all aspects of society",
      cost: TECH_COSTS.elite,
      prerequisites: ["nephiteDefensiveTactics", "nephiteCraftsmen"],
      effects: { techCostReduction: 0.85, techResearchSpeed: 1.2 },
      unlocks: {},
      faction: "Nephites",
      researched: false
    });
    
    this.addTech({
      id: "titleOfLiberty",
      name: "Title of Liberty",
      description: "Captain Moroni's rallying banner inspires your troops",
      cost: TECH_COSTS.elite,
      prerequisites: ["captainMoroniTactics"],
      effects: { attack: 2, defense: 2, morale: 2 },
      unlocks: {},
      faction: "Nephites",
      researched: false
    });
    
    // Lamanite special technologies
    this.addTech({
      id: "lamaniteAlliances",
      name: "Lamanite Alliances",
      description: "Form alliances with other tribes to strengthen your forces",
      cost: TECH_COSTS.elite,
      prerequisites: ["lamaniteAmbushTactics"],
      effects: { unitProductionSpeed: 1.3, unitProductionCost: 0.9 },
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
    console.log(`Applying technology effects for ${tech.name}:`, tech.effects);
    
    // Get the game managers
    const unitManager = this.scene.game.registry.get("unitManager");
    const buildingManager = this.scene.game.registry.get("buildingManager");
    const resourceManager = this.scene.game.registry.get("resourceManager");
    
    // 1. Apply effects to existing units
    if (unitManager) {
      const playerUnits = unitManager.getUnitsByPlayer(playerId);
      
      playerUnits.forEach((unit: Unit) => {
        // Apply general stat bonuses
        if (tech.effects.attack) {
          unit.attack += tech.effects.attack;
        }
        if (tech.effects.defense) {
          unit.defense += tech.effects.defense;
        }
        if (tech.effects.speed) {
          unit.speed *= tech.effects.speed;
        }
        
        // Apply unit-specific bonuses
        if (unit.type === "ranged" && tech.effects.rangedAttack) {
          unit.attack += tech.effects.rangedAttack;
        }
        if (unit.type === "ranged" && tech.effects.rangedRange) {
          unit.range += tech.effects.rangedRange;
        }
        if (unit.type === "melee" && tech.effects.meleeAttack) {
          unit.attack += tech.effects.meleeAttack;
        }
        
        // Apply gathering rate bonuses to workers
        if (unit.type === "worker") {
          if (tech.effects.foodGatherRate) {
            unit.gatheringEfficiency *= tech.effects.foodGatherRate;
          }
          if (tech.effects.oreGatherRate) {
            unit.gatheringEfficiency *= tech.effects.oreGatherRate;
          }
        }
      });
      
      console.log(`Applied tech bonuses to ${playerUnits.length} units`);
    }
    
    // 2. Apply effects to buildings
    if (buildingManager) {
      const playerBuildings = buildingManager.getBuildingsByPlayer(playerId);
      
      playerBuildings.forEach((building: Building) => {
        // Apply general building bonuses
        if (tech.effects.buildingDefense) {
          building.defense += tech.effects.buildingDefense;
        }
        if (tech.effects.buildingHealth) {
          const healthBonus = building.maxHealth * (tech.effects.buildingHealth - 1);
          building.maxHealth *= tech.effects.buildingHealth;
          building.health += healthBonus; // Also increase current health
        }
        
        // Apply production speed bonuses
        if (tech.effects.unitProductionSpeed && 
            (building.type === "barracks" || building.type === "archeryRange" || building.type === "cityCenter")) {
          // Adjust production time for queued units
          if (building.productionQueue.length > 0) {
            building.productionQueue.forEach((item: { type: string; remainingTime: number }) => {
              item.remainingTime /= tech.effects.unitProductionSpeed;
            });
          }
        }
      });
      
      console.log(`Applied tech bonuses to ${playerBuildings.length} buildings`);
    }
    
    // 3. Apply resource/economy effects
    if (resourceManager && tech.effects.resourceStorage) {
      // For now we don't have a storage limit, but could be implemented later
      console.log(`Applied resource storage bonus: ${tech.effects.resourceStorage}`);
    }
    
    // 4. Unlock new buildings/units
    if (tech.unlocks) {
      if (tech.unlocks.buildings && tech.unlocks.buildings.length > 0) {
        console.log(`Unlocked buildings: ${tech.unlocks.buildings.join(", ")}`);
      }
      
      if (tech.unlocks.units && tech.unlocks.units.length > 0) {
        console.log(`Unlocked units: ${tech.unlocks.units.join(", ")}`);
      }
    }
    
    // Save this tech as researched in the game registry for persistence
    const researchedTechs = this.scene.game.registry.get("researchedTechs") || {};
    researchedTechs[tech.id] = true;
    this.scene.game.registry.set("researchedTechs", researchedTechs);
    
    // Trigger event for UI updates
    const event = new CustomEvent("techResearched", {
      detail: { techId: tech.id, playerId, tech }
    });
    document.dispatchEvent(event);
    
    // Show a visual effect to indicate the tech was researched
    this.showTechResearchedEffect(tech);
  }
  
  private showTechResearchedEffect(tech: TechInfo) {
    // Create a visual effect in the center of the screen to show tech completion
    const { width, height } = this.scene.cameras.main;
    
    // Create a glowing effect at the center of the screen
    const particles = this.scene.add.particles(width / 2, height / 2, 'particle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      lifespan: 1000,
      quantity: 1,
      frequency: 50,
      emitting: true
    });
    
    // Display tech name
    const techText = this.scene.add.text(width / 2, height / 2, `${tech.name} Researched!`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5);
    
    // Animation to fade out
    this.scene.tweens.add({
      targets: [particles, techText],
      alpha: 0,
      duration: 2000,
      delay: 1000,
      onComplete: () => {
        particles.destroy();
        techText.destroy();
      }
    });
    
    // Play a sound
    const audioState = this.scene.game.registry.get("audioState");
    if (audioState && !audioState.isMuted && audioState.playSuccess) {
      audioState.playSuccess();
    }
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
