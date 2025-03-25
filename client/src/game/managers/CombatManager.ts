import Phaser from "phaser";
import { UnitManager } from "./UnitManager";
import { 
  TILE_SIZE, 
  COMBAT_UPDATE_RATE, 
  COUNTER_DAMAGE_MULTIPLIER,
  WEAKNESS_DAMAGE_MULTIPLIER,
  UNIT_STATS
} from "../config";
import { UnitStats, UnitType } from "../types";
import { useAudio } from "../../lib/stores/useAudio";
import { Unit, UnitStance } from "../entities/Unit";

// Type for game Unit that includes position and other essential properties
interface GameUnit {
  id: string;
  playerId: string;
  type: UnitType;
  x: number;
  y: number;
  range: number;
}

export class CombatManager {
  private scene: Phaser.Scene;
  private unitManager: UnitManager;
  private lastCombatUpdate: number;
  private autoEngageCheckTimer: number;
  
  constructor(scene: Phaser.Scene, unitManager: UnitManager) {
    this.scene = scene;
    this.unitManager = unitManager;
    this.lastCombatUpdate = 0;
    this.autoEngageCheckTimer = 0;
  }
  
  update(delta: number) {
    // Only update combat every COMBAT_UPDATE_RATE milliseconds
    this.lastCombatUpdate += delta;
    
    if (this.lastCombatUpdate >= COMBAT_UPDATE_RATE) {
      this.processCombat();
      this.processUnitStances();
      this.processAttackMove();
      this.lastCombatUpdate = 0;
    }
  }
  
  /**
   * Process unit stances and auto-engage behavior based on stance settings
   */
  private processUnitStances() {
    const units = this.unitManager.getAllUnits();
    
    for (const unit of units) {
      // Skip units that are already engaged in combat or gathering
      if (unit.isAttacking || unit.isGathering) continue;
      
      // Auto-engage behavior varies by unit stance
      switch (unit.stance) {
        case 'aggressive':
          // Aggressive units will actively seek out enemies within a large range
          this.checkForTargetsInRange(unit, unit.range * 2.5);
          break;
          
        case 'defensive':
          // Defensive units will only engage enemies that come within their range
          this.checkForTargetsInRange(unit, unit.range * 1.5);
          break;
          
        case 'hold-position':
          // Hold position units will only engage enemies in their attack range but won't chase
          this.checkForTargetsInRange(unit, unit.range);
          break;
          
        case 'stand-ground':
          // Stand ground units will not auto-engage at all
          break;
      }
    }
  }
  
  /**
   * Process attack-move commands
   */
  private processAttackMove() {
    const units = this.unitManager.getAllUnits();
    
    for (const unit of units) {
      // Skip units that are not in attack-move mode or are already attacking
      if (!unit.isAttackMoving || unit.isAttacking) continue;
      
      // Check for enemies along the path to the attack-move destination
      this.checkForTargetsInRange(unit, unit.range * 1.5);
    }
  }
  
  /**
   * Check for enemy units in range and engage if found
   * @param unit Unit that is checking for targets
   * @param range Range to check for enemies
   */
  private checkForTargetsInRange(unit: Unit, range: number) {
    const allUnits = this.unitManager.getAllUnits();
    const nearestEnemy = this.findNearestEnemyUnit(unit, allUnits, range);
    
    if (nearestEnemy) {
      // If it's a hold-position unit, only engage if enemy is within attack range
      if (unit.stance === 'hold-position') {
        const distanceToEnemy = Phaser.Math.Distance.Between(
          unit.x, unit.y, nearestEnemy.x, nearestEnemy.y);
        
        if (distanceToEnemy / TILE_SIZE > unit.range) {
          return; // Enemy is outside attack range, don't pursue
        }
      }
      
      // Engage the enemy
      unit.setAttackingTarget(nearestEnemy.id);
    }
  }
  
