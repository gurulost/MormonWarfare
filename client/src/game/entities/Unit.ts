import Phaser from "phaser";
import { UnitType, FactionType } from "../types";
import { TILE_SIZE } from "../config";

// Define possible unit stances
export type UnitStance = 'aggressive' | 'defensive' | 'hold-position' | 'stand-ground';

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
  baseSpeed: number; // Store the original speed value
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
  isGatheringAnimationPlaying: boolean;
  
  // Faction ability effects
  defenseMultiplier: number = 1;
  attackMultiplier: number = 1;
  speedMultiplier: number = 1;
  isStealthed: boolean = false;
  
  // Special ability for Nephite Stripling Warriors 
  hasFaithShield: boolean = false;
  usedFaithShield: boolean = false; // Track if already used
  
  // Visual effects for abilities
  abilityEffects: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  targetResourceX: number | null;
  targetResourceY: number | null;
  targetUnitId: string | null;
  carryingResource: { type: 'food' | 'ore', amount: number } | null;
  gatheringEfficiency: number; // Faction-specific bonus
  resourceIndicator: Phaser.GameObjects.Shape | null = null;
  resourceAmountText: Phaser.GameObjects.Text | null = null;
  
  // Enhanced unit control properties
  stance: UnitStance = 'defensive'; // Default stance
  stanceIndicator: Phaser.GameObjects.Text | null = null;
  isPatrolling: boolean = false;
  patrolStartX: number | null = null;
  patrolStartY: number | null = null;
  patrolEndX: number | null = null;
  patrolEndY: number | null = null;
  isAttackMoving: boolean = false;
  attackMoveTargetX: number | null = null;
  attackMoveTargetY: number | null = null;
  
  // Client-side prediction properties
  isPredicted: boolean = false;
  predictionSprite: Phaser.GameObjects.Graphics | null = null;
  lastMoveActionId: string | null = null;
  
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
    this.isGatheringAnimationPlaying = false;
    this.targetResourceX = null;
    this.targetResourceY = null;
    this.targetUnitId = null;
    this.carryingResource = null;
    
    // Set gathering efficiency based on faction
    this.gatheringEfficiency = this.faction === "Nephites" ? 
      (type === "worker" ? 1.2 : 1.0) : // Nephites are better at farming
      (type === "worker" ? 1.0 : 0.8);  // Lamanites are better at mining
    
    // Set unit stats based on type and faction
    const stats = this.getUnitStats();
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.attack = stats.attack;
    this.defense = stats.defense;
    this.range = stats.range;
    this.speed = stats.speed;
    this.baseSpeed = stats.speed; // Store original speed for ability calculations
    
    // Set special unit properties
    if (this.type === 'striplingWarrior' && this.faction === 'Nephites') {
      this.hasFaithShield = true;
    }
    
    if (this.type === 'lamaniteScout' && this.faction === 'Lamanites') {
      // Scouts move faster and can use stealth
      this.speed *= 1.2; 
      this.baseSpeed = this.speed;
    }
    
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
  
  /**
   * Handle patrol movement logic
   * When one patrol point is reached, move to the other
   */
  private handlePatrolMovement() {
    if (!this.isPatrolling || !this.patrolStartX || !this.patrolStartY || 
        !this.patrolEndX || !this.patrolEndY) {
      return;
    }
    
    // Determine which patrol point to move to next
    const currentX = Math.floor(this.x / TILE_SIZE);
    const currentY = Math.floor(this.y / TILE_SIZE);
    
    // If we're at or near the end point, go to start point
    if (Math.abs(currentX - this.patrolEndX) <= 1 && Math.abs(currentY - this.patrolEndY) <= 1) {
      this.setPath([{ x: this.patrolStartX, y: this.patrolStartY }]);
    } 
    // If we're at or near the start point, go to end point
    else if (Math.abs(currentX - this.patrolStartX) <= 1 && Math.abs(currentY - this.patrolStartY) <= 1) {
      this.setPath([{ x: this.patrolEndX, y: this.patrolEndY }]);
    }
  }
  
  /**
   * Check for enemies while performing attack-move
   * This should be called by the CombatManager to scan for enemies
   */
  private handleAttackMoveCheck() {
    // This will be filled by CombatManager logic to scan for enemies
    // and engage them if found based on the unit's stance and attack range
    if (!this.isAttackMoving) return;
    
    // If we've reached our attack-move destination, stop attack-moving
    const currentX = Math.floor(this.x / TILE_SIZE);
    const currentY = Math.floor(this.y / TILE_SIZE);
    
    if (this.attackMoveTargetX !== null && this.attackMoveTargetY !== null) {
      if (Math.abs(currentX - this.attackMoveTargetX) <= 1 && 
          Math.abs(currentY - this.attackMoveTargetY) <= 1) {
        this.stopAttackMove();
      }
    }
  }
  
  update(delta: number) {
    // Update health bar
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = 30 * healthPercent;
    this.healthBar.fillColor = healthPercent > 0.5 ? 0x00ff00 : 0xff0000;
    
    // Handle special movement modes
    if (this.isPatrolling && !this.isMoving) {
      this.handlePatrolMovement();
    } else if (this.isAttackMoving && !this.isAttacking) {
      this.handleAttackMoveCheck();
    }
    
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
      // Change the symbol to indicate carrying resource
      unitSymbol.setText(this.carryingResource.type === 'food' ? 'F' : 'O');
      
      // Make the carried resource more visible with enhanced styling
      if (this.carryingResource.type === 'food') {
        unitSymbol.setStyle({ 
          color: '#22ff22',  // Green for food
          fontSize: '14px',  // Slightly larger
          stroke: '#005500', // Dark green outline
          strokeThickness: 2
        });
        
        // Add a pulsing resource indicator if not already added
        if (!this.resourceIndicator) {
          const currentScene = this.sprite.scene;
          this.resourceIndicator = currentScene.add.circle(0, -15, 5, 0x22ff22);
          this.sprite.add(this.resourceIndicator);
          
          // Add pulsing animation
          currentScene.tweens.add({
            targets: this.resourceIndicator,
            scaleX: { from: 0.8, to: 1.2 },
            scaleY: { from: 0.8, to: 1.2 },
            alpha: { from: 0.7, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
          });
        }
      } else {
        unitSymbol.setStyle({ 
          color: '#cc9966',  // Brown for ore
          fontSize: '14px',  // Slightly larger
          stroke: '#663300', // Dark brown outline
          strokeThickness: 2
        });
        
        // Add a pulsing resource indicator if not already added
        if (!this.resourceIndicator) {
          const currentScene = this.sprite.scene;
          this.resourceIndicator = currentScene.add.circle(0, -15, 5, 0xcc9966);
          this.sprite.add(this.resourceIndicator);
          
          // Add pulsing animation
          currentScene.tweens.add({
            targets: this.resourceIndicator,
            scaleX: { from: 0.8, to: 1.2 },
            scaleY: { from: 0.8, to: 1.2 },
            alpha: { from: 0.7, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
          });
        }
      }
      
      // Add text showing the amount being carried
      if (!this.resourceAmountText && this.carryingResource.amount > 0) {
        const currentScene = this.sprite.scene;
        this.resourceAmountText = currentScene.add.text(15, -5, this.carryingResource.amount.toString(), {
          fontSize: '10px',
          color: this.carryingResource.type === 'food' ? '#22ff22' : '#cc9966',
          stroke: '#000000',
          strokeThickness: 1
        });
        this.sprite.add(this.resourceAmountText);
      } else if (this.resourceAmountText) {
        this.resourceAmountText.setText(this.carryingResource.amount.toString());
      }
    } else if (unitSymbol) {
      // Remove resource visuals if no longer carrying
      if (this.resourceIndicator) {
        this.resourceIndicator.destroy();
        this.resourceIndicator = null;
      }
      
      if (this.resourceAmountText) {
        this.resourceAmountText.destroy();
        this.resourceAmountText = null;
      }
      
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
    
    // Update prediction visualization if this unit has predicted movement
    this.updatePredictionVisual();
    
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
    // Apply defense multiplier from faction abilities
    const effectiveDefense = this.defense * this.defenseMultiplier;
    
    // Calculate adjusted damage
    let adjustedDamage = Math.max(1, amount - effectiveDefense / 2);
    
    // Special case for Stripling Warriors - they can survive one lethal attack
    if (this.type === 'striplingWarrior' && this.hasFaithShield && !this.usedFaithShield && 
        this.health <= adjustedDamage) {
      // Activate faith shield to survive this attack
      this.usedFaithShield = true;
      adjustedDamage = Math.max(0, this.health - 1); // Leave unit with 1 health
      
      // Create visual effect for faith shield
      const scene = this.sprite.scene;
      const shield = scene.add.circle(0, 0, 25, 0xffffff, 0.7);
      this.sprite.add(shield);
      
      // Add pulsing animation and fade out
      scene.tweens.add({
        targets: shield,
        alpha: 0,
        scale: 1.5,
        duration: 1000,
        onComplete: () => {
          shield.destroy();
        }
      });
      
      // Log and play special sound for faith shield
      console.log(`Stripling Warrior's faith shield activated!`);
      
      // Play success sound for faith shield activation
      const successAudio = document.getElementById('success-sound') as HTMLAudioElement;
      if (successAudio) {
        successAudio.currentTime = 0;
        successAudio.play().catch(e => console.log("Sound play prevented:", e));
      }
    }
    
    // Apply stealth bonus for Lamanite scouts (reduced damage when stealthed)
    if (this.type === 'lamaniteScout' && this.isStealthed) {
      adjustedDamage *= 0.5; // 50% damage reduction when stealthed
    }
    
    // Apply damage
    this.health -= adjustedDamage;
    
    // Play hit sound if damaged
    if (adjustedDamage > 0) {
      // Play appropriate hit sound
      const hitAudio = document.getElementById('hit-sound') as HTMLAudioElement;
      if (hitAudio) {
        hitAudio.currentTime = 0;
        hitAudio.play().catch(e => console.log("Sound play prevented:", e));
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
  
  /**
   * Play a gathering animation for the worker
   */
  playGatheringAnimation() {
    if (this.isGatheringAnimationPlaying) return;
    
    // Mark animation as playing to prevent duplicate animations
    this.isGatheringAnimationPlaying = true;
    
    // Get the unit's scene
    const scene = this.sprite.scene;
    
    // Create a tween to show the gathering motion (slight bouncing)
    scene.tweens.add({
      targets: this.sprite,
      y: this.y - 5,
      duration: 300,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Reset flag when animation completes
        this.isGatheringAnimationPlaying = false;
        
        // Reset position
        this.sprite.y = this.y;
      }
    });
    
    // Rotate the unit slightly left and right to show gathering motion
    scene.tweens.add({
      targets: this.sprite,
      angle: { from: -10, to: 10 },
      duration: 300,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Reset rotation
        this.sprite.angle = 0;
      }
    });
  }
  
  /**
   * Creates or updates the prediction visualization for this unit
   * This shows a visual indicator when a unit is in a "predicted" state
   * waiting for server confirmation
   */
  updatePredictionVisual() {
    // Only create/update if this unit has predicted movement
    if (this.isPredicted) {
      // Create prediction graphics if it doesn't exist
      if (!this.predictionSprite) {
        this.predictionSprite = this.sprite.scene.add.graphics();
        // Add the graphics object to the container for proper positioning
        this.sprite.add(this.predictionSprite);
      }
      
      // Update the prediction visual
      const time = new Date().getTime();
      const pulse = (Math.sin(time / 300) + 1) / 2; // Value between 0 and 1
      
      this.predictionSprite.clear();
      
      // Create a dotted circle around the unit to indicate predicted movement
      this.predictionSprite.lineStyle(2, 0x00ffff, 0.7 * pulse);
      
      // Draw dotted circle
      const radius = 20;
      const segments = 16; // Number of segments in the circle
      const angleStep = (Math.PI * 2) / segments;
      
      for (let i = 0; i < segments; i += 2) {
        const startAngle = i * angleStep;
        const endAngle = (i + 1) * angleStep;
        
        this.predictionSprite.beginPath();
        this.predictionSprite.arc(0, 0, radius, startAngle, endAngle);
        this.predictionSprite.strokePath();
      }
    } else if (this.predictionSprite) {
      // Remove prediction visualization when no longer predicted
      this.predictionSprite.clear();
      this.predictionSprite.destroy();
      this.predictionSprite = null;
    }
  }
  
  /**
   * Mark this unit as having predicted movement
   * @param actionId Unique ID for this prediction action
   */
  setPredicted(actionId: string) {
    this.isPredicted = true;
    this.lastMoveActionId = actionId;
    // Create the prediction visual immediately
    this.updatePredictionVisual();
  }
  
  /**
   * Clear prediction status for this unit
   */
  clearPrediction() {
    this.isPredicted = false;
    this.lastMoveActionId = null;
    
    // Remove prediction visualization
    if (this.predictionSprite) {
      this.predictionSprite.clear();
      this.predictionSprite.destroy();
      this.predictionSprite = null;
    }
  }
  
  /**
   * Set the unit's stance which affects its combat behavior
   * @param stance New stance for the unit
   */
  setStance(stance: UnitStance) {
    this.stance = stance;
    
    // Update visual indicator
    this.updateStanceIndicator();
    
    console.log(`Unit ${this.id} stance set to ${stance}`);
  }
  
  /**
   * Update the visual indicator showing the unit's current stance
   */
  private updateStanceIndicator() {
    // Remove existing stance indicator if it exists
    if (this.stanceIndicator) {
      this.stanceIndicator.destroy();
      this.stanceIndicator = null;
    }
    
    // Create new stance indicator
    const scene = this.sprite.scene;
    
    // Stance indicator styles based on stance type
    const stanceSymbol = {
      'aggressive': 'A',
      'defensive': 'D',
      'hold-position': 'H',
      'stand-ground': 'S'
    }[this.stance];
    
    const stanceColor = {
      'aggressive': '#ff0000',
      'defensive': '#00ffff',
      'hold-position': '#ffff00',
      'stand-ground': '#888888'
    }[this.stance];
    
    // Create the indicator at the bottom of the unit
    this.stanceIndicator = scene.add.text(0, 18, stanceSymbol, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: stanceColor,
      stroke: '#000000',
      strokeThickness: 1,
      backgroundColor: '#00000088'
    }).setOrigin(0.5);
    
    // Add to unit's container
    this.sprite.add(this.stanceIndicator);
  }
  
  /**
   * Set patrol points for this unit
   * @param startX Starting patrol point X
   * @param startY Starting patrol point Y
   * @param endX Ending patrol point X
   * @param endY Ending patrol point Y
   */
  startPatrol(startX: number, startY: number, endX: number, endY: number) {
    this.isPatrolling = true;
    this.patrolStartX = startX;
    this.patrolStartY = startY;
    this.patrolEndX = endX;
    this.patrolEndY = endY;
    
    // Initially move to the end point
    this.setPath([{ x: endX, y: endY }]);
    
    console.log(`Unit ${this.id} patrolling between (${startX},${startY}) and (${endX},${endY})`);
  }
  
  /**
   * Stop patrolling
   */
  stopPatrol() {
    this.isPatrolling = false;
    this.patrolStartX = null;
    this.patrolStartY = null;
    this.patrolEndX = null;
    this.patrolEndY = null;
  }
  
  /**
   * Start attack-move to a position
   * Unit will move to the position while attacking any enemy encountered
   */
  startAttackMove(targetX: number, targetY: number) {
    this.isAttackMoving = true;
    this.attackMoveTargetX = targetX;
    this.attackMoveTargetY = targetY;
    
    // Set path to the target location
    this.setPath([{ x: targetX, y: targetY }]);
    
    console.log(`Unit ${this.id} attack-moving to (${targetX},${targetY})`);
  }
  
  /**
   * Stop attack-move
   */
  stopAttackMove() {
    this.isAttackMoving = false;
    this.attackMoveTargetX = null;
    this.attackMoveTargetY = null;
  }
  
  /**
   * Activate stealth mode for Lamanite Scouts
   * Makes the unit harder to detect and reduces damage taken
   */
  activateStealth() {
    if (this.type !== 'lamaniteScout' || this.faction !== 'Lamanites') {
      console.warn('Only Lamanite Scouts can activate stealth');
      return false;
    }
    
    this.isStealthed = true;
    
    // Visual effects for stealth
    const scene = this.sprite.scene;
    
    // Make the unit semi-transparent
    this.sprite.setAlpha(0.6);
    
    // Add stealth particles effect (subtle smoke)
    const particles = scene.add.particles(0, 0, 'smoke', {
      speed: { min: 5, max: 10 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.3, end: 0 },
      lifespan: 2000,
      frequency: 500,
      quantity: 1
    });
    
    this.sprite.add(particles);
    this.abilityEffects.set('stealth', particles);
    
    // Create a temporary "STEALTH" indicator
    const stealthText = scene.add.text(0, -25, "STEALTH", {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    
    this.sprite.add(stealthText);
    
    // Fade out the stealth text
    scene.tweens.add({
      targets: stealthText,
      alpha: 0,
      y: -35,
      duration: 1500,
      onComplete: () => {
        stealthText.destroy();
      }
    });
    
    console.log(`Scout ${this.id} activated stealth mode`);
    return true;
  }
  
  /**
   * Deactivate stealth mode for Lamanite Scouts
   */
  deactivateStealth() {
    if (!this.isStealthed) return;
    
    this.isStealthed = false;
    
    // Restore normal visibility
    this.sprite.setAlpha(1.0);
    
    // Remove stealth particles effect
    const stealthEffect = this.abilityEffects.get('stealth');
    if (stealthEffect) {
      stealthEffect.destroy();
      this.abilityEffects.delete('stealth');
    }
    
    console.log(`Scout ${this.id} deactivated stealth mode`);
  }
  
  /**
   * Apply a temporary speed boost to the unit
   * @param multiplier Speed multiplier (e.g., 1.5 for 50% boost)
   * @param duration Duration in milliseconds
   */
  applySpeedBoost(multiplier: number, duration: number) {
    // Store the current speed multiplier
    this.speedMultiplier = multiplier;
    
    // Update the speed
    this.speed = this.baseSpeed * this.speedMultiplier;
    
    // Create visual effect for speed boost
    const scene = this.sprite.scene;
    
    // Add speed lines particles
    const particles = scene.add.particles(0, 0, 'spark', {
      speed: { min: 10, max: 20 },
      angle: { min: 160, max: 200 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      frequency: 100,
      quantity: 2
    });
    
    this.sprite.add(particles);
    this.abilityEffects.set('speed', particles);
    
    // Create a temporary speed boost indicator
    const boostText = scene.add.text(0, -25, "SPEED+", {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    
    this.sprite.add(boostText);
    
    // Fade out the boost text
    scene.tweens.add({
      targets: boostText,
      alpha: 0,
      y: -35,
      duration: 1500,
      onComplete: () => {
        boostText.destroy();
      }
    });
    
    // Reset after duration
    scene.time.delayedCall(duration, () => {
      this.clearSpeedBoost();
    });
    
    console.log(`Unit ${this.id} received speed boost: ${multiplier}x for ${duration}ms`);
  }
  
  /**
   * Clear any active speed boost effect
   */
  clearSpeedBoost() {
    this.speedMultiplier = 1;
    this.speed = this.baseSpeed * this.speedMultiplier;
    
    // Remove speed particles effect
    const speedEffect = this.abilityEffects.get('speed');
    if (speedEffect) {
      speedEffect.destroy();
      this.abilityEffects.delete('speed');
    }
  }
}