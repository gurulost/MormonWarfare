import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../lib/stores/useGame';
import GameOverlay from './3d/GameOverlay';
import GameInterface from './ui/GameInterface';

interface GameContainerProps {
  gameInstance?: Phaser.Game;
}

export const GameContainer: React.FC<GameContainerProps> = ({ gameInstance }) => {
  const gameState = useGame();
  const [gameData, setGameData] = useState<any>(null);
  const [resources, setResources] = useState({ food: 0, ore: 0 });
  const [selectedUnits, setSelectedUnits] = useState<any[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<any[]>([]);
  const [availableTechs, setAvailableTechs] = useState<any[]>([]);
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  const [playerFaction, setPlayerFaction] = useState<string>('');
  const [use3DView, setUse3DView] = useState<boolean>(true);

  // DOM references
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Update game data from Phaser
  useEffect(() => {
    if (!gameInstance) return;
    
    const updateGameData = () => {
      const gameScene = gameInstance.scene.getScene('GameScene') as any;
      if (!gameScene || !gameScene.scene.isActive()) return;
      
      try {
        // Get basic game data
        const map = gameScene.getMap();
        const localPlayer = gameScene.getLocalPlayerId();
        const players = gameScene.getPlayers();
        
        // Get unit and building data
        const unitManager = gameScene.unitManager;
        const buildingManager = gameScene.buildingManager;
        const resourceManager = gameScene.resourceManager;
        const techManager = gameScene.techManager;
        
        if (!unitManager || !buildingManager || !resourceManager || !techManager) return;
        
        // Get all units and buildings
        const allUnits = unitManager.getAllUnits();
        const allBuildings = buildingManager.getAllBuildings();
        
        // Get selected units
        const selectedUnitIds = gameScene.getSelectedUnits();
        const selectedUnits = allUnits.filter((unit: { id: string }) => selectedUnitIds.includes(unit.id));
        
        // Get selected buildings (assuming a similar method exists)
        const selectedBuildings = allBuildings.filter((building: { selected: boolean }) => building.selected);
        
        // Get player resources
        const playerResources = resourceManager.getPlayerResources(localPlayer);
        
        // Get available technologies
        const faction = players.find((p: { id: string; faction: string }) => p.id === localPlayer)?.faction || 'Nephites';
        const availableTechs = techManager.getResearchableTechs(localPlayer, faction);
        
        // Set state
        setGameData({
          map,
          units: allUnits,
          buildings: allBuildings
        });
        setResources(playerResources);
        setSelectedUnits(selectedUnits);
        setSelectedBuildings(selectedBuildings);
        setAvailableTechs(availableTechs);
        setLocalPlayerId(localPlayer);
        setPlayerFaction(faction);
      } catch (err) {
        console.error('Error updating game data:', err);
      }
    };
    
    // Set up interval to update game data
    const interval = setInterval(updateGameData, 500);
    
    return () => {
      clearInterval(interval);
    };
  }, [gameInstance]);
  
  // Handle unit clicks from the 3D view
  const handleUnitClick = (unitId: string) => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (!gameScene) return;
    
    // Call the unit selection method in the Phaser scene
    // This assumes you have a method like this in your GameScene
    if (gameScene.selectUnitById) {
      gameScene.selectUnitById(unitId);
    }
  };
  
  // Handle terrain clicks from the 3D view
  const handleTerrainClick = (x: number, y: number) => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (!gameScene) return;
    
    // Call the move units method in the Phaser scene if units are selected
    if (selectedUnits.length > 0 && gameScene.moveSelectedUnitsTo) {
      const selectedUnitIds = selectedUnits.map((unit: { id: string }) => unit.id);
      gameScene.moveSelectedUnitsTo(selectedUnitIds, x, y);
    }
  };
  
  // Handle build unit action
  const handleBuildUnit = (type: string) => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (!gameScene || !gameScene.buildingManager) return;
    
    // Get selected buildings that can produce units (like barracks or city centers)
    const validBuildings = selectedBuildings.filter((building: { type: string }) => 
      building.type === 'cityCenter' || 
      building.type === 'barracks' || 
      building.type === 'archeryRange'
    );
    
    if (validBuildings.length > 0) {
      // Queue unit production in the first valid building
      gameScene.buildingManager.queueUnitProduction(validBuildings[0].id, type);
    }
  };
  
  // Handle build building action
  const handleBuildBuilding = (type: string) => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (!gameScene) return;
    
    // This assumes you have a method to start building placement mode
    if (gameScene.startBuildingPlacement) {
      gameScene.startBuildingPlacement(type);
    }
  };
  
  // Handle research tech action
  const handleResearchTech = (techId: string) => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (!gameScene || !gameScene.techManager) return;
    
    // Research the technology
    gameScene.techManager.researchTechnology(techId, localPlayerId);
  };
  
  // Toggle between 2D and 3D views
  const toggleView = () => {
    setUse3DView(!use3DView);
  };
  
  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Game UI */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={toggleView}
          className="px-4 py-2 bg-black/70 text-white rounded-md hover:bg-black/90 transition-colors"
        >
          Switch to {use3DView ? '2D' : '3D'} View
        </button>
      </div>
      
      {/* 3D Game Overlay */}
      {gameData && (
        <GameOverlay
          gameData={gameData}
          onUnitClick={handleUnitClick}
          onTerrainClick={handleTerrainClick}
          isVisible={use3DView}
        />
      )}
      
      {/* Game Interface */}
      {gameData && (
        <GameInterface
          resources={resources}
          selectedUnits={selectedUnits}
          selectedBuildings={selectedBuildings}
          onBuildUnit={handleBuildUnit}
          onBuildBuilding={handleBuildBuilding}
          onResearchTech={handleResearchTech}
          availableTechs={availableTechs}
          localPlayerId={localPlayerId}
          playerFaction={playerFaction}
        />
      )}
    </div>
  );
};

export default GameContainer;