  processCombat() {
    const units = this.unitManager.getAllUnits();
    
    // Process each unit that is attacking
    for (const unit of units) {
      if (unit.isAttacking && unit.targetUnitId) {
        const targetUnit = this.unitManager.getUnit(unit.targetUnitId);
        
        // If target doesn't exist or is dead, stop attacking
        if (!targetUnit) {
          unit.stopAttacking();
          continue;
        }
        
        // Calculate distance to target
        const distance = Phaser.Math.Distance.Between(unit.x, unit.y, targetUnit.x, targetUnit.y);
        const tileDistance = distance / TILE_SIZE;
        
        // Check if in range
        if (tileDistance <= unit.range) {
          // Determine hit type for enhanced feedback
          let hitType: 'normal' | 'critical' | 'counter' | 'weak' = 'normal';
          
          // Apply counter system and determine hit type
          const attackerType = unit.type as UnitType;
          const defenderType = targetUnit.type as UnitType;
          
          // Check for counter advantage
          if (this.isCounterUnit(attackerType, defenderType)) {
            hitType = 'counter';
          }
          
          // Check for weakness
          if (this.isWeakToUnit(attackerType, defenderType)) {
            hitType = 'weak';
          }
          
          // Random chance for critical hit (10% chance, more for heroes)
          const critChance = attackerType === 'hero' ? 0.15 : 0.1;
          if (Math.random() < critChance) {
            hitType = 'critical';
          }
          
          // Attack the target with the counter system
          const damage = this.calculateDamage(unit.attack, targetUnit.defense, unit, targetUnit);
          const killed = targetUnit.takeDamage(damage);
          
          // Create visual hit impact effect based on unit types
          this.createHitImpactEffect(targetUnit.x, targetUnit.y, attackerType, defenderType);
          
          // Play appropriate hit sound based on hit type
          const audioStore = useAudio.getState();
          if (!audioStore.isMuted) {
            switch (hitType) {
              case 'critical':
                audioStore.playCriticalHit();
                break;
              case 'counter':
                audioStore.playCounterAttack();
                break;
              case 'weak':
                audioStore.playWeaknessHit();
                break;
              default:
                audioStore.playHit();
                break;
            }
          }
          
          // Create hit impact effect first (shows the "hit" itself)
          this.createHitImpactEffect(targetUnit.x, targetUnit.y, attackerType, defenderType);
          
          // Small delay before showing damage number for better visual sequence
          this.scene.time.delayedCall(50, () => {
            // Create visual damage indicator with appropriate style
            this.createDamageIndicator(targetUnit.x, targetUnit.y, damage, hitType);
          });
          
          // If target is killed, remove it
          if (killed) {
            // Play death effect before removing
            this.createDeathEffect(targetUnit.x, targetUnit.y, targetUnit.type);
            
            this.unitManager.removeUnit(targetUnit.id);
            unit.stopAttacking();
            
            // Add exp to the unit that got the kill (could be used for veterancy system)
            // unit.addExperience(10);
            
            // Find new target if in aggressive stance
            if (unit.stance === 'aggressive') {
              const newTarget = this.findNearestEnemyUnit(unit, units, unit.range * 2);
              if (newTarget) {
                unit.setAttackingTarget(newTarget.id);
              }
            }
          }
          
          // Add enhanced camera shake effect with different intensities based on hit type
          // Use the new 3D camera shake if available (through window.cameraControls)
          const cameraControls = (window as any).cameraControls;
          if (cameraControls && cameraControls.shakeCamera) {
            // Base shake intensity
            let intensity = 0.2;
            let duration = 200;
            
            // Adjust based on hit type and unit type for more dynamic feedback
            if (hitType === 'critical') {
              intensity = 0.4;
              duration = 300;
            } else if (hitType === 'counter') {
              intensity = 0.3;
              duration = 250;
            } else if (attackerType === 'hero') {
              intensity = 0.5;
              duration = 350;
            }
            
            // Trigger camera shake with appropriate parameters
            cameraControls.shakeCamera(intensity, duration, hitType);
            console.log(`Combat triggered camera shake: ${hitType}, intensity: ${intensity}`);
          } 
          // Fall back to Phaser's 2D camera shake if 3D camera controls aren't available
          else if (hitType === 'critical' || attackerType === 'hero') {
            this.scene.cameras.main.shake(100, 0.003);
          }
        } else {
          // Move toward target
          const targetTileX = Math.floor(targetUnit.x / TILE_SIZE);
          const targetTileY = Math.floor(targetUnit.y / TILE_SIZE);
          
          // Update the path every few seconds if not already moving
          if (!unit.isMoving) {
            this.unitManager.moveUnitsTo([unit.id], targetTileX, targetTileY);
          }
        }
      }
    }
    
    // Automatically detect and engage nearby enemy units with strategic target selection
    this.autoEngageEnemies();
  }
  
