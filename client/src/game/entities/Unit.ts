import Phaser from "phaser";
import { UnitType, FactionType } from "../types";
import { TILE_SIZE } from "../config";

export class Unit {
  id: string;
  type: UnitType;
  playerId: string;
  faction: FactionType;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  range: number;
  speed: number;
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  path: { x: number; y: number }[];
  sprite: Phaser.GameObjects.Container;
  healthBar: Phaser.GameObjects.Rectangle;
  selected: boolean;
  isMoving: boolean;
  isGathering: boolean;
  isAttacking: boolean;
  targetResourceX: number | null;
  targetResourceY: number | null;
  targetUnitId: string | null;
  carryingResource: { type: 'food' | 'ore', amount: number } | null;
  
  constructor(
    scene: Phaser.Scene,
    id: string,
    type: UnitType,
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
    this.targetX = null;
    this.targetY = null;
    this.path = [];
    this.selected = false;
    this.isMoving = false;
    this.isGathering = false;
    this.isAttacking = false;
    this.targetResourceX = null;
    this.targetResourceY = null;
    this.targetUnitId = null;
    this.carryingResource = null;
    
    // Set unit stats based on type and faction
    const stats = this.getUnitStats();
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.attack = stats.attack;
    this.defense = stats.defense;
    this.range = stats.range;
    this.speed = stats.speed;
    
    // Create sprite
    this.sprite = this.createSprite(scene);
    
    // Create health bar
    const healthBarBg = scene.add.rectangle(0, -15, 30, 5, 0x000000);
    this.healthBar = scene.add.rectangle(-15, -15, 30, 5, 0x00ff00)
      .setOrigin(0, 0);
    
    // Add components to container
    this.sprite.add([healthBarBg, this.healthBar]);
  }
  
