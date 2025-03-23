import Phaser from "phaser";
import { UnitManager } from "./UnitManager";
import { 
  TILE_SIZE, 
  COMBAT_UPDATE_RATE, 
  COUNTER_DAMAGE_MULTIPLIER,
  WEAKNESS_DAMAGE_MULTIPLIER,
  UNIT_STATS
} from "../config";
import { useAudio } from "../../lib/stores/useAudio";

export class CombatManager {
  private scene: Phaser.Scene;
  private unitManager: UnitManager;
  private lastCombatUpdate: number;
  
  constructor(scene: Phaser.Scene, unitManager: UnitManager) {
    this.scene = scene;
    this.unitManager = unitManager;
    this.lastCombatUpdate = 0;
  }
  
  update(delta: number) {
    // Only update combat every COMBAT_UPDATE_RATE milliseconds
    this.lastCombatUpdate += delta;
    
    if (this.lastCombatUpdate >= COMBAT_UPDATE_RATE) {
      this.processCombat();
      this.lastCombatUpdate = 0;
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
          // Attack the target with the counter system
          const damage = this.calculateDamage(unit.attack, targetUnit.defense, unit, targetUnit);
          const killed = targetUnit.takeDamage(damage);
          
          // Play hit sound
          const audioStore = useAudio.getState();
          if (!audioStore.isMuted) {
            audioStore.playHit();
          }
          
          // Create visual damage indicator
          this.createDamageIndicator(targetUnit.x, targetUnit.y, damage);
          
          // If target is killed, remove it
          if (killed) {
            // Play death effect before removing
            this.createDeathEffect(targetUnit.x, targetUnit.y, targetUnit.type);
            
            this.unitManager.removeUnit(targetUnit.id);
            unit.stopAttacking();
            
            // Add exp to the unit that got the kill (could be used for veterancy system)
            // unit.addExperience(10);
          }
        } else {
          // Move toward target
          const targetTileX = Math.floor(targetUnit.x / TILE_SIZE);
          const targetTileY = Math.floor(targetUnit.y / TILE_SIZE);
          
          // Update the path every few seconds
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
   * Creates a visual damage indicator
   */
  private createDamageIndicator(x: number, y: number, damage: number): void {
    // Create damage text that floats up and fades out
    const text = this.scene.add.text(
      x, 
      y - 10, 
      `${Math.round(damage)}`, 
      { 
        fontSize: "14px", 
        color: "#ff6060",
        stroke: "#000000",
        strokeThickness: 2
      }
    );
    
    // Animate the damage text
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => {
        text.destroy();
      }
    });
  }
  
  /**
   * Creates a death effect when a unit is killed
   */
  private createDeathEffect(x: number, y: number, unitType: string): void {
    // Create particles for death effect
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 800,
      blendMode: 'ADD',
      tint: unitType === 'worker' ? 0xffff00 : 0xff0000
    });
    
    // Auto-destroy the emitter after it's done
    this.scene.time.delayedCall(800, () => {
      particles.destroy();
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
  
  private calculateDamage(attack: number, defense: number, attacker?: any, defender?: any): number {
    // Base damage is attack value
    let damage = attack;
    let damageMultiplier = 1.0;
    
    // Apply counter system bonuses if both units are combat units
    if (attacker && defender) {
      // Get unit types
      const attackerType = attacker.type;
      const defenderType = defender.type;
      
      // Check for counter bonus
      if (this.isCounterUnit(attackerType, defenderType)) {
        // This unit type counters the defending unit type
        damageMultiplier *= COUNTER_DAMAGE_MULTIPLIER;
        
        // Create a visual effect to show counter bonus
        this.createCounterEffectVisual(defender.x, defender.y, true);
        
        console.log(`Counter bonus! ${attackerType} is strong against ${defenderType}`);
      }
      
      // Check for weakness penalty
      if (this.isWeakToUnit(attackerType, defenderType)) {
        // Defending unit has advantage against attacking unit
        defense *= WEAKNESS_DAMAGE_MULTIPLIER;
        
        // Create a visual effect to show weakness
        this.createCounterEffectVisual(attacker.x, attacker.y, false);
        
        console.log(`Weakness penalty! ${attackerType} is weak against ${defenderType}`);
      }
    }
    
    // Apply the damage multiplier
    damage = damage * damageMultiplier;
    
    // Reduce by defense (but ensure minimum damage of 1)
    damage = Math.max(1, damage - defense / 2);
    
    // Add some randomness (reduced from 40% to 30% variance for more consistent outcomes)
    damage = Math.floor(damage * (0.85 + Math.random() * 0.3));
    
    return damage;
  }
  
  /**
   * Determines if unitType has a counter advantage against targetType
   */
  private isCounterUnit(unitType: string, targetType: string): boolean {
    // Get unit stats
    const stats = UNIT_STATS[unitType as keyof typeof UNIT_STATS];
    
    // Check if this unit type has counters and if targetType is in the list
    return !!(stats && stats.counters && stats.counters.includes(targetType));
  }
  
  /**
   * Determines if unitType is weak against targetType
   */
  private isWeakToUnit(unitType: string, targetType: string): boolean {
    // Get unit stats
    const stats = UNIT_STATS[unitType as keyof typeof UNIT_STATS];
    
    // Check if this unit type has weaknesses and if targetType is in the list
    return !!(stats && stats.weakTo && stats.weakTo.includes(targetType));
  }
  
  /**
   * Creates a visual effect to show counter advantage or weakness
   */
  private createCounterEffectVisual(x: number, y: number, isCounterBonus: boolean): void {
    // Create a text effect to show counter or weakness
    const text = this.scene.add.text(
      x, 
      y - 20, 
      isCounterBonus ? "COUNTER!" : "WEAK!", 
      { 
        fontSize: "16px", 
        color: isCounterBonus ? "#00ff00" : "#ff0000",
        stroke: "#000000",
        strokeThickness: 3
      }
    );
    
    // Animate the text
    this.scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        text.destroy();
      }
    });
  }
  
  private autoEngageEnemies() {
    const units = this.unitManager.getAllUnits();
    
    // Process each unit that is not already attacking
    for (const unit of units) {
      if (!unit.isAttacking && !unit.isGathering && unit.type !== "worker") {
        // Look for enemy units nearby
        const nearestEnemy = this.findNearestEnemyUnit(unit, units);
        
        if (nearestEnemy) {
          // Only auto-engage if enemy is very close
          const distance = Phaser.Math.Distance.Between(unit.x, unit.y, nearestEnemy.x, nearestEnemy.y);
          const tileDistance = distance / TILE_SIZE;
          
          // Auto-engage only if enemy is within sight range (2 tiles beyond attack range)
          if (tileDistance <= unit.range + 2) {
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
  }
  
  private findNearestEnemyUnit(unit: any, allUnits: any[]): any | null {
    let nearestEnemy = null;
    let nearestDistance = Infinity;
    
    for (const otherUnit of allUnits) {
      // Skip if same player or not a combat unit
      if (otherUnit.playerId === unit.playerId) {
        continue;
      }
      
      // Calculate distance
      const distance = Phaser.Math.Distance.Between(unit.x, unit.y, otherUnit.x, otherUnit.y);
      
      // Update nearest enemy if this one is closer
      if (distance < nearestDistance) {
        nearestEnemy = otherUnit;
        nearestDistance = distance;
      }
    }
    
    return nearestEnemy;
  }
}
