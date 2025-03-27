import React, { useEffect, useState } from 'react';
import { useFactionAbilities, AbilityState } from '../../lib/stores/useFactionAbilities';
import { EVENTS } from '../../game/events/PhaserEvents';
import './factionAbilities.css';

interface FactionAbilityPanelProps {
  localPlayerId: string;
}

export const FactionAbilityPanel: React.FC<FactionAbilityPanelProps> = ({ localPlayerId }) => {
  const {
    currentFaction,
    abilities,
    activateAbility,
    updateCooldowns
  } = useFactionAbilities();
  
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  
  // Update cooldowns every frame
  useEffect(() => {
    let animationFrameId: number;
    
    const updateFrame = () => {
      const now = Date.now();
      const deltaMs = now - lastUpdateTime;
      
      updateCooldowns(deltaMs);
      setLastUpdateTime(now);
      
      animationFrameId = requestAnimationFrame(updateFrame);
    };
    
    animationFrameId = requestAnimationFrame(updateFrame);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [updateCooldowns, lastUpdateTime]);
  
  // Listen for ability activation events
  useEffect(() => {
    const handleAbilityActivated = (event: CustomEvent) => {
      const { abilityId, success } = event.detail;
      
      // Find the ability that was activated
      const ability = abilities.find(a => a.id === abilityId);
      if (!ability) return;
      
      if (success) {
        // Create a floating notification
        const notification = document.createElement('div');
        notification.className = `ability-notification ${currentFaction?.toLowerCase()}`;
        notification.textContent = `${ability.name} activated!`;
        document.body.appendChild(notification);
        
        // Animate and remove
        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 2000);
      } else {
        // Create a failure notification
        const notification = document.createElement('div');
        notification.className = `ability-notification ability-failed`;
        notification.textContent = `${ability.name} failed! Select appropriate units.`;
        document.body.appendChild(notification);
        
        // Animate and remove
        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 2000);
      }
    };
    
    // Add event listener
    document.addEventListener(EVENTS.ABILITY_COMPLETED, handleAbilityActivated as EventListener);
    
    return () => {
      document.removeEventListener(EVENTS.ABILITY_COMPLETED, handleAbilityActivated as EventListener);
    };
  }, [currentFaction, abilities]);
  
  // If no faction or abilities, don't render
  if (!currentFaction || abilities.length === 0) {
    return null;
  }
  
  // Get only the unlocked abilities
  const availableAbilities = abilities.filter(ability => 
    ability.unlocked || process.env.NODE_ENV === 'development' // Show all in dev mode
  );
  
  return (
    <div className="faction-abilities-container">
      {availableAbilities.map(ability => (
        <AbilityButton 
          key={ability.id}
          ability={ability}
          faction={currentFaction}
          onClick={() => activateAbility(ability.id)}
        />
      ))}
    </div>
  );
};

interface AbilityButtonProps {
  ability: AbilityState;
  faction: string;
  onClick: () => void;
}

const AbilityButton: React.FC<AbilityButtonProps> = ({ ability, faction, onClick }) => {
  const factionClass = faction.toLowerCase();
  
  // Calculate cooldown progress (0-100%)
  const cooldownProgress = ability.inCooldown 
    ? (1 - ability.cooldownRemaining / ability.cooldown) * 100 
    : 100;
  
  // Format cooldown time remaining
  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return 'Ready';
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };
  
  // Function to handle button click
  const handleClick = () => {
    // If ability is in cooldown or not unlocked, do nothing
    if (ability.inCooldown || !ability.unlocked) {
      return;
    }
    
    // Call the onClick handler (activateAbility)
    onClick();
    
    // Dispatch the custom event to trigger ability activation in game
    const event = new CustomEvent(EVENTS.ABILITY_ACTIVATED, {
      detail: { abilityId: ability.id }
    });
    document.dispatchEvent(event);
  };
  
  return (
    <button
      className={`ability-button ${factionClass}`}
      onClick={handleClick}
      disabled={ability.inCooldown || !ability.unlocked}
    >
      {/* Ability icon */}
      <div className="ability-icon">{ability.icon}</div>
      
      {/* Ability name */}
      <div className="ability-name">{ability.name}</div>
      
      {/* Cooldown overlay */}
      {ability.inCooldown && (
        <div className="ability-overlay">
          {formatCooldown(ability.cooldownRemaining)}
        </div>
      )}
      
      {/* Active effect indicator */}
      {ability.isActive && (
        <div className={`ability-effect active-${factionClass}`}></div>
      )}
      
      {/* Cooldown progress bar */}
      <div 
        className={`ability-cooldown ${factionClass}`}
        style={{ width: `${cooldownProgress}%` }}
      ></div>
      
      {/* Tooltip with additional information */}
      <div className={`ability-tooltip ${factionClass}`}>
        <div className="tooltip-title">{ability.name}</div>
        <div className="tooltip-description">{ability.description}</div>
        {ability.effectDescription && (
          <div className="tooltip-lore">{ability.effectDescription}</div>
        )}
        <div className="tooltip-stats">
          <div className="tooltip-stat">
            <span>Cooldown</span>
            <span className="tooltip-stat-value">{ability.cooldown / 1000}s</span>
          </div>
          {ability.duration && (
            <div className="tooltip-stat">
              <span>Duration</span>
              <span className="tooltip-stat-value">{ability.duration / 1000}s</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

export default FactionAbilityPanel;