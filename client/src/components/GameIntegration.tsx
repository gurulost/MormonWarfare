import React, { useState, useEffect, useCallback } from "react";
import { GameHUD } from "@/components/ui/gameHUD";
import { useGame } from "@/lib/stores/useGame";
import { useMultiplayer } from "@/lib/stores/useMultiplayer";
import GameOverlay from "@/components/3d/GameOverlay";
import FactionAbilityPanel from "@/components/ui/FactionAbilityPanel";
import { useFactionAbilities } from "@/lib/stores/useFactionAbilities";
import { EVENTS } from "@/game/events/PhaserEvents";

interface GameIntegrationProps {
  gameInstance?: Phaser.Game;
}

export const GameIntegration: React.FC<GameIntegrationProps> = ({ gameInstance }) => {
  // Game state
  const gamePhase = useGame(state => state.phase);
  const multiplayer = useMultiplayer();
  const { setFaction, abilities, activateAbility } = useFactionAbilities();
  
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
    
    // Set up resource event listener
    const handleResourcesUpdated = (event: CustomEvent) => {
      try {
        const { playerId, resources: updatedResources } = event.detail;
        // Only update resources for the local player
        if (playerId === gameScene.getLocalPlayerId()) {
          setResources({
            food: updatedResources.food,
            ore: updatedResources.ore
          });
          console.log("Resources updated via event:", updatedResources);
        }
      } catch (error) {
        console.error("Error handling resource update event:", error);
      }
    };
    
    // Set up unit selection event listener
    const handleUnitsSelected = (event: CustomEvent) => {
      try {
        const { units, playerId } = event.detail;
        
        // Only update for local player
        if (playerId === gameScene.getLocalPlayerId()) {
          setSelectedUnits(units);
          console.log("Units selected via event:", units.map((u: any) => u.id));
        }
      } catch (error) {
        console.error("Error handling unit selection event:", error);
      }
    };
    
    // Set up selection cleared event listener
    const handleSelectionCleared = (event: CustomEvent) => {
      try {
        const { type, playerId } = event.detail;
        
        // Only update for local player
        if (playerId === gameScene.getLocalPlayerId()) {
          if (type === 'units' || type === 'all') {
            setSelectedUnits([]);
            console.log("Unit selection cleared via event");
          }
        }
      } catch (error) {
        console.error("Error handling selection cleared event:", error);
      }
    };
    
    // Add event listeners
    document.addEventListener(EVENTS.RESOURCES_UPDATED, handleResourcesUpdated as EventListener);
    document.addEventListener(EVENTS.UNITS_SELECTED, handleUnitsSelected as EventListener);
    document.addEventListener(EVENTS.SELECTION_CLEARED, handleSelectionCleared as EventListener);
    
    // Set up data access from Phaser game for items not yet converted to events
    const updateGameData = () => {
      if (!gameScene) return;
      
      try {
        // Get selected buildings - not yet event-driven
        const selectedBuildingsList: any[] = [];
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
          // Update faction in component state
          setPlayerFaction(localPlayer.faction);
          
          // Update faction in ability store if changed
          if (localPlayer.faction && localPlayer.faction !== playerFaction) {
            setFaction(localPlayer.faction);
            console.log(`Updated faction abilities for ${localPlayer.faction}`);
          }
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
    
    // Set up interval to update other game data
    const dataInterval = setInterval(updateGameData, 500);
    
    // Initialize resources if they exist
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
    
    // Create a test div for event testing buttons
    const testDiv = document.createElement('div');
    testDiv.style.position = 'fixed';
    testDiv.style.bottom = '10px';
    testDiv.style.left = '10px';
    testDiv.style.zIndex = '1000';
    testDiv.style.display = 'flex';
    testDiv.style.flexDirection = 'column';
    testDiv.style.gap = '5px';
    
    // Resource event test button
    const resourceTestButton = document.createElement('button');
    resourceTestButton.textContent = 'Test Resource Event';
    resourceTestButton.style.padding = '8px 16px';
    resourceTestButton.style.backgroundColor = '#4CAF50';
    resourceTestButton.style.color = 'white';
    resourceTestButton.style.border = 'none';
    resourceTestButton.style.borderRadius = '4px';
    resourceTestButton.style.cursor = 'pointer';
    
    resourceTestButton.onclick = () => {
      try {
        // Get the current local player ID
        const playerId = gameScene.getLocalPlayerId();
        if (!playerId) {
          console.error("No local player ID found");
          return;
        }
        
        // Get current resources and add 100 to each
        const resourceManager = gameScene.resourceManager;
        if (resourceManager) {
          const currentResources = resourceManager.getPlayerResources(playerId);
          const updatedResources = {
            food: currentResources.food + 100,
            ore: currentResources.ore + 100
          };
          
          // Update resources which should trigger our event
          resourceManager.updateResources(playerId, updatedResources);
          console.log('Test resource event: Adding 100 to food and ore');
        } else {
          console.error("Resource manager not found");
        }
      } catch (error) {
        console.error("Error in resource test button:", error);
      }
    };
    
    // Unit selection event test button
    const selectionTestButton = document.createElement('button');
    selectionTestButton.textContent = 'Test Unit Selection Event';
    selectionTestButton.style.padding = '8px 16px';
    selectionTestButton.style.backgroundColor = '#2196F3';
    selectionTestButton.style.color = 'white';
    selectionTestButton.style.border = 'none';
    selectionTestButton.style.borderRadius = '4px';
    selectionTestButton.style.cursor = 'pointer';
    
    selectionTestButton.onclick = () => {
      try {
        // Get the current local player ID
        const playerId = gameScene.getLocalPlayerId();
        if (!playerId) {
          console.error("No local player ID found");
          return;
        }
        
        // Get a unit belonging to the player
        const unitManager = gameScene.unitManager;
        if (unitManager) {
          const playerUnits = unitManager.getUnitsByPlayer(playerId);
          if (playerUnits.length > 0) {
            // Select the first unit
            const unitId = playerUnits[0].id;
            console.log('Test unit selection event: Selecting unit', unitId);
            gameScene.selectUnitById(unitId);
          } else {
            console.warn("No player units found for selection test");
          }
        } else {
          console.error("Unit manager not found");
        }
      } catch (error) {
        console.error("Error in selection test button:", error);
      }
    };
    
    // Selection clear event test button
    const clearSelectionButton = document.createElement('button');
    clearSelectionButton.textContent = 'Test Clear Selection';
    clearSelectionButton.style.padding = '8px 16px';
    clearSelectionButton.style.backgroundColor = '#FF5722';
    clearSelectionButton.style.color = 'white';
    clearSelectionButton.style.border = 'none';
    clearSelectionButton.style.borderRadius = '4px';
    clearSelectionButton.style.cursor = 'pointer';
    
    clearSelectionButton.onclick = () => {
      try {
        // Get the current local player ID
        const playerId = gameScene.getLocalPlayerId();
        if (!playerId) {
          console.error("No local player ID found");
          return;
        }
        
        console.log('Test clear selection event');
        
        // Use unit manager to emit a selection cleared event
        const unitManager = gameScene.unitManager;
        if (unitManager) {
          // Create a rectangle outside the screen to clear all selections
          const offscreenRect = new Phaser.Geom.Rectangle(-100, -100, 1, 1);
          unitManager.selectUnitsInBounds(offscreenRect, playerId);
        } else {
          console.error("Unit manager not found");
        }
      } catch (error) {
        console.error("Error in clear selection button:", error);
      }
    };
    
    testDiv.appendChild(resourceTestButton);
    testDiv.appendChild(selectionTestButton);
    testDiv.appendChild(clearSelectionButton);
    document.body.appendChild(testDiv);

    // Clean up
    return () => {
      clearInterval(dataInterval);
      if (cameraTimer) clearTimeout(cameraTimer);
      
      // Remove all event listeners
      document.removeEventListener(EVENTS.RESOURCES_UPDATED, handleResourcesUpdated as EventListener);
      document.removeEventListener(EVENTS.UNITS_SELECTED, handleUnitsSelected as EventListener);
      document.removeEventListener(EVENTS.SELECTION_CLEARED, handleSelectionCleared as EventListener);
      
      // Remove test button
      if (document.body.contains(testDiv)) {
        document.body.removeChild(testDiv);
      }
    };
  }, [gameInstance, playerFaction]);
  
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
  
  // Handle faction ability activation
  useEffect(() => {
    // Create custom event listener for ability activation
    const handleAbilityActivation = (event: CustomEvent) => {
      if (!gameInstance) return;
      
      const gameScene = gameInstance.scene.getScene("GameScene") as any;
      if (!gameScene) return;
      
      const { abilityId } = event.detail;
      console.log(`Activating ability: ${abilityId}`);
      
      // Log the current faction and all abilities
      console.log(`Current faction: ${playerFaction}`);
      console.log(`Available abilities:`, abilities);
      
      // Find the ability data
      const ability = abilities.find(a => a.id === abilityId);
      if (!ability) return;
      
      // Apply ability effect based on faction and ability type
      const selectedUnitIds = gameScene.getSelectedUnits();
      
      if (selectedUnitIds && selectedUnitIds.length > 0) {
        // Get all selected units
        const selectedUnits = selectedUnitIds.map((id: string) => gameScene.unitManager.getUnit(id)).filter(Boolean);
        
        if (ability.id === 'faithShield' && playerFaction === 'Nephites') {
          // Apply faith shield to selected Stripling Warriors
          let validUnitFound = false;
          
          selectedUnits.forEach((unit: any) => {
            if (unit.type === 'striplingWarrior') {
              validUnitFound = true;
              unit.hasFaithShield = true;
              unit.usedFaithShield = false;
              
              // Create visual effect
              if (gameScene.combatManager) {
                const effectPosition = { x: unit.x, y: unit.y };
                gameScene.combatManager.createProtectionEffect(effectPosition.x, effectPosition.y);
              }
            }
          });
          
          // Dispatch event based on whether any valid units were found
          const abilityEvent = new CustomEvent('ability-activated', { 
            detail: { abilityId, success: validUnitFound } 
          });
          window.dispatchEvent(abilityEvent);
          
          if (!validUnitFound) {
            console.warn('No Stripling Warriors selected for Faith Shield ability');
          }
        } 
        else if (ability.id === 'stealth' && playerFaction === 'Lamanites') {
          // Apply stealth to selected Lamanite scouts
          let validUnitFound = false;
          
          selectedUnits.forEach((unit: any) => {
            if (unit.type === 'lamaniteScout') {
              validUnitFound = true;
              unit.isStealthed = true;
              
              // Create visual effect
              if (gameScene.combatManager) {
                const effectPosition = { x: unit.x, y: unit.y };
                gameScene.combatManager.createStealthEffect(effectPosition.x, effectPosition.y);
              }
            }
          });
          
          // Dispatch event based on whether any valid units were found
          const abilityEvent = new CustomEvent('ability-activated', { 
            detail: { abilityId, success: validUnitFound } 
          });
          window.dispatchEvent(abilityEvent);
          
          if (!validUnitFound) {
            console.warn('No Lamanite Scouts selected for Stealth ability');
          }
        }
        else {
          console.warn(`Ability ${ability.id} not implemented or not applicable to selected units`);
          // Dispatch event for failed activation
          const abilityEvent = new CustomEvent('ability-activated', { 
            detail: { abilityId, success: false } 
          });
          window.dispatchEvent(abilityEvent);
        }
      } else {
        console.warn('No units selected for ability activation');
        // Dispatch event for failed activation
        const abilityEvent = new CustomEvent('ability-activated', { 
          detail: { abilityId, success: false } 
        });
        window.dispatchEvent(abilityEvent);
      }
    };
    
    // Add event listener for ability activation
    window.addEventListener('activate-ability', handleAbilityActivation as EventListener);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('activate-ability', handleAbilityActivation as EventListener);
    };
  }, [gameInstance, abilities, playerFaction]);
  
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
      
      {/* Faction-specific abilities panel */}
      {gamePhase === 'playing' && localPlayerId && (
        <FactionAbilityPanel localPlayerId={localPlayerId} />
      )}
      
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