  /**
   * Creates an enhanced visual damage indicator with different styles based on hit type
   */
  private createDamageIndicator(x: number, y: number, damage: number, hitType: 'normal' | 'critical' | 'counter' | 'weak' = 'normal'): void {
    // Configure text style based on hit type
    let fontSize = "16px";
    let color = "#ff6060";  // Default regular hit color
    let scaleEffect = 1;
    let yOffset = 40;
    let duration = 800;
    let textPrefix = "";
    let textSuffix = "";
    
    // Apply different styles based on hit type
    switch (hitType) {
      case 'critical':
        fontSize = "22px";
        color = "#ff2020";  // Brighter red for critical hits
        scaleEffect = 1.8;  // Much bigger effect
        yOffset = 70;       // Flies higher
        duration = 1000;    // Longer animation
        textPrefix = "CRIT! ";  // Add prefix text
        break;
      case 'counter':
        fontSize = "18px";
        color = "#40ff40";  // Brighter green for counter hits
        scaleEffect = 1.5;
        yOffset = 60;
        duration = 900;
        textPrefix = "COUNTER! ";
        break;
      case 'weak':
        fontSize = "14px";
        color = "#a0a0a0";  // Gray/silver for weak hits
        scaleEffect = 0.8;  // Smaller effect 
        yOffset = 30;
        duration = 600;
        textSuffix = " (weak)";  // Add suffix text
        break;
    }
    
    // Format the damage with prefix/suffix
    const damageText = `${textPrefix}${Math.round(damage)}${textSuffix}`;
    
    // Create damage text that floats up and fades out with enhanced styling
    const text = this.scene.add.text(
      x, 
      y - 10, 
      damageText, 
      { 
        fontSize: fontSize, 
        color: color,
        stroke: "#000000",
        strokeThickness: hitType === 'critical' ? 4 : 2,
        fontStyle: hitType === 'critical' || hitType === 'counter' ? 'bold' : 'normal',
        align: 'center',
        shadow: hitType === 'critical' ? {
          offsetX: 2,
          offsetY: 2,
          color: '#000000',
          blur: 5,
          fill: true
        } : undefined
      }
    );
    
    // Center the text for better visual appearance
    text.setOrigin(0.5, 0.5);
    
    // Set initial scale with a small "pop" effect
    text.setScale(0.5);
    
    // Create a two-part animation for more impact - first pop in, then float up and fade
    // First part - quick pop in
    this.scene.tweens.add({
      targets: text,
      scaleX: scaleEffect * 1.2,
      scaleY: scaleEffect * 1.2,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Second part - float up and fade
        this.scene.tweens.add({
          targets: text,
          y: y - yOffset,
          alpha: 0,
          scaleX: hitType === 'critical' ? scaleEffect * 1.5 : scaleEffect * 0.8,
          scaleY: hitType === 'critical' ? scaleEffect * 1.5 : scaleEffect * 0.8,
          duration: duration,
          ease: hitType === 'critical' ? 'Bounce.easeOut' : 'Cubic.easeOut',
          onComplete: () => {
            text.destroy();
          }
        });
      }
    });
    
    // Custom visual effects based on hit type
    switch (hitType) {
      case 'critical':
        // Explosive radial effect for critical hits
        const critFlash = this.scene.add.circle(x, y, 25, 0xff3333, 0.8);
        this.scene.tweens.add({
          targets: critFlash,
          scaleX: 3,
          scaleY: 3,
          alpha: 0,
          duration: 400,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            critFlash.destroy();
          }
        });
        
        // Add secondary starburst effect
        const starburst = this.scene.add.particles(x, y, 'particle', {
          speed: { min: 50, max: 150 },
          angle: { min: 0, max: 360 },
          scale: { start: 1.5, end: 0 },
          lifespan: 500,
          blendMode: 'ADD',
          tint: 0xff5555,
          quantity: 10,
          emitting: false
        });
        starburst.explode();
        this.scene.time.delayedCall(500, () => {
          starburst.destroy();
        });
        break;
        
      case 'counter':
        // Ripple effect for counter hits
        const counterFlash = this.scene.add.circle(x, y, 20, 0x44ff44, 0.7);
        this.scene.tweens.add({
          targets: counterFlash,
          scaleX: 2.5,
          scaleY: 2.5,
          alpha: 0,
          duration: 350,
          ease: 'Sine.easeOut',
          onComplete: () => {
            counterFlash.destroy();
          }
        });
        
