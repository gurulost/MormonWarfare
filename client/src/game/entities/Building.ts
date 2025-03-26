import Phaser from "phaser";
import { BuildingType, FactionType } from "../types";
import { TILE_SIZE } from "../config";

export class Building {
  id: string;
  type: BuildingType;
  playerId: string;
  faction: FactionType;
  health: number;
  maxHealth: number;
  defense: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Container;
  healthBar: Phaser.GameObjects.Rectangle;
  selected: boolean;
  productionProgress: number;
  productionTime: number;
  isProducing: boolean;
  productionQueue: { type: string; remainingTime: number }[];
  size: number;
  
  // 3D model properties
  useCustomModel: boolean = false;
  modelPath: string | null = null;
  modelInstance: any = null; // Will hold three.js model reference when in 3D view
  
  // Production UI elements
  productionBar: Phaser.GameObjects.Rectangle | null = null;
  productionBarBg: Phaser.GameObjects.Rectangle | null = null;
  queueIndicators: Phaser.GameObjects.Container | null = null;
  
  constructor(
    scene: Phaser.Scene,
    id: string,
    type: BuildingType,
    playerId: string,
    faction: FactionType,
    x: number,
    y: number
  ) {
    this.id = id;
    this.type = type;
    this.playerId = playerId;
    this.faction = faction;
    this.x = x * TILE_SIZE + TILE_SIZE / 2;
    this.y = y * TILE_SIZE + TILE_SIZE / 2;
    this.selected = false;
    this.productionProgress = 0;
    this.productionTime = 0;
    this.isProducing = false;
    this.productionQueue = [];
    
    // Set building stats based on type
    const stats = this.getBuildingStats();
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.defense = stats.defense;
    this.size = stats.size;
    
    // Create sprite
    this.sprite = this.createSprite(scene);
    
    // Create health bar
    const healthBarBg = scene.add.rectangle(0, -this.size * 10 - 10, this.size * 20, 8, 0x000000);
    this.healthBar = scene.add.rectangle(-this.size * 10, -this.size * 10 - 10, this.size * 20, 8, 0x00ff00)
      .setOrigin(0, 0);
    
    // Add components to container
    this.sprite.add([healthBarBg, this.healthBar]);
  }
  
  private createSprite(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const container = scene.add.container(this.x, this.y);
    
    // Determine color based on player and building type
    let colorMain = 0x3366cc; // Default blue for Nephites (updated to match units)
    let colorSecondary = 0xaaaaff;
    
    if (this.faction === "Lamanites") {
      colorMain = 0xcc3300; // Red for Lamanites (updated to match units)
      colorSecondary = 0xffaaaa;
    }
    
    // Special faction-specific buildings use custom 3D models
    if (this.type === "nephiteTemple" && this.faction === "Nephites") {
      // Use the Nephite Temple 3D model
      this.useCustomModel = true;
      this.modelPath = '/models/nephite_temple.glb';
      
      // Create a temporary placeholder for the 2D view
      const templePoly = [
        { x: 0, y: -30 },          // Top point
        { x: 30, y: -10 },         // Upper right
        { x: 25, y: 20 },          // Lower right
        { x: -25, y: 20 },         // Lower left
        { x: -30, y: -10 }         // Upper left
      ];
      
      const buildingShape = scene.add.polygon(0, 0, templePoly, colorMain);
      
      // Add temple details
      const stepsPoly = [
        { x: 0, y: 5 },            // Top center
        { x: 20, y: 10 },          // Upper right
        { x: 15, y: 25 },          // Lower right
        { x: -15, y: 25 },         // Lower left
        { x: -20, y: 10 }          // Upper left
      ];
      const steps = scene.add.polygon(0, 0, stepsPoly, 0xeeeedd); // Light stone color
      
      // Add altar symbol
      const altar = scene.add.circle(0, -15, 5, 0xffcc00); // Gold color
      
      // Temple text
      const buildingText = scene.add.text(0, 0, "TMPL", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 1
      }).setOrigin(0.5);
      
      // Add sacred aura (subtle glow)
      const aura = scene.add.circle(0, 0, 35, 0xffcc00, 0.2)
        .setStrokeStyle(1, 0xffcc00);
      
      // Selection indicator (hidden by default)
      const selectionRect = scene.add.rectangle(
        0, 0, 
        this.size * 25, 
        this.size * 25, 
        0xffff00, 0
      ).setStrokeStyle(2, 0xffff00);
      
      // Add everything to the container
      container.add([aura, buildingShape, steps, altar, buildingText, selectionRect]);
    
    } else if (this.type === "lamaniteTower" && this.faction === "Lamanites") {
      // Use the Lamanite Watch Tower 3D model
      this.useCustomModel = true;
      this.modelPath = '/models/lamanite_tower.glb';
      
      // Create a temporary placeholder for the 2D view
      const towerBase = scene.add.rectangle(0, 10, 25, 20, 0x886655); // Brown base
      const towerTop = scene.add.rectangle(0, -12, 15, 15, colorMain); // Red top platform
      
      // Add tower pole
      const pole = scene.add.rectangle(0, 0, 5, 40, 0x663300); // Dark wood
      
      // Add tribal decorations
      const flag1 = scene.add.triangle(10, -15, 0, 0, 0, 10, 15, 5, 0xff9900); // Orange flag
      const flag2 = scene.add.triangle(-10, -10, 0, 0, 0, 10, -15, 5, 0xff9900); // Orange flag
      
      // Tower text
      const buildingText = scene.add.text(0, 0, "TOWR", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 1
      }).setOrigin(0.5);
      
