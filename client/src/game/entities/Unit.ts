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
    
    // Determine color based on player and unit type
    let colorMain = 0x0000ff; // Default blue for Nephites
    let colorSecondary = 0xaaaaff;
    
    if (this.faction === "Lamanites") {
      colorMain = 0xff0000; // Red for Lamanites
      colorSecondary = 0xffaaaa;
    }
    
    // Draw different shapes based on unit type
    let unitShape: Phaser.GameObjects.Shape;
    let unitSymbol: Phaser.GameObjects.Shape | Phaser.GameObjects.Text;
    
    if (this.type === "worker") {
      // Worker is a circle
      unitShape = scene.add.circle(0, 0, 10, colorMain);
      unitSymbol = scene.add.text(0, 0, "W", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff"
      }).setOrigin(0.5);
    } else if (this.type === "melee") {
      // Melee unit is a square
      unitShape = scene.add.rectangle(0, 0, 20, 20, colorMain);
      unitSymbol = scene.add.text(0, 0, "M", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff"
      }).setOrigin(0.5);
    } else {
      // Ranged unit is a triangle
      unitShape = scene.add.triangle(0, 0, 0, -12, 10, 8, -10, 8, colorMain);
      unitSymbol = scene.add.text(0, 0, "R", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff"
      }).setOrigin(0.5);
    }
    
    // Selection indicator (hidden by default)
    const selectionCircle = scene.add.circle(0, 0, 15, 0xffff00, 0)
      .setStrokeStyle(2, 0xffff00);
    
    // Add everything to the container
    container.add([unitShape, unitSymbol, selectionCircle]);
    
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
    }
    
    // Apply faction bonuses
    if (this.faction === "Nephites") {
      // Nephites have stronger defense
      stats.defense += 2;
    } else if (this.faction === "Lamanites") {
      // Lamanites have stronger attack
      stats.attack += 3;
      if (this.type === "melee") {
        // Lamanites excel at melee combat
        stats.attack += 2;
      }
    }
    
    return stats;
  }
  
  update(delta: number) {
    // Update health bar
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = 30 * healthPercent;
    this.healthBar.fillColor = healthPercent > 0.5 ? 0x00ff00 : 0xff0000;
    
    // Visual indication for carrying resources
    if (this.carryingResource) {
      const resourceShape = this.sprite.getAt(1) as Phaser.GameObjects.Shape | Phaser.GameObjects.Text;
      if (resourceShape instanceof Phaser.GameObjects.Text) {
        resourceShape.setText(this.carryingResource.type === 'food' ? 'F' : 'O');
      }
    } else {
      const symbol = this.sprite.getAt(1) as Phaser.GameObjects.Shape | Phaser.GameObjects.Text;
      if (symbol instanceof Phaser.GameObjects.Text) {
        symbol.setText(this.type === 'worker' ? 'W' : this.type === 'melee' ? 'M' : 'R');
      }
    }
    
    // Update selection indicator
    const selectionCircle = this.sprite.getAt(2) as Phaser.GameObjects.Shape;
    selectionCircle.setVisible(this.selected);
    
    // Handle movement
    if (this.isMoving && this.path.length > 0) {
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
