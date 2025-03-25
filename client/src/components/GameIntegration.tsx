import React, { useState, useEffect, useCallback } from "react";
import { GameHUD } from "@/components/ui/gameHUD";
import { useGame } from "@/lib/stores/useGame";
import { useMultiplayer } from "@/lib/stores/useMultiplayer";
import GameOverlay from "@/components/3d/GameOverlay";

interface GameIntegrationProps {
  gameInstance?: Phaser.Game;
}

export const GameIntegration: React.FC<GameIntegrationProps> = ({ gameInstance }) => {
  // Game state
  const gamePhase = useGame(state => state.phase);
  const multiplayer = useMultiplayer();
  
  // Game data state
  const [resources, setResources] = useState({ food: 0, ore: 0 });
  const [selectedUnits, setSelectedUnits] = useState<any[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<any[]>([]);
  const [availableTechs, setAvailableTechs] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[][]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [mapSize, setMapSize] = useState(50);
  const [playerFaction, setPlayerFaction] = useState<string>("Nephites");
  const [localPlayerId, setLocalPlayerId] = useState<string>("");
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, width: 10, height: 10 });
  const [overlayVisible, setOverlayVisible] = useState(true); // Default to 3D view
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Initialize and cleanup game data connection
  useEffect(() => {
    if (!gameInstance) return;
    
    // Get game scene
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene) return;
    
    // Ensure 3D view is correctly set with camera angle
    let cameraTimer: NodeJS.Timeout | null = null;
    if (overlayVisible) {
      cameraTimer = setTimeout(() => {
        if ((window as any).cameraControls) {
          try {
            (window as any).cameraControls.setStrategicView();
            console.log("Strategic view applied from GameIntegration");
          } catch (error) {
            console.error("Could not set strategic view:", error);
          }
        }
      }, 1000);
    }
    
    // Set up data access from Phaser game
    const updateGameData = () => {
      if (!gameScene) return;
      
      try {
        // Get resources
        const resourceManager = gameScene.resourceManager;
        if (resourceManager) {
          const playerResources = resourceManager.getPlayerResources(gameScene.getLocalPlayerId());
          if (playerResources) {
            setResources({ 
              food: playerResources.food,
              ore: playerResources.ore
            });
          }
        }
        
        // Get selected units
        const selectedUnitIds = gameScene.getSelectedUnits();
        if (selectedUnitIds) {
          const unitsList = [];
          for (const unitId of selectedUnitIds) {
            const unit = gameScene.unitManager.getUnit(unitId);
            if (unit) {
              unitsList.push(unit);
            }
          }
          setSelectedUnits(unitsList);
        }
        
        // Get selected buildings
        const selectedBuildingsList = [];
        // We'll need to implement this in the game scene
        setSelectedBuildings(selectedBuildingsList);
        
        // Get available techs
        const techManager = gameScene.techManager;
        if (techManager) {
          const player = gameScene.getLocalPlayerId();
          const faction = gameScene.players.find((p: any) => p.id === player)?.faction;
          if (player && faction) {
            const techs = techManager.getResearchableTechs(player, faction);
            setAvailableTechs(techs);
          }
        }
        
        // Get map data
        setMapData(gameScene.getMap());
        
        // Set map size
        setMapSize(gameScene.map.length);
        
        // Get player faction and ID
        setLocalPlayerId(gameScene.getLocalPlayerId());
        
        const playersList = gameScene.getPlayers();
        const localPlayer = playersList.find((p: any) => p.id === gameScene.getLocalPlayerId());
        if (localPlayer) {
          setPlayerFaction(localPlayer.faction);
        }
        
        // Get units and buildings
        if (gameScene.unitManager) {
          setUnits(gameScene.unitManager.getAllUnits());
        }
        
        if (gameScene.buildingManager) {
          setBuildings(gameScene.buildingManager.getAllBuildings());
        }
        
        // Get camera position (approximate for minimap)
        const camera = gameScene.cameras.main;
        if (camera) {
          setCameraPosition({
            x: camera.scrollX / gameScene.map.length,
            y: camera.scrollY / gameScene.map.length,
            width: camera.width / gameScene.map.length,
            height: camera.height / gameScene.map.length
          });
        }
      } catch (error) {
        console.error("Error fetching game data:", error);
      }
    };
    
    // Set up interval to update game data
    const dataInterval = setInterval(updateGameData, 500);
    
    // Clean up
    return () => {
      clearInterval(dataInterval);
      if (cameraTimer) clearTimeout(cameraTimer);
    };
  }, [gameInstance]);
  
  // Handlers for HUD actions
  const handleBuildUnit = useCallback((type: string) => {
    if (!gameInstance) return;
    
    // Get game scene to call its methods
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene || !gameScene.unitManager) return;
    
    // Find a building that can produce this unit
    const cityCenter = gameScene.buildingManager.getBuildingsByTypeAndPlayer(
      gameScene.getLocalPlayerId(),
      "cityCenter"
    )[0];
    
    const barracks = gameScene.buildingManager.getBuildingsByTypeAndPlayer(
      gameScene.getLocalPlayerId(),
      "barracks"
    )[0];
    
    const archeryRange = gameScene.buildingManager.getBuildingsByTypeAndPlayer(
      gameScene.getLocalPlayerId(),
      "archeryRange"
    )[0];
    
    let targetBuilding;
    
    // Determine which building to use
    if (type === "worker" && cityCenter) {
      targetBuilding = cityCenter;
    } else if ((type === "melee" || type === "cavalry") && barracks) {
      targetBuilding = barracks;
    } else if ((type === "ranged") && archeryRange) {
      targetBuilding = archeryRange;
    } else if (type === "hero" && cityCenter) {
      targetBuilding = cityCenter;
    }
    
    // Queue unit production if we have a suitable building
    if (targetBuilding) {
      gameScene.buildingManager.queueUnitProduction(targetBuilding.id, type);
    } else {
      console.error("No suitable building to produce this unit type");
    }
  }, [gameInstance]);
  
  const handleBuildBuilding = useCallback((type: string) => {
    if (!gameInstance) return;
    
    // Get game scene to call its methods
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene) return;
    
    // Start building placement mode
    gameScene.startBuildingPlacement(type);
  }, [gameInstance]);
  
  const handleResearchTech = useCallback((techId: string) => {
    if (!gameInstance) return;
    
    // Get game scene to call its methods
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene || !gameScene.techManager) return;
    
    // Research the technology
    gameScene.techManager.researchTechnology(techId, gameScene.getLocalPlayerId());
  }, [gameInstance]);
  
  const handleCameraViewChange = useCallback((view: string) => {
    if (!gameInstance) return;
    
    // Access camera controls through window global set by the 3D scene
    const cameraControls = (window as any).cameraControls;
    if (!cameraControls) return;
    
    // Call appropriate camera function
    switch (view) {
      case 'strategic':
        cameraControls.setStrategicView();
        break;
      case 'overhead':
        cameraControls.setTopDownView();
        break;
      case 'toggle':
        cameraControls.toggleCameraType();
        break;
      case 'rotate':
        cameraControls.rotateCameraAround();
        break;
      default:
        break;
    }
  }, [gameInstance]);
  
  const handleMinimapClick = useCallback((x: number, y: number) => {
    if (!gameInstance) return;
    
    // Get game scene to call its methods
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene || !gameScene.cameras) return;
    
    // Center camera on clicked position
    const tileSize = gameScene.map ? (gameScene.map.length / mapSize) : 32;
    gameScene.cameras.main.centerOn(x * tileSize, y * tileSize);
  }, [gameInstance, mapSize]);
  
  const handleUnitClick = useCallback((unitId: string) => {
    if (!gameInstance) return;
    
    // Get game scene to call its methods
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene) return;
    
    // Select the unit
    gameScene.selectUnitById(unitId);
  }, [gameInstance]);
  
  const handleTerrainClick = useCallback((x: number, y: number) => {
    if (!gameInstance) return;
    
    // Get game scene to call its methods
    const gameScene = gameInstance.scene.getScene("GameScene") as any;
    if (!gameScene) return;
    
    // Move selected units to position
    const selectedUnitIds = gameScene.getSelectedUnits();
    if (selectedUnitIds && selectedUnitIds.length > 0) {
      gameScene.moveSelectedUnitsTo(selectedUnitIds, x, y);
    }
  }, [gameInstance]);
  
  // Generate dummy game data for the 3D overlay scene
  const generateGameData = useCallback(() => {
    return {
      map: mapData,
      units: units.map(unit => ({
        id: unit.id,
        type: unit.type,
        faction: playerFaction,
        x: unit.x,
        y: unit.y,
        selected: selectedUnits.some(selected => selected.id === unit.id)
      })),
      buildings: buildings.map(building => ({
        id: building.id,
        type: building.type,
        faction: playerFaction,
        x: building.x,
        y: building.y,
        selected: selectedBuildings.some(selected => selected.id === building.id)
      }))
    };
  }, [mapData, units, buildings, selectedUnits, selectedBuildings, playerFaction]);
  
  return (
    <>
      {/* 3D Game Overlay - can be toggled on/off */}
      <GameOverlay
        gameData={generateGameData()}
        onUnitClick={handleUnitClick}
        onTerrainClick={handleTerrainClick}
        isVisible={overlayVisible}
        isTransitioning={isTransitioning}
      />
      
      {/* Game HUD with improved UI */}
      <GameHUD
        resources={resources}
        selectedUnits={selectedUnits}
        selectedBuildings={selectedBuildings}
        availableTechs={availableTechs}
        mapData={mapData}
        units={units}
        buildings={buildings}
        mapSize={mapSize}
        localPlayerId={localPlayerId}
        playerFaction={playerFaction}
        cameraPosition={cameraPosition}
        onBuildUnit={handleBuildUnit}
        onBuildBuilding={handleBuildBuilding}
        onResearchTech={handleResearchTech}
        onCameraViewChange={handleCameraViewChange}
        onMinimapClick={handleMinimapClick}
      />
      
      {/* Enhanced view mode controls */}
      <div className="fixed right-4 top-16 z-50 flex flex-col gap-2">
        <button
          className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/90 transition-colors"
          onClick={() => {
            // Start transition animation before changing view
            setIsTransitioning(true);
            
            // Sync camera positions between 2D and 3D before switching
            const gameScene = gameInstance?.scene.getScene("GameScene") as any;
            const cameraControls = (window as any).cameraControls;
            
            if (gameScene && cameraControls) {
              // If switching to 2D, remember 3D camera position to restore later
              if (overlayVisible) {
                // Store the current 3D camera position for later use
                console.log("Storing 3D camera position for later restoration");
              } 
              // If switching to 3D, align the 3D camera with the 2D view
              else {
                // Use the current 2D camera position to position the 3D camera
                console.log("Aligning 3D camera with 2D view");
                setTimeout(() => {
                  try {
                    cameraControls.setStrategicView();
                    
                    // Focus on the same area the 2D camera was looking at
                    if (gameScene.cameras && gameScene.cameras.main) {
                      const camera = gameScene.cameras.main;
                      const mapSize = gameScene.map ? gameScene.map.length : 50;
                      const centerX = camera.scrollX + camera.width / 2;
                      const centerY = camera.scrollY + camera.height / 2;
                      
                      // Convert to grid coordinates
                      const gridX = centerX / 32; // Assuming TILE_SIZE = 32
                      const gridY = centerY / 32;
                      
                      // Focus the 3D camera on this position
                      cameraControls.focusOnPosition(gridX, 0, gridY);
                    }
                  } catch (error) {
                    console.error("Error aligning cameras:", error);
                  }
                }, 100);
              }
            }
            
            // Toggle the overlay visibility after a short delay
            setTimeout(() => {
              setOverlayVisible(prev => !prev);
              setIsTransitioning(false);
            }, 300);
          }}
        >
          {overlayVisible ? "Switch to 2D View" : "Switch to 3D View"}
        </button>
        
        {/* Additional view control buttons - only visible in 3D mode */}
        {overlayVisible && (
          <>
            <button
              className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/90 transition-colors"
              onClick={() => handleCameraViewChange('strategic')}
            >
              Strategic View
            </button>
            <button
              className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/90 transition-colors"
              onClick={() => handleCameraViewChange('overhead')}
            >
              Top-Down View
            </button>
            <button
              className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/90 transition-colors"
              onClick={() => handleCameraViewChange('rotate')}
            >
              Rotate View
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default GameIntegration;