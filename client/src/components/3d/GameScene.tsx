import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Environment, 
  Sky, 
  useHelper,
  Stats 
} from "@react-three/drei";
import * as THREE from "three";
import { ModelLoader, getModelPathByType } from "./ModelLoader";

// Types from our game
interface SceneUnit {
  id: string;
  type: string;
  faction: "Nephites" | "Lamanites";
  x: number;
  y: number;
  selected: boolean;
}

interface SceneBuilding {
  id: string;
  type: string;
  faction: "Nephites" | "Lamanites";
  x: number;
  y: number;
  selected: boolean;
}

// Component for rendering terrain
const Terrain = ({ mapData, size }: { mapData: any[][], size: number }) => {
  // Create a grid of planes to represent the terrain
  return (
    <group>
      {mapData.map((row, z) =>
        row.map((cell, x) => {
          const tileType = cell.type;
          let color = "#7CFC00"; // Default green for grass
          
          if (tileType === "water") color = "#4287f5";
          else if (tileType === "forest") color = "#228B22";
          else if (tileType === "hills") color = "#8B4513";
          
          return (
            <mesh 
              key={`${x}-${z}`} 
              position={[x - size/2, 0, z - size/2]} 
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial color={color} />
              
              {/* If there's a resource on this tile, add a visual indicator */}
              {cell.resource && (
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.2, 0.2, 0.1, 8]} />
                  <meshStandardMaterial 
                    color={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"} 
                    emissive={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"}
                    emissiveIntensity={0.2}
                  />
                </mesh>
              )}
            </mesh>
          );
        })
      )}
    </group>
  );
};

// Lighting setup component 
const SceneLighting = () => {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  
  // Optional: Uncomment to show light helper during development
  // useHelper(directionalLightRef, THREE.DirectionalLightHelper, 1, "red");
  
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        ref={directionalLightRef}
        position={[10, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <Sky 
        distance={450000} 
        sunPosition={[10, 5, 5]} 
        inclination={0.5}
        azimuth={0.25}
      />
    </>
  );
};

// Main Game Scene Component
export const GameScene = ({ 
  mapData, 
  units, 
  buildings,
  onUnitClick,
  onTerrainClick,
  debugMode = false
}: { 
  mapData: any[][];
  units: SceneUnit[];
  buildings: SceneBuilding[];
  onUnitClick: (unitId: string) => void;
  onTerrainClick: (x: number, y: number) => void;
  debugMode?: boolean;
}) => {
  // Reference to the canvas container for sizing
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Camera controls and position
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 20, 20]);
  
  // Map size calculation
  const mapSize = mapData.length;
  
  useEffect(() => {
    // Set initial camera position based on map size
    setCameraPosition([mapSize / 2, mapSize * 0.8, mapSize * 0.8]);
  }, [mapSize]);
  
  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0,
      }}
    >
      <Canvas shadows>
        {/* Camera setup */}
        <PerspectiveCamera 
          makeDefault 
          position={cameraPosition} 
          fov={45}
        />
        <OrbitControls 
          target={[mapSize / 2, 0, mapSize / 2]}
          maxPolarAngle={Math.PI / 2 - 0.1} // Prevent camera from going below ground
          minDistance={5}
          maxDistance={mapSize * 1.5}
        />
        
        {/* Environment & Lighting */}
        <SceneLighting />
        <Environment preset="sunset" />
        
        {/* Terrain */}
        <Terrain mapData={mapData} size={mapSize} />
        
        {/* Units */}
        {units.map((unit) => (
          <group
            key={unit.id}
            position={[unit.x - mapSize/2, 0.5, unit.y - mapSize/2]}
            onClick={(e) => {
              e.stopPropagation();
              onUnitClick(unit.id);
            }}
          >
            <ModelLoader 
              modelPath={getModelPathByType(unit.type, unit.faction)}
              scale={[0.5, 0.5, 0.5]}
              position={[0, 0, 0]}
            />
            
            {/* Selection ring for selected units */}
            {unit.selected && (
              <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.6, 0.7, 32]} />
                <meshBasicMaterial 
                  color={unit.faction === "Nephites" ? "#4287f5" : "#f54242"} 
                  transparent 
                  opacity={0.8} 
                />
              </mesh>
            )}
          </group>
        ))}
        
        {/* Buildings */}
        {buildings.map((building) => (
          <group
            key={building.id}
            position={[building.x - mapSize/2, 0, building.y - mapSize/2]}
          >
            <ModelLoader 
              modelPath={getModelPathByType(building.type, building.faction)}
              scale={[1, 1, 1]}
              position={[0, 0, 0]}
            />
            
            {/* Selection outline for selected buildings */}
            {building.selected && (
              <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.2, 1.3, 32]} />
                <meshBasicMaterial 
                  color={building.faction === "Nephites" ? "#4287f5" : "#f54242"} 
                  transparent 
                  opacity={0.8} 
                />
              </mesh>
            )}
          </group>
        ))}
        
        {/* Invisible plane for terrain clicks */}
        <mesh 
          position={[0, -0.1, 0]} 
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            // Convert the click position to game grid coordinates
            const x = Math.floor(e.point.x + mapSize/2);
            const z = Math.floor(e.point.z + mapSize/2);
            
            if (x >= 0 && x < mapSize && z >= 0 && z < mapSize) {
              onTerrainClick(x, z);
            }
          }}
        >
          <planeGeometry args={[mapSize, mapSize]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
        
        {/* Performance stats in debug mode */}
        {debugMode && <Stats />}
      </Canvas>
    </div>
  );
};

export default GameScene;