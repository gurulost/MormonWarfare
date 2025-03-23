import React, { useState, useEffect } from 'react';
import GameIntegration from './GameIntegration';
import { useAudio } from '../lib/stores/useAudio';
import { GameHUD } from './ui/gameHUD';
import { useMultiplayer } from '../lib/stores/useMultiplayer';
import { useGame } from '../lib/stores/useGame';

interface GameContainerProps {
  gameInstance?: Phaser.Game;
}

/**
 * Container component that wraps our enhanced game UI
 * This provides a clear separation between:
 * 1. Phaser canvas (game rendering)
 * 2. React UI (overlays, panels, tooltips)
 * 3. State management (multiplayer, game state)
 */
export const GameContainer: React.FC<GameContainerProps> = ({ gameInstance }) => {
  // Game state
  const [selectedUnits, setSelectedUnits] = useState<any[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<any[]>([]);
  const [resources, setResources] = useState({ food: 0, ore: 0 });
  const [tutorial, setTutorial] = useState({ 
    enabled: true,
    currentStep: 0,
    completed: false
  });
  
  // Get access to global state
  const gamePhase = useGame(state => state.phase);
  const { toggleMute } = useAudio();
  
  // Set up communication bridge between Phaser and React
  useEffect(() => {
    if (!gameInstance) return;
    
    // Create a simple event system to communicate between Phaser and React
    const phaserEvents = new EventTarget();
    
    // Store the event emitter in the game registry for Phaser scenes to access
    gameInstance.registry.set('reactEvents', phaserEvents);
    
    // Listen for unit selection events from Phaser
    phaserEvents.addEventListener('unitsSelected', (e: any) => {
      setSelectedUnits(e.detail.units || []);
    });
    
    // Listen for building selection events from Phaser
    phaserEvents.addEventListener('buildingsSelected', (e: any) => {
      setSelectedBuildings(e.detail.buildings || []);
    });
    
    // Listen for resource updates from Phaser
    phaserEvents.addEventListener('resourcesUpdated', (e: any) => {
      setResources(e.detail.resources || { food: 0, ore: 0 });
    });
    
    // Clean up event listeners
    return () => {
      phaserEvents.removeEventListener('unitsSelected', () => {});
      phaserEvents.removeEventListener('buildingsSelected', () => {});
      phaserEvents.removeEventListener('resourcesUpdated', () => {});
    };
  }, [gameInstance]);

  // Handle tutorial progression
  const advanceTutorial = () => {
    setTutorial(prev => ({
      ...prev,
      currentStep: prev.currentStep + 1,
      completed: prev.currentStep >= 4 // 5 tutorial steps total (0-4)
    }));
  };
  
  return (
    <div className="w-full h-full relative">
      {/* Game Canvas Container - Phaser renders here */}
      <div id="phaser-container" className="absolute inset-0 z-0">
        {gameInstance && <GameIntegration gameInstance={gameInstance} />}
      </div>
      
      {/* UI Overlay - Transparent container for React UI */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Game HUD - Always visible during gameplay */}
        {gamePhase === 'playing' && (
          <GameHUD 
            resources={resources}
            selectedUnits={selectedUnits}
            selectedBuildings={selectedBuildings}
            onBuildUnit={(type) => {
              // Dispatch to Phaser via game registry events
              const phaserEvents = gameInstance?.registry.get('reactEvents');
              phaserEvents?.dispatchEvent(new CustomEvent('buildUnit', { 
                detail: { unitType: type } 
              }));
            }}
            onBuildBuilding={(type) => {
              const phaserEvents = gameInstance?.registry.get('reactEvents');
              phaserEvents?.dispatchEvent(new CustomEvent('buildBuilding', {
                detail: { buildingType: type }
              }));
            }}
            // Make all interactive elements pointer-events-auto so they can be clicked
            className="pointer-events-auto" 
          />
        )}
        
        {/* Tutorial Overlay - Only shown during tutorial */}
        {gamePhase === 'playing' && tutorial.enabled && !tutorial.completed && (
          <div className="absolute bottom-32 right-8 bg-black/80 p-4 rounded-lg border border-yellow-500 
            text-white max-w-md pointer-events-auto">
            <h3 className="text-xl font-bold text-yellow-400 mb-2">
              {tutorial.currentStep === 0 && "Welcome to Book of Mormon Wars!"}
              {tutorial.currentStep === 1 && "Building Your First City Center"}
              {tutorial.currentStep === 2 && "Training Workers"}
              {tutorial.currentStep === 3 && "Gathering Resources"}
              {tutorial.currentStep === 4 && "Building an Army"}
            </h3>
            <p className="mb-4">
              {tutorial.currentStep === 0 && "This tutorial will guide you through the basics of gameplay. Click 'Next' to begin."}
              {tutorial.currentStep === 1 && "Select an open area and build a City Center. This will be your main base of operations."}
              {tutorial.currentStep === 2 && "Select your City Center and train Worker units. Workers gather resources and construct buildings."}
              {tutorial.currentStep === 3 && "Select workers and right-click on nearby resource nodes to gather Food and Ore."}
              {tutorial.currentStep === 4 && "Now that you have resources, build Barracks and train military units to defend your civilization."}
            </p>
            <div className="flex justify-between">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                onClick={() => setTutorial(prev => ({ ...prev, enabled: false }))}
              >
                Skip Tutorial
              </button>
              <button
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
                onClick={advanceTutorial}
              >
                {tutorial.currentStep < 4 ? "Next" : "Finish"}
              </button>
            </div>
          </div>
        )}
        
        {/* Sound Toggle Button - Always visible */}
        <button 
          onClick={toggleMute}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white 
            p-2 rounded-full pointer-events-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default GameContainer;