  private createSprite(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const container = scene.add.container(this.x, this.y);
    
    // Theme colors based on Book of Mormon factions
    let colorMain = 0x3366cc; // Nephite blue (royal blue, represents righteousness)
    let colorTrim = 0xc0c0c0; // Silver trim for Nephites (represents armor/weapons)
    let colorAccent = 0xffcc00; // Gold accent for Nephites (represents prosperity/spirituality)
    
    if (this.faction === "Lamanites") {
      colorMain = 0xcc3300; // Lamanite red (darker red, represents fierceness)
      colorTrim = 0x663300; // Brown trim for Lamanites (represents their descriptions)
      colorAccent = 0xff9900; // Orange accent for Lamanites (represents war paint)
    }
    
    // Create base shape based on unit type
    let unitShape: Phaser.GameObjects.Shape;
    let unitSymbol: Phaser.GameObjects.Text;
    let unitDetails: Phaser.GameObjects.Shape[] = [];
    
    if (this.type === "worker") {
      // Worker - represents common people/laborers in the Book of Mormon
      unitShape = scene.add.circle(0, 0, 10, colorMain);
      
      // Add farming/building tool symbol
      const tool = scene.add.rectangle(-5, 0, 2, 14, colorTrim)
        .setRotation(Math.PI / 6);
      unitDetails.push(tool);
      
      // Worker symbol
      unitSymbol = scene.add.text(0, -2, "W", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff"
      }).setOrigin(0.5);
      
    } else if (this.type === "melee") {
      // Melee unit - represents warriors in the Book of Mormon
      unitShape = scene.add.rectangle(0, 0, 20, 20, colorMain);
      
      // Add shield detail
      const shield = scene.add.rectangle(-6, 0, 6, 12, colorTrim);
      unitDetails.push(shield);
      
      // Add weapon detail (sword or spear)
      const weapon = scene.add.rectangle(8, -2, 12, 2, colorAccent)
        .setRotation(Math.PI / 4);
      unitDetails.push(weapon);
      
      // Melee unit symbol
      unitSymbol = scene.add.text(0, -2, "M", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 1
      }).setOrigin(0.5);
      
    } else if (this.type === "ranged") {
      // Ranged unit - represents archers in the Book of Mormon
      unitShape = scene.add.triangle(0, 0, 0, -14, 10, 10, -10, 10, colorMain);
      
      // Add bow detail
      const bow = scene.add.ellipse(0, 0, 6, 20, colorTrim);
      // Add arrow detail
      const arrow = scene.add.rectangle(6, 0, 14, 1, colorAccent);
      unitDetails.push(bow, arrow);
      
      // Ranged unit symbol
      unitSymbol = scene.add.text(0, -2, "R", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 1
      }).setOrigin(0.5);
      
    } else { // Hero unit
      // Hero units are larger and more detailed
      const heroSize = 24;
      
      if (this.faction === "Nephites") {
        // Captain Moroni - Nephite hero
        unitShape = scene.add.star(0, 0, 6, 12, heroSize, colorMain);
        
        // Add shield and sword
        const shield = scene.add.rectangle(-8, 2, 8, 16, colorTrim);
        const sword = scene.add.rectangle(8, -4, 20, 3, 0xdddddd)
          .setRotation(Math.PI / 6);
        // Add banner (Title of Liberty)
        const banner = scene.add.rectangle(3, -12, 4, 18, colorAccent);
        
        unitDetails.push(shield, sword, banner);
        
        // Captain Moroni symbol
        unitSymbol = scene.add.text(0, -3, "M", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
          fontStyle: "bold"
        }).setOrigin(0.5);
        
      } else { // Lamanites
        // King Ammoron - Lamanite hero
        // Create a polygon for the Lamanite hero (pentagon-like shape)
        const pentagonPoints = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2 / 5) - (Math.PI / 2); // Start at top
          pentagonPoints.push(Math.cos(angle) * heroSize);
          pentagonPoints.push(Math.sin(angle) * heroSize);
        }
        unitShape = scene.add.polygon(0, 0, pentagonPoints, colorMain);
        
        // Add war club and headdress
        const club = scene.add.rectangle(10, 0, 18, 5, colorTrim)
          .setRotation(Math.PI / 3);
        const headdress = scene.add.triangle(0, -10, 0, -5, 12, -20, -12, -20, colorAccent);
        
        unitDetails.push(club, headdress);
        
        // King Ammoron symbol
        unitSymbol = scene.add.text(0, -3, "A", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
          fontStyle: "bold"
        }).setOrigin(0.5);
      }
    }
    
    // Faction-specific embellishments
    if (this.faction === "Nephites") {
      // Add Nephite emblem (based on descriptions of their standards/badges)
      if (this.type !== "worker" && this.type !== "hero") {
        const emblem = scene.add.circle(0, 5, 3, colorAccent);
        unitDetails.push(emblem);
      }
    } else { // Lamanites
      // Add Lamanite war markings
      if (this.type !== "worker" && this.type !== "hero") {
        const warMark = scene.add.rectangle(0, -6, 10, 2, colorAccent);
        unitDetails.push(warMark);
      }
    }
    
    // Special aura for hero units
    if (this.type === "hero") {
      const aura = scene.add.circle(0, 0, 28, this.faction === "Nephites" ? 0x3366cc : 0xcc3300, 0.2)
        .setStrokeStyle(1, colorAccent);
      container.add(aura);
    }
    
    // Selection indicator (hidden by default)
    const selectionRadius = this.type === "hero" ? 30 : 18;
    const selectionCircle = scene.add.circle(0, 0, selectionRadius, 0xffff00, 0)
      .setStrokeStyle(2, 0xffff00);
    
    // Add everything to the container
    container.add([unitShape, ...unitDetails, unitSymbol, selectionCircle]);
    
    // Set interactive area (for mouse interactions)
    const interactiveSize = this.type === "hero" ? 40 : 30;
    container.setSize(interactiveSize, interactiveSize);
    
    return container;
  }
  
  private getUnitStats() {
    let stats = {
      health: 100,
      attack: 10,
      defense: 5,
      range: 1,
      speed: 100
    };
    
    // Base stats by unit type
    if (this.type === "worker") {
      stats = {
        health: 50,
        attack: 3,
        defense: 1,
        range: 1,
        speed: 100
      };
    } else if (this.type === "melee") {
      stats = {
        health: 100,
        attack: 15,
        defense: 10,
        range: 1,
        speed: 80
      };
    } else if (this.type === "ranged") {
      stats = {
        health: 60,
        attack: 12,
        defense: 3,
        range: 4,
        speed: 70
      };
    } else if (this.type === "hero") {
      // Hero units based on Book of Mormon figures
      if (this.faction === "Nephites") {
        // Captain Moroni - known for his leadership and battle strategy
        stats = {
          health: 200,
          attack: 25,
          defense: 20,
          range: 2, // Can inspire nearby units
          speed: 90
        };
      } else { // Lamanites
        // King Ammoron - fierce Lamanite leader
        stats = {
          health: 180,
          attack: 30,
          defense: 15,
          range: 1,
          speed: 95
        };
      }
    }
    
    // Apply faction bonuses
    if (this.faction === "Nephites") {
      // Nephites have stronger defense
      stats.defense += 2;
      
      // Nephites have better organization
      if (this.type === "ranged") {
        stats.range += 1; // Increased range due to better positioning
      }
    } else if (this.faction === "Lamanites") {
      // Lamanites have stronger attack
      stats.attack += 3;
      
      // Lamanites excel at melee combat
      if (this.type === "melee") {
        stats.attack += 2;
        stats.speed += 5; // More ferocious in battle
      }
    }
    
    return stats;
  }
  
  update(delta: number) {
    // Update health bar
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = 30 * healthPercent;
    this.healthBar.fillColor = healthPercent > 0.5 ? 0x00ff00 : 0xff0000;
    
    // Find the text symbol in the container
    let unitSymbol: Phaser.GameObjects.Text | null = null;
    for (let i = 0; i < this.sprite.length; i++) {
      const gameObject = this.sprite.getAt(i);
      if (gameObject instanceof Phaser.GameObjects.Text) {
        unitSymbol = gameObject;
        break;
      }
    }
    
    // Visual indication for carrying resources
    if (this.carryingResource && unitSymbol) {
      unitSymbol.setText(this.carryingResource.type === 'food' ? 'F' : 'O');
      // Make the carried resource more visible
      if (this.carryingResource.type === 'food') {
        unitSymbol.setStyle({ color: '#22ff22' }); // Green for food
      } else {
        unitSymbol.setStyle({ color: '#cc9966' }); // Brown for ore
      }
    } else if (unitSymbol) {
      // Reset to default text based on unit type
      if (this.type === "hero") {
        // Heroes have their own symbols (M for Moroni or A for Ammoron)
        const symbol = this.faction === "Nephites" ? "M" : "A";
        unitSymbol.setText(symbol);
        unitSymbol.setStyle({ 
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          fontStyle: "bold"
        });
      } else {
        // Normal units
        unitSymbol.setText(this.type === 'worker' ? 'W' : this.type === 'melee' ? 'M' : 'R');
        unitSymbol.setStyle({ 
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 1
        });
      }
    }
    
    // Animate hero units with a pulsing effect
    if (this.type === "hero") {
      // Find the aura element (should be the first element in the container)
      const aura = this.sprite.getAt(0) as Phaser.GameObjects.Shape;
      if (aura) {
        const time = new Date().getTime();
        // Pulse the aura alpha
        const pulse = (Math.sin(time / 500) + 1) / 4 + 0.1; // Value between 0.1 and 0.6
        aura.setAlpha(pulse);
      }
    }
    
    // Find and update selection indicator
    // Selection circle should be the last item in the container
    const selectionCircle = this.sprite.getAt(this.sprite.length - 1) as Phaser.GameObjects.Shape;
    if (selectionCircle) {
      selectionCircle.setVisible(this.selected);
    }
    
    // Add animation for movement
    if (this.isMoving && this.path.length > 0) {
      // Add a slight bobbing motion when moving
      const time = new Date().getTime();
      const wobble = Math.sin(time / 150) * 0.5;
      this.sprite.y = this.y + wobble;
      
      // Move along path
      this.moveAlongPath(delta);
    }
  }
  
  setSelected(selected: boolean) {
    this.selected = selected;
  }
  
  takeDamage(amount: number) {
    this.health -= Math.max(1, amount - this.defense / 2);
    
    // Play hit sound if damaged
    if (amount > 0) {
      const audioElement = document.getElementById('hit-sound') as HTMLAudioElement;
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.log("Sound play prevented:", e));
      }
    }
    
    // Check if unit died
    if (this.health <= 0) {
      return true; // Unit died
    }
    return false; // Unit still alive
  }
  
  setPath(path: { x: number; y: number }[]) {
    this.path = path;
    this.isMoving = true;
  }
  
  moveAlongPath(delta: number) {
    if (this.path.length === 0) {
      this.isMoving = false;
      return;
    }
    
    // Get the next waypoint
    const nextWaypoint = this.path[0];
    const targetX = nextWaypoint.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = nextWaypoint.y * TILE_SIZE + TILE_SIZE / 2;
    
    // Calculate direction and distance
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if we arrived at the waypoint
    if (distance < 5) {
      this.path.shift();
      return;
    }
    
    // Move toward waypoint
    const moveSpeedPerFrame = (this.speed / 1000) * delta;
    const moveDistance = Math.min(distance, moveSpeedPerFrame);
    const directionX = dx / distance;
    const directionY = dy / distance;
    
    this.x += directionX * moveDistance;
    this.y += directionY * moveDistance;
    
    // Update sprite position
    this.sprite.setPosition(this.x, this.y);
  }
  
  stopMoving() {
    this.isMoving = false;
    this.path = [];
  }
  
  setGatheringResource(tileX: number, tileY: number) {
    this.isGathering = true;
    this.targetResourceX = tileX;
    this.targetResourceY = tileY;
  }
  
  stopGathering() {
    this.isGathering = false;
    this.targetResourceX = null;
    this.targetResourceY = null;
  }
  
  setAttackingTarget(targetUnitId: string) {
    this.isAttacking = true;
    this.targetUnitId = targetUnitId;
  }
  
  stopAttacking() {
    this.isAttacking = false;
    this.targetUnitId = null;
  }
  
  startCarryingResource(type: 'food' | 'ore', amount: number) {
    this.carryingResource = { type, amount };
  }
  
  stopCarryingResource() {
    this.carryingResource = null;
  }
}
