import React, { useEffect, useState } from 'react';
import { useFactionAbilities, AbilityState } from '../../lib/stores/useFactionAbilities';
import './factionAbilities.css';

interface FactionAbilityPanelProps {
  localPlayerId: string;
}

export const FactionAbilityPanel: React.FC<FactionAbilityPanelProps> = ({ localPlayerId }) => {
  const { 
    currentFaction, 
    abilities, 
    activateAbility 
  } = useFactionAbilities();
  
  const [abilityActivationMessages, setAbilityActivationMessages] = useState<string[]>([]);
  
  // Handle ability activation feedback
  useEffect(() => {
    const handleAbilityActivated = (event: CustomEvent) => {
      const { abilityName } = event.detail;
      
      // Add new message
      setAbilityActivationMessages(prev => [
        `${abilityName} activated!`,
        ...prev.slice(0, 2) // Only keep the last 3 messages
      ]);
      
      // Remove message after 3 seconds
      setTimeout(() => {
        setAbilityActivationMessages(prev => prev.slice(0, -1));
      }, 3000);
    };
    
    // Listen for ability activation events
    document.addEventListener('abilityActivated', handleAbilityActivated as EventListener);
    
    return () => {
      document.removeEventListener('abilityActivated', handleAbilityActivated as EventListener);
    };
  }, []);
  
  // Don't render if no faction set
  if (!currentFaction || abilities.length === 0) {
    return null;
  }

  // Only show unlocked abilities
  const unlockedAbilities = abilities.filter(ability => ability.unlocked);
  
  // Don't render if no abilities unlocked yet
  if (unlockedAbilities.length === 0) {
    return null;
  }
  
  return (
    <div className="faction-ability-panel">
      <div className="faction-abilities-header">
        <h3>{currentFaction} Abilities</h3>
      </div>
      
      <div className="faction-abilities-list">
        {unlockedAbilities.map(ability => (
          <AbilityButton 
            key={ability.id}
            ability={ability}
            onClick={() => activateAbility(ability.id)}
          />
        ))}
      </div>
      
      {/* Ability activation messages */}
      <div className="ability-messages">
        {abilityActivationMessages.map((message, index) => (
          <div key={index} className="ability-message">
            {message}
          </div>
        ))}
      </div>
    </div>
  );
};

interface AbilityButtonProps {
  ability: AbilityState;
  onClick: () => void;
}

const AbilityButton: React.FC<AbilityButtonProps> = ({ ability, onClick }) => {
  // Format time as MM:SS
  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.ceil(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate cooldown percentage for visual indicator
  const cooldownPercent = Math.min(100, Math.max(0, 
    ability.inCooldown 
      ? (ability.cooldownRemaining / ability.cooldown) * 100
      : 0
  ));
  
  // Calculate duration percentage for visual indicator
  const durationPercent = Math.min(100, Math.max(0,
    ability.isActive && ability.durationRemaining && ability.duration
      ? (ability.durationRemaining / ability.duration) * 100
      : 0
  ));
  
  // Determine button state styling
  const getButtonClass = () => {
    if (ability.isActive) return 'active';
    if (ability.inCooldown) return 'cooldown';
    return 'ready';
  };
  
  return (
    <div className={`ability-button ${getButtonClass()}`}>
      <button 
        onClick={onClick}
        disabled={ability.inCooldown || ability.isActive}
        title={ability.description}
      >
        {ability.name}
        
        {/* Cooldown overlay */}
        {ability.inCooldown && (
          <div className="cooldown-overlay" style={{ height: `${cooldownPercent}%` }}>
            <span className="cooldown-time">{formatTime(ability.cooldownRemaining)}</span>
          </div>
        )}
        
        {/* Duration indicator */}
        {ability.isActive && ability.durationRemaining && (
          <div className="duration-indicator" style={{ width: `${durationPercent}%` }}></div>
        )}
      </button>
    </div>
  );
};