      // Add vision range indicator
      const visionRange = scene.add.circle(0, 0, 40, 0xff9900, 0.1)
        .setStrokeStyle(1, 0xff9900);
      
      // Selection indicator (hidden by default)
      const selectionRect = scene.add.rectangle(
        0, 0, 
        this.size * 25, 
        this.size * 25, 
        0xffff00, 0
      ).setStrokeStyle(2, 0xffff00);
      
      // Add everything to the container
      container.add([visionRange, towerBase, pole, towerTop, flag1, flag2, buildingText, selectionRect]);
    
    } else {
      // Regular buildings use standard shapes
      let buildingShape: Phaser.GameObjects.Shape;
      let buildingText: Phaser.GameObjects.Text;
      
      if (this.type === "cityCenter") {
        // City center is a large square
        buildingShape = scene.add.rectangle(0, 0, this.size * 20, this.size * 20, colorMain);
        buildingText = scene.add.text(0, 0, "CITY", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff"
        }).setOrigin(0.5);
      } else if (this.type === "barracks") {
        // Barracks is a rectangle
        buildingShape = scene.add.rectangle(0, 0, this.size * 20, this.size * 15, colorMain);
        buildingText = scene.add.text(0, 0, "BRK", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff"
        }).setOrigin(0.5);
      } else if (this.type === "archeryRange") {
        // Archery range is a pentagon
        const radius = this.size * 10;
        buildingShape = scene.add.polygon(0, 0, [
          { x: 0, y: -radius },
          { x: radius * 0.95, y: -radius * 0.3 },
          { x: radius * 0.58, y: radius * 0.8 },
          { x: -radius * 0.58, y: radius * 0.8 },
          { x: -radius * 0.95, y: -radius * 0.3 }
        ], colorMain);
        buildingText = scene.add.text(0, 0, "ARC", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff"
        }).setOrigin(0.5);
      } else if (this.type === "wall") {
        // Wall is a long rectangle
        buildingShape = scene.add.rectangle(0, 0, this.size * 30, this.size * 5, colorMain);
        buildingText = scene.add.text(0, 0, "WALL", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#ffffff"
        }).setOrigin(0.5);
      } else {
        // Generic building shape for other types
        buildingShape = scene.add.rectangle(0, 0, this.size * 20, this.size * 20, colorMain);
        buildingText = scene.add.text(0, 0, "BLD", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff"
        }).setOrigin(0.5);
      }
      
      // Selection indicator (hidden by default)
      const selectionRect = scene.add.rectangle(
        0, 0, 
        this.size * 25, 
        this.size * 25, 
        0xffff00, 0
      ).setStrokeStyle(2, 0xffff00);
      
      // Add everything to the container
      container.add([buildingShape, buildingText, selectionRect]);
    }
    
    return container;
  }
  
  private getBuildingStats() {
    let stats = {
      health: 500,
      defense: 10,
      size: 2
    };
    
    // Stats by building type
    if (this.type === "cityCenter") {
      stats = {
        health: 1000,
        defense: 15,
        size: 3
      };
    } else if (this.type === "barracks") {
      stats = {
        health: 600,
        defense: 12,
        size: 2
      };
    } else if (this.type === "archeryRange") {
      stats = {
        health: 500,
        defense: 8,
        size: 2
      };
    } else if (this.type === "wall") {
      stats = {
        health: 800,
        defense: 20,
        size: 1
      };
    } else if (this.type === "nephiteTemple") {
      // Nephite Temple - provides faith bonuses and special unit production
      stats = {
        health: 750,
        defense: 15,
        size: 3
      };
    } else if (this.type === "lamaniteTower") {
      // Lamanite Watch Tower - provides increased vision and scouting abilities
      stats = {
        health: 500,
        defense: 8,
        size: 2
      };
    }
    
    // Apply faction bonuses
    if (this.faction === "Nephites") {
      // Nephites have stronger buildings
      stats.defense += 5;
      if (this.type === "wall") {
        // Nephites excel at defense
        stats.health += 200;
      }
      if (this.type === "nephiteTemple") {
        // Temples are sacred and hard to destroy
        stats.defense += 10;
      }
    } else if (this.faction === "Lamanites") {
      // Lamanites have more offensive structures
      if (this.type === "lamaniteTower") {
        // Watch towers are built for spotting enemies
        stats.size += 1; // Taller towers
      }
      if (this.type === "barracks") {
        // Lamanite barracks produce units faster (handled elsewhere)
        // But are slightly less durable
        stats.health -= 50;
      }
    }
    
    return stats;
  }
  
  /**
   * Creates or updates the production UI elements
   */
  private updateProductionUI() {
    const scene = this.sprite.scene;
    
    // Create production bar if it doesn't exist yet but building can produce
    if (this.canProduce() && !this.productionBar) {
      // Position below the health bar
      this.productionBarBg = scene.add.rectangle(
        0, -this.size * 10 + 5, 
        this.size * 20, 6, 
        0x333333
      );
      
      this.productionBar = scene.add.rectangle(
        -this.size * 10, -this.size * 10 + 5, 
        0, 6, 
        0x00aaff
      ).setOrigin(0, 0);
      
      this.sprite.add([this.productionBarBg, this.productionBar]);
      
      // Create queue indicators container
      this.queueIndicators = scene.add.container(0, 0);
      this.sprite.add(this.queueIndicators);
    }
    
    // Update production bar if it exists
    if (this.productionBar && this.isProducing) {
      this.productionBar.width = this.size * 20 * this.productionProgress;
      this.productionBar.setVisible(true);
      if (this.productionBarBg) this.productionBarBg.setVisible(true);
    } else if (this.productionBar) {
      this.productionBar.setVisible(false);
      if (this.productionBarBg) this.productionBarBg.setVisible(false);
    }
    
    // Update queue indicators
    this.updateQueueIndicators();
  }
  
  /**
   * Updates the visual representation of the production queue
   */
  private updateQueueIndicators() {
    if (!this.queueIndicators) return;
    
    // Clear previous indicators
    this.queueIndicators.removeAll(true);
    
    // Create new indicators for each item in queue (skip the active one)
    const queueToShow = this.productionQueue.slice(1);
    
    // Determine indicator starting position (above the building)
    const startY = -this.size * 12;
    const startX = -this.size * 8;
    
    queueToShow.forEach((item, index) => {
      const scene = this.sprite.scene;
      
      // Each item has a background and a text label
      const bg = scene.add.circle(
        startX + index * 16, 
        startY, 
        6, 
        this.getColorForUnitType(item.type)
      );
      
      const label = scene.add.text(
        startX + index * 16,
        startY,
        this.getSymbolForUnitType(item.type), 
        {
          fontSize: '10px',
          color: '#ffffff',
          fontFamily: 'monospace'
        }
      ).setOrigin(0.5);
      
      if (this.queueIndicators) {
        this.queueIndicators.add([bg, label]);
      }
    });
  }
  
  /**
   * Get the appropriate color for a unit type
   */
  private getColorForUnitType(type: string): number {
    switch (type) {
      case "worker": return 0x33cc33;            // Green for workers
      case "melee": return 0xcc3333;             // Red for melee
      case "ranged": return 0x3333cc;            // Blue for ranged
      case "cavalry": return 0xcc66cc;           // Purple for cavalry
      case "hero": return 0xffcc00;              // Gold for hero
      case "striplingWarrior": return 0xffdd44;  // Bright gold for Stripling Warriors
      case "lamaniteScout": return 0xff9900;     // Orange for Lamanite Scouts
      default: return 0xaaaaaa;                  // Gray for unknown
    }
  }
  
  /**
   * Get the symbol to display for a unit type
   */
  private getSymbolForUnitType(type: string): string {
    switch (type) {
      case "worker": return "W";
      case "melee": return "M";  
      case "ranged": return "R";
      case "cavalry": return "C";
      case "hero": return "H";
      case "striplingWarrior": return "SW";
      case "lamaniteScout": return "SC";
      default: return "?";
    }
  }
  
  /**
   * Check if this building can produce units
   */
  private canProduce(): boolean {
    return this.type === "cityCenter" || 
           this.type === "barracks" || 
           this.type === "archeryRange" ||
           this.type === "nephiteTemple" || // Nephite temple can produce Stripling Warriors
           this.type === "lamaniteTower";   // Lamanite tower can produce Scout units
  }
  
  update(delta: number) {
    // Update health bar
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = this.size * 20 * healthPercent;
    this.healthBar.fillColor = healthPercent > 0.5 ? 0x00ff00 : 0xff0000;
    
    // Update selection indicator
    const selectionRect = this.sprite.getAt(2) as Phaser.GameObjects.Shape;
    selectionRect.setVisible(this.selected);
    
    // Update production
    let producedType = null;
    if (this.isProducing && this.productionQueue.length > 0) {
      const currentProduction = this.productionQueue[0];
      currentProduction.remainingTime -= delta;
      
      // Update production progress
      this.productionProgress = 1 - (currentProduction.remainingTime / this.productionTime);
      
      // Check if production completed
      if (currentProduction.remainingTime <= 0) {
        producedType = currentProduction.type;
        this.productionQueue.shift();
        
        // If queue is empty, stop producing
        if (this.productionQueue.length === 0) {
          this.isProducing = false;
        } else {
          // Start the next item in queue
          this.productionTime = this.getProductionTime(this.productionQueue[0].type);
          // Reset progress for new item
          this.productionProgress = 0;
        }
      }
    }
    
    // Update production UI elements
    this.updateProductionUI();
    
    return producedType; // Return the produced item or null
  }
  
  setSelected(selected: boolean) {
    this.selected = selected;
    
    // Update visual selection indicator
    if (this.sprite && this.sprite.list && this.sprite.list.length > 0) {
      // The selection indicator is typically the last item in the container
      const selectionIndicator = this.sprite.list[this.sprite.list.length - 1];
      if (selectionIndicator) {
        (selectionIndicator as Phaser.GameObjects.Rectangle).setAlpha(selected ? 0.3 : 0);
      }
    }
  }
  
  takeDamage(amount: number) {
    this.health -= Math.max(1, amount - this.defense / 2);
    
    // Check if building destroyed
    if (this.health <= 0) {
      return true; // Building destroyed
    }
    return false; // Building still standing
  }
  
  queueProduction(type: string) {
    // Initialize production time
    const productionTime = this.getProductionTime(type);
    
    // Add to production queue
    this.productionQueue.push({
      type,
      remainingTime: productionTime
    });
    
    // If not already producing, start production
    if (!this.isProducing) {
      this.isProducing = true;
      this.productionTime = productionTime;
    }
  }
  
  getProductionTime(type: string): number {
    // Base production time in milliseconds
    let baseTime = 10000; // Default 10 seconds
    
    switch (type) {
      case "worker":
        baseTime = 10000; // 10 seconds
        break;
      case "melee":
        baseTime = 15000; // 15 seconds
        break;
      case "ranged":
        baseTime = 20000; // 20 seconds
        break;
      case "striplingWarrior":
        baseTime = 25000; // 25 seconds - elite unit takes longer
        break;
      case "lamaniteScout":
        baseTime = 12000; // 12 seconds - scout unit is faster to produce
        break;
      case "cavalry": 
        baseTime = 30000; // 30 seconds - cavalry takes longer
        break;
      case "hero":
        baseTime = 60000; // 60 seconds - hero units take a long time
        break;
    }
    
    // Apply faction-specific production time modifiers
    if (this.faction === "Nephites") {
      // Nephite-specific production bonuses
      if (this.type === "nephiteTemple" && type === "striplingWarrior") {
        // Temples produce Stripling Warriors faster
        baseTime *= 0.8; // 20% faster
      }
    } else if (this.faction === "Lamanites") {
      // Lamanite-specific production bonuses
      if (this.type === "barracks" && (type === "melee" || type === "ranged")) {
        // Lamanites produce combat units faster from barracks
        baseTime *= 0.85; // 15% faster
      }
      if (this.type === "lamaniteTower" && type === "lamaniteScout") {
        // Watch Towers produce scouts even faster
        baseTime *= 0.7; // 30% faster
      }
    }
    
    return baseTime;
  }
  
  cancelProduction(index: number) {
    if (index < this.productionQueue.length) {
      // Remove from queue
      this.productionQueue.splice(index, 1);
      
      // If queue is now empty, stop producing
      if (this.productionQueue.length === 0) {
        this.isProducing = false;
      } else if (index === 0) {
        // If we removed the currently producing item, update to the next one
        this.productionTime = this.getProductionTime(this.productionQueue[0].type);
      }
    }
  }
  
  getProductionQueue() {
    return this.productionQueue;
  }
  
  getProductionProgress() {
    return this.productionProgress;
  }
}
