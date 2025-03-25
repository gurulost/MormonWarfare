import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../lib/stores/useGame";
import EnhancedGameScene from "./EnhancedGameScene";

interface GameOverlayProps {
  gameData: any;
  onUnitClick: (unitId: string) => void;
  onTerrainClick: (x: number, y: number) => void;
  isVisible: boolean;
  isTransitioning?: boolean;
}

export const GameOverlay: React.FC<GameOverlayProps> = ({
  gameData,
  onUnitClick,
  onTerrainClick,
  isVisible,
  isTransitioning: externalTransitioning = false
}) => {
  const gameState = useGame();
  const [units, setUnits] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [internalTransitioning, setInternalTransitioning] = useState(false);
  const prevVisibleRef = useRef(isVisible);
  
  // Combine external and internal transitioning states
  const isTransitioning = externalTransitioning || internalTransitioning;
  
  // Handle transition when visibility changes
  useEffect(() => {
    if (isVisible !== prevVisibleRef.current) {
      if (isVisible) {
        // Transitioning to visible state - start animation
        setInternalTransitioning(true);
      }
      prevVisibleRef.current = isVisible;
    }
  }, [isVisible]);

  // Process game data when it changes
  useEffect(() => {
    if (gameData) {
      try {
        // Extract map data
        if (gameData.map) {
          setMapData(gameData.map);
        }
        
        // Extract units data
        if (gameData.units) {
          const processedUnits = Object.values(gameData.units).map((unit: any) => ({
            id: unit.id,
            type: unit.type,
            faction: unit.faction,
            x: unit.x,
            y: unit.y,
            selected: unit.selected || false
          }));
          setUnits(processedUnits);
        }
        
        // Extract buildings data
        if (gameData.buildings) {
          const processedBuildings = Object.values(gameData.buildings).map((building: any) => ({
            id: building.id,
            type: building.type,
            faction: building.faction,
            x: building.x,
            y: building.y,
            selected: building.selected || false
          }));
          setBuildings(processedBuildings);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error processing game data:", error);
        setLoading(false);
      }
    }
  }, [gameData]);
  
  // When the game state or data updates, apply appropriate camera view
  useEffect(() => {
    if (isVisible && !loading) {
      // Access camera controls through the global window object
      const cameraControls = (window as any).cameraControls;
      if (cameraControls) {
        // Apply the strategic view by default
        setTimeout(() => {
          try {
            cameraControls.setStrategicView();
            console.log("Strategic view applied when overlay became visible");
          } catch (error) {
            console.error("Could not set strategic view:", error);
          }
        }, 100);
      }
    }
  }, [isVisible, loading]);
  
  // Apply 2D camera/view position sync
  useEffect(() => {
    if (isVisible && !loading && gameData) {
      // Sync the 3D camera with the 2D Phaser camera position
      // This ensures continuity between views
      if (gameData.cameraPosition) {
        const cameraControls = (window as any).cameraControls;
        if (cameraControls && cameraControls.focusOnPosition) {
          const { x, y } = gameData.cameraPosition;
          // Convert from normalized coordinates to actual map coordinates
          const mapSize = mapData.length;
          cameraControls.focusOnPosition(x * mapSize, 0, y * mapSize);
        }
      }
    }
  }, [isVisible, loading, gameData, mapData]);

  // Handle transition complete
  const handleTransitionComplete = () => {
    setInternalTransitioning(false);
  };

  // If not visible and not transitioning, don't render
  if (!isVisible && !isTransitioning) {
    return null;
  }

  return (
    <AnimatePresence>
      {(isVisible || isTransitioning) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10
          }}
        >
          {mapData.length > 0 && (
            <EnhancedGameScene
              mapData={mapData}
              units={units}
              buildings={buildings}
              onUnitClick={onUnitClick}
              onTerrainClick={onTerrainClick}
              isTransitioning={isTransitioning}
              onTransitionComplete={handleTransitionComplete}
            />
          )}
          
          {/* Camera View Controls */}
          <div className="absolute bottom-36 right-4 flex flex-col space-y-2 z-50">
            <button
              className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/80"
              onClick={() => {
                const cameraControls = (window as any).cameraControls;
                if (cameraControls) cameraControls.setStrategicView();
              }}
            >
              Strategic View
            </button>
            <button
              className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/80"
              onClick={() => {
                const cameraControls = (window as any).cameraControls;
                if (cameraControls) cameraControls.setTopDownView();
              }}
            >
              Top-Down View
            </button>
            <button
              className="bg-black/70 text-white px-3 py-2 rounded-md text-sm shadow-lg backdrop-blur-md hover:bg-black/80"
              onClick={() => {
                const cameraControls = (window as any).cameraControls;
                if (cameraControls) cameraControls.setCinematicView();
              }}
            >
              Cinematic View
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GameOverlay;