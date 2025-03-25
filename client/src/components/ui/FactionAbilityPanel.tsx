import React, { useEffect, useState } from 'react';
import { useFactionAbilities, AbilityState } from '../../lib/stores/useFactionAbilities';

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
      
      <style jsx>{`
        .faction-ability-panel {
          position: absolute;
          bottom: 170px; /* Position above the regular UI panel */
          right: 20px;
          background-color: rgba(0, 0, 0, 0.7);
          border: 2px solid #846e29;
          border-radius: 8px;
          padding: 10px;
          width: 240px;
          color: #fff;
          z-index: 10;
        }
        
        .faction-abilities-header h3 {
          margin: 0 0 8px 0;
          text-align: center;
          font-size: 18px;
          color: #f0c048;
          text-shadow: 1px 1px 2px #000;
        }
        
        .faction-abilities-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .ability-messages {
          position: absolute;
          top: -80px;
          left: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .ability-message {
          background-color: rgba(240, 192, 72, 0.8);
          color: #000;
          padding: 4px 12px;
          border-radius: 4px;
          margin-bottom: 4px;
          font-weight: bold;
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
      
      <style jsx>{`
        .ability-button {
          position: relative;
          width: 100%;
          height: 40px;
          overflow: hidden;
          border-radius: 4px;
        }
        
        .ability-button button {
          width: 100%;
          height: 100%;
          background-color: #3a3a3a;
          border: 1px solid #6a6a6a;
          color: white;
          font-weight: bold;
          cursor: pointer;
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 0 10px;
          transition: all 0.2s;
        }
        
        .ability-button.ready button {
          background-color: #4a6c2a;
          border-color: #6a9c3a;
          box-shadow: 0 0 10px rgba(106, 156, 58, 0.5);
        }
        
        .ability-button.active button {
          background-color: #8a4a2a;
          border-color: #c0742a;
          box-shadow: 0 0 10px rgba(192, 116, 42, 0.5);
        }
        
        .ability-button.cooldown button {
          background-color: #3a3a3a;
          border-color: #6a6a6a;
          color: #aaa;
          cursor: not-allowed;
        }
        
        .cooldown-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .cooldown-time {
          color: white;
          font-size: 14px;
          text-shadow: 1px 1px 2px black;
        }
        
        .duration-indicator {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background-color: #f0c048;
          z-index: 3;
        }
        
        .ability-button button:hover:not(:disabled) {
          filter: brightness(1.2);
        }
      `}</style>
    </div>
  );
};