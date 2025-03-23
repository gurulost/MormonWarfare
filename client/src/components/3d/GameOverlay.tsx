import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../lib/stores/useGame";
import GameScene from "./GameScene";

interface GameOverlayProps {
  gameData: any;
  onUnitClick: (unitId: string) => void;
  onTerrainClick: (x: number, y: number) => void;
  isVisible: boolean;
}

export const GameOverlay: React.FC<GameOverlayProps> = ({
  gameData,
  onUnitClick,
  onTerrainClick,
  isVisible
}) => {
  const gameState = useGame();
  const [units, setUnits] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);

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

  // If not visible or still loading, don't render
  if (!isVisible || loading) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
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
            <GameScene
              mapData={mapData}
              units={units}
              buildings={buildings}
              onUnitClick={onUnitClick}
              onTerrainClick={onTerrainClick}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GameOverlay;