        // Add a few green particles
        const counterParticles = this.scene.add.particles(x, y, 'particle', {
          speed: { min: 30, max: 80 },
          angle: { min: 0, max: 360 },
          scale: { start: 1, end: 0 },
          lifespan: 400,
          tint: 0x44ff44,
          quantity: 8,
          emitting: false
        });
        counterParticles.explode();
        this.scene.time.delayedCall(400, () => {
          counterParticles.destroy();
        });
        break;
        
      case 'weak':
        // Subtle effect for weak hits
        const weakFlash = this.scene.add.circle(x, y, 15, 0xaaaaaa, 0.5);
        this.scene.tweens.add({
          targets: weakFlash,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => {
            weakFlash.destroy();
          }
        });
        break;
        
      default:
        // Standard hit effect
        const flash = this.scene.add.circle(x, y, 15, 0xff6060, 0.6);
        this.scene.tweens.add({
          targets: flash,
          scaleX: 1.5,
          scaleY: 1.5,
          alpha: 0,
          duration: 250,
          ease: 'Quad.easeOut',
          onComplete: () => {
            flash.destroy();
          }
        });
        break;
    }
  }
  
  /**
   * Creates an enhanced death effect when a unit is killed with more visual feedback
   */
  private createDeathEffect(x: number, y: number, unitType: UnitType): void {
    // Play appropriate death sound
    const audioStore = useAudio.getState();
    if (!audioStore.isMuted) {
      audioStore.playDeath(unitType);
    }
    
    // Add camera shake for all unit deaths, with varying intensity by unit type
    const cameraControls = (window as any).cameraControls;
    if (cameraControls && cameraControls.shakeCamera) {
      // Default values
      let intensity = 0.2;
      let duration = 250;
      
      // Adjust based on unit type for more dynamic feedback
      switch (unitType) {
        case 'hero':
          // Hero deaths handled separately below
          break;
        case 'cavalry':
          intensity = 0.4;
          duration = 350;
          break;
        case 'melee':
          intensity = 0.3;
          duration = 300;
          break;
        case 'ranged':
          intensity = 0.25;
          duration = 250;
          break;
        case 'worker':
          intensity = 0.15;
          duration = 200;
          break;
      }
      
      // Only trigger for non-hero units as hero deaths have their own more dramatic effect
      if (unitType !== 'hero') {
        cameraControls.shakeCamera(intensity, duration, 'death');
        console.log(`${unitType} death triggered camera shake: intensity ${intensity}`);
      }
    }
    
    // Configure particle colors and effects based on unit type
    let mainColor = 0xff0000;   // Default red
    let secondaryColor = 0x000000;  // Dark/smoke particles
    let particleCount = 30;
    
    switch (unitType) {
      case 'hero':
        mainColor = 0xffff00;        // Gold particles for heroes
        secondaryColor = 0xff6600;   // Orange/flame particles
        particleCount = 60;          // More particles for heroes
        break;
      case 'melee':
        mainColor = 0xff3333;        // Bright red for melee
        secondaryColor = 0x993333;   // Darker red
        break;
      case 'ranged':
        mainColor = 0x33ccff;        // Blue for ranged
        secondaryColor = 0x3366ff;   // Darker blue
        break;
      case 'cavalry':
        mainColor = 0xffcc00;        // Golden yellow for cavalry
        secondaryColor = 0xcc6600;   // Brown
        break;
      case 'worker':
        mainColor = 0xffff00;        // Yellow for workers
        secondaryColor = 0x666666;   // Gray
        particleCount = 20;          // Fewer particles for workers
        break;
    }
    
    // Primary explosion particles
    const mainParticles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 70, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: 800,
      blendMode: 'ADD',
      tint: mainColor,
      quantity: particleCount,
      emitting: false
    });
    
    // Secondary smoke/debris particles
    const secondaryParticles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0.3 },
      lifespan: 1200,
      blendMode: 'NORMAL',
      tint: secondaryColor,
      quantity: Math.floor(particleCount * 0.7),
      emitting: false
    });
    
    // For heroes, add a shockwave effect
    if (unitType === 'hero') {
      const shockwave = this.scene.add.circle(x, y, 10, 0xffffcc, 0.7);
      this.scene.tweens.add({
        targets: shockwave,
        scaleX: 10,
        scaleY: 10,
        alpha: 0,
        duration: 1000,
        ease: 'Quad.easeOut',
        onComplete: () => {
          shockwave.destroy();
        }
      });
      
      // Enhanced camera shake for hero deaths
      // Use the new 3D camera shake if available
      const cameraControls = (window as any).cameraControls;
      if (cameraControls && cameraControls.shakeCamera) {
        // Hero deaths get the most dramatic camera shake
        cameraControls.shakeCamera(0.7, 500, 'death');
        console.log('Hero death triggered enhanced camera shake');
      } else {
        // Fall back to Phaser's 2D camera shake
        this.scene.cameras.main.shake(300, 0.005);
      }
    }
    
    // Emit particles once
    mainParticles.explode();
    secondaryParticles.explode();
    
    // Auto-destroy the emitters after they're done
    this.scene.time.delayedCall(1500, () => {
      mainParticles.destroy();
      secondaryParticles.destroy();
    });
  }
  
  /**
   * Creates a hit impact effect at the target location
   * Visualizes the actual impact of weapons hitting units
   */
  private createHitImpactEffect(x: number, y: number, attackerType: UnitType, defenderType: UnitType): void {
    // Configure the impact visual based on the attacker type
    let impactColor = 0xffffff;
    let impactSize = 15;
    let impactSpeed = 300;
    
    // Add subtle camera shake for standard hit impacts based on attacker type
    const cameraControls = (window as any).cameraControls;
    if (cameraControls && cameraControls.shakeCamera) {
      // Default values for shake
      let intensity = 0.1;
      let duration = 150;
      
      // Adjust based on attacker type for more dynamic feedback
      switch (attackerType) {
        case 'hero':
          intensity = 0.25;
          duration = 200;
          break;
        case 'cavalry':
          intensity = 0.2;
          duration = 180;
          break;
        case 'melee':
          intensity = 0.15;
          duration = 150; 
          break;
        case 'ranged':
          intensity = 0.1;
          duration = 120;
          break;
      }
      
      // Apply the shake
      cameraControls.shakeCamera(intensity, duration, 'hit');
    }
    
    switch (attackerType) {
      case 'melee':
        impactColor = 0xff6666; // Red impact
        impactSize = 15;
        // Create a slash effect for melee
        const slashAngle = Math.random() * 360;
        const slash = this.scene.add.rectangle(x, y, 25, 3, impactColor, 0.8);
        slash.setAngle(slashAngle);
        
        this.scene.tweens.add({
          targets: slash,
          scaleX: 1.5,
          scaleY: 1.5,
          alpha: 0,
          angle: slashAngle + 45, // Rotate during animation
          duration: 200,
          onComplete: () => {
            slash.destroy();
          }
        });
        break;
        
      case 'ranged':
        impactColor = 0x99ccff; // Blue impact for arrows
        impactSize = 10;
        
        // Create arrow impact particles
        const arrowImpact = this.scene.add.particles(x, y, 'particle', {
          speed: { min: 20, max: 60 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.5, end: 0 },
          lifespan: 300,
          tint: impactColor,
          quantity: 10,
          emitting: false
        });
        
        arrowImpact.explode();
        
        this.scene.time.delayedCall(300, () => {
          arrowImpact.destroy();
        });
        break;
        
      case 'cavalry':
        impactColor = 0xffcc00; // Gold impact for cavalry
        impactSize = 20;
        impactSpeed = 400;
        
        // Create dust cloud for cavalry impact
        const dustCloud = this.scene.add.particles(x, y, 'particle', {
          speed: { min: 30, max: 80 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.8, end: 0 },
          lifespan: 500,
          tint: 0xddddaa,
          quantity: 15,
          emitting: false
        });
        
        dustCloud.explode();
        
        this.scene.time.delayedCall(500, () => {
          dustCloud.destroy();
        });
        break;
        
      case 'hero':
        impactColor = 0xffff66; // Bright yellow/gold for heroes
        impactSize = 25;
        
        // Create a more dramatic impact for heroes
        const heroImpact = this.scene.add.circle(x, y, impactSize, impactColor, 0.8);
        
        this.scene.tweens.add({
          targets: heroImpact,
          scaleX: 2,
          scaleY: 2,
          alpha: 0,
          duration: 350,
          onComplete: () => {
            heroImpact.destroy();
          }
        });
        
        // Add mini shockwave for hero attacks
        const miniShockwave = this.scene.add.circle(x, y, 5, 0xffffff, 0.5);
        this.scene.tweens.add({
          targets: miniShockwave,
          scaleX: 4,
          scaleY: 4,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            miniShockwave.destroy();
          }
        });
        break;
    }
    
    // Common impact circle for all types (with customized properties)
    const impact = this.scene.add.circle(x, y, impactSize/3, impactColor, 0.7);
    
    this.scene.tweens.add({
      targets: impact,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: impactSpeed * 0.5,
      onComplete: () => {
        impact.destroy();
      }
    });
  }
  
  orderAttack(attackerIds: string[], targetId: string) {
    const targetUnit = this.unitManager.getUnit(targetId);
    if (!targetUnit) {
      console.warn(`Target unit not found: ${targetId}`);
      return;
    }
    
    for (const attackerId of attackerIds) {
      const attacker = this.unitManager.getUnit(attackerId);
      if (attacker && attacker.playerId !== targetUnit.playerId) {
        // Set attacking state
        attacker.setAttackingTarget(targetId);
        
        // Calculate target position in grid coordinates
        const targetTileX = Math.floor(targetUnit.x / TILE_SIZE);
        const targetTileY = Math.floor(targetUnit.y / TILE_SIZE);
        
        // Move toward target
        this.unitManager.moveUnitsTo([attackerId], targetTileX, targetTileY);
      }
    }
  }
  
  /**
   * Calculate damage based on attack, defense, and unit types with enhanced sound feedback
   */
  private calculateDamage(attack: number, defense: number, attacker?: any, defender?: any): number {
    // Base damage is attack value
    let damage = attack;
    let damageMultiplier = 1.0;
    let hitType: 'normal' | 'critical' | 'counter' | 'weak' = 'normal';
    
    // Apply counter system bonuses if both units are combat units
    if (attacker && defender) {
      // Get unit types
      const attackerType = attacker.type as UnitType;
      const defenderType = defender.type as UnitType;
      
      // Check for counter bonus
      if (this.isCounterUnit(attackerType, defenderType)) {
        // This unit type counters the defending unit type
        damageMultiplier *= COUNTER_DAMAGE_MULTIPLIER;
        hitType = 'counter';
        
        // Create a visual effect to show counter bonus
        this.createCounterEffectVisual(defender.x, defender.y, true);
        
        // Add camera shake for counter bonus
        const cameraControls = (window as any).cameraControls;
        if (cameraControls && cameraControls.shakeCamera) {
          cameraControls.shakeCamera(0.3, 250, 'counter');
          console.log(`Counter bonus with camera shake! ${attackerType} is strong against ${defenderType}`);
        } else {
          console.log(`Counter bonus! ${attackerType} is strong against ${defenderType}`);
        }
      }
      
      // Check for weakness penalty
      if (this.isWeakToUnit(attackerType, defenderType)) {
        // Defending unit has advantage against attacking unit
        defense *= WEAKNESS_DAMAGE_MULTIPLIER;
        hitType = 'weak';
        
        // Create a visual effect to show weakness
        this.createCounterEffectVisual(attacker.x, attacker.y, false);
        
        // Add subtle camera shake for weakness effect
        const cameraControls = (window as any).cameraControls;
        if (cameraControls && cameraControls.shakeCamera) {
          cameraControls.shakeCamera(0.2, 200, 'weak');
          console.log(`Weakness penalty with subtle shake! ${attackerType} is weak against ${defenderType}`);
        } else {
          console.log(`Weakness penalty! ${attackerType} is weak against ${defenderType}`);
        }
      }
      
      // Check for critical hit (10% chance, higher for heroes)
      const critChance = attackerType === 'hero' ? 0.15 : 0.1;
      if (Math.random() < critChance && hitType === 'normal') {
        // Critical hit - higher damage!
        damageMultiplier *= 1.5;
        hitType = 'critical';
        
        // Enhanced camera shake for critical hits
        const cameraControls = (window as any).cameraControls;
        if (cameraControls && cameraControls.shakeCamera) {
          cameraControls.shakeCamera(0.4, 300, 'critical');
          console.log(`Critical hit with enhanced camera shake! ${Math.round(damage * damageMultiplier)} damage`);
        } else {
          // Fall back to Phaser's 2D camera shake
          this.scene.cameras.main.shake(100, 0.003);
          console.log(`Critical hit! ${Math.round(damage * damageMultiplier)} damage`);
        }
      }
    }
    
    // Apply the damage multiplier
    damage = damage * damageMultiplier;
    
    // Reduce by defense (but ensure minimum damage of 1)
    damage = Math.max(1, damage - defense / 2);
    
    // Add some randomness (reduced from 40% to 30% variance for more consistent outcomes)
    damage = Math.floor(damage * (0.85 + Math.random() * 0.3));
    
    // Play the appropriate sound based on hit type
    const audioStore = useAudio.getState();
    if (!audioStore.isMuted) {
      switch (hitType) {
        case 'critical':
          audioStore.playCriticalHit();
          break;
        case 'counter':
          audioStore.playCounterAttack();
          break;
        case 'weak':
          audioStore.playWeaknessHit();
          break;
        default:
          audioStore.playHit();
          break;
      }
    }
    
    return damage;
  }
  
  /**
   * Determines if unitType has a counter advantage against targetType
   */
  private isCounterUnit(unitType: UnitType, targetType: UnitType): boolean {
    // Get unit stats
    const stats = UNIT_STATS[unitType] as UnitStats;
    
    // Check if this unit type has counters and if targetType is in the list
    return !!(stats?.counters && stats.counters.includes(targetType));
  }
  
  /**
   * Determines if unitType is weak against targetType
   */
  private isWeakToUnit(unitType: UnitType, targetType: UnitType): boolean {
    // Get unit stats
    const stats = UNIT_STATS[unitType] as UnitStats;
    
    // Check if this unit type has weaknesses and if targetType is in the list
    return !!(stats?.weakTo && stats.weakTo.includes(targetType));
  }
  
  /**
   * Creates a visual effect to show counter advantage or weakness
   */
  private createCounterEffectVisual(x: number, y: number, isCounterBonus: boolean): void {
    // Create a text effect to show counter or weakness with enhanced visual style
    const text = this.scene.add.text(
      x, 
      y - 20, 
      isCounterBonus ? "COUNTER!" : "WEAK!", 
      { 
        fontSize: isCounterBonus ? "18px" : "16px", 
        color: isCounterBonus ? "#00ff00" : "#ff0000",
        stroke: "#000000",
        strokeThickness: 3,
        fontStyle: 'bold'
      }
    );
    
    // Set initial scale
    const initialScale = isCounterBonus ? 1.2 : 1.0;
    text.setScale(initialScale);
    
    // Animate the text with more dramatic effect
    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      scaleX: isCounterBonus ? 1.5 : 0.8,
      scaleY: isCounterBonus ? 1.5 : 0.8,
      alpha: 0,
      duration: 1200,
      ease: isCounterBonus ? 'Back.easeOut' : 'Cubic.easeOut',
      onComplete: () => {
        text.destroy();
      }
    });
    
    // Add a visual indicator circle that expands outward
    const circleColor = isCounterBonus ? 0x00ff00 : 0xff0000;
    const circle = this.scene.add.circle(x, y, 10, circleColor, 0.6);
    
    this.scene.tweens.add({
      targets: circle,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => {
        circle.destroy();
      }
    });
    
    // Add small symbol particles that fly outward
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: 600,
      blendMode: 'ADD',
      tint: circleColor,
      quantity: isCounterBonus ? 15 : 8,
      emitting: false
    });
    
    particles.explode();
    
    this.scene.time.delayedCall(600, () => {
      particles.destroy();
    });
  }
  
  /**
   * Creates a visual effect for the faith shield ability
   * @param x X position in grid coordinates
   * @param y Y position in grid coordinates
   */
  public createProtectionEffect(x: number, y: number): void {
    // Play the appropriate sound effect
    const audioStore = useAudio.getState();
    if (!audioStore.isMuted && audioStore.successSound) {
      audioStore.playSuccess();
    }
    
    // Create the shield circle
    const shield = this.scene.add.circle(
      x, 
      y, 
      TILE_SIZE * 0.6,
      0x4169E1,
      0.5
    );
    
    // Add glow effect
    shield.setStrokeStyle(3, 0x00ffff, 0.8);
    
    // Text indicator
    const shieldText = this.scene.add.text(
      x,
      y - 25,
      "Faith Shield",
      {
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#000080',
        strokeThickness: 3
      }
    ).setOrigin(0.5);
    
    // Add particles for shield effect
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 20, max: 50 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      tint: 0x4169E1,
      lifespan: 1500,
      quantity: 20,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });
    
    // Emit particles
    particles.explode(20, x, y);
    
    // Animate shield expansion and fade
    this.scene.tweens.add({
      targets: [shield],
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        shield.destroy();
      }
    });
    
    // Animate text
    this.scene.tweens.add({
      targets: [shieldText],
      y: shieldText.y - 20,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        shieldText.destroy();
        particles.destroy();
      }
    });
  }
  
  /**
   * Creates a visual effect for the stealth ability
   * @param x X position in grid coordinates
   * @param y Y position in grid coordinates
   */
  public createStealthEffect(x: number, y: number): void {
    // Play the appropriate sound effect
    const audioStore = useAudio.getState();
    if (!audioStore.isMuted && audioStore.successSound) {
      audioStore.playSuccess();
    }
    
    // Create smoke particles for stealth effect
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x444444,
      quantity: 25,
      lifespan: 2000,
      blendMode: Phaser.BlendModes.SCREEN,
      emitting: false
    });
    
    // Text indicator
    const stealthText = this.scene.add.text(
      x,
      y - 25,
      "Stealth",
      {
        fontSize: '12px',
        color: '#cccccc',
        stroke: '#333333',
        strokeThickness: 3
      }
    ).setOrigin(0.5);
    
    // Emit particles
    particles.explode(25, x, y);
    
    // Animate text
    this.scene.tweens.add({
      targets: [stealthText],
      y: stealthText.y - 20,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        stealthText.destroy();
        
        // Destroy particles after they've finished
        this.scene.time.delayedCall(2000, () => {
          particles.destroy();
        });
      }
    });
  }
  
  private autoEngageEnemies() {
    const units = this.unitManager.getAllUnits();
    
    // Process each unit that is not already attacking
    for (const unit of units) {
      if (!unit.isAttacking && !unit.isGathering && unit.type !== "worker") {
        // Look for enemy units nearby (within sight range: 2 tiles beyond attack range)
        const sightRange = unit.range + 2;
        const nearestEnemy = this.findNearestEnemyUnit(unit, units, sightRange);
        
        if (nearestEnemy) {
          // Calculate distance to enemy
          const distance = Phaser.Math.Distance.Between(unit.x, unit.y, nearestEnemy.x, nearestEnemy.y);
          const tileDistance = distance / TILE_SIZE;
          
          // Set attacking state
          unit.setAttackingTarget(nearestEnemy.id);
          
          // Only move if not already in range
          if (tileDistance > unit.range) {
            // Calculate target position in grid coordinates
            const targetTileX = Math.floor(nearestEnemy.x / TILE_SIZE);
            const targetTileY = Math.floor(nearestEnemy.y / TILE_SIZE);
            
            // Move toward target
            this.unitManager.moveUnitsTo([unit.id], targetTileX, targetTileY);
          }
        }
      }
    }
  }

  /**
   * Finds the nearest enemy unit to the given unit within a specified range
   * @param unit The unit looking for enemies
   * @param allUnits All units on the battlefield
   * @param maxRange Maximum range to search for enemies (in tiles)
   * @returns The nearest enemy unit or null if none found
   */
  private findNearestEnemyUnit(unit: any, allUnits: any[], maxRange: number = Infinity): any | null {
    let nearestEnemy = null;
    let nearestDistance = Infinity;
    
    for (const otherUnit of allUnits) {
      // Skip if same player
      if (otherUnit.playerId === unit.playerId) {
        continue;
      }
      
      // Calculate distance
      const distance = Phaser.Math.Distance.Between(unit.x, unit.y, otherUnit.x, otherUnit.y);
      const tileDistance = distance / TILE_SIZE;
      
      // Skip if beyond maximum range
      if (tileDistance > maxRange) {
        continue;
      }
      
      // Update nearest enemy if this one is closer
      if (distance < nearestDistance) {
        nearestEnemy = otherUnit;
        nearestDistance = distance;
      }
    }
    
    return nearestEnemy;
  }
}
