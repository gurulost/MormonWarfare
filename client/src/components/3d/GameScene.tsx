import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

// Component for rendering terrain with enhanced visuals
const Terrain = ({ mapData, size }: { mapData: any[][], size: number }) => {
  // Create a grid of planes to represent the terrain
  return (
    <group>
      {mapData.map((row, z) =>
        row.map((cell, x) => {
          const tileType = cell.type;
          let color = "#7CFC00"; // Default green for grass
          let height = 0;
          let roughness = 0.8;
          let metalness = 0.1;
          
          // Enhanced terrain visuals based on type
          if (tileType === "water") {
            color = "#4287f5";
            roughness = 0.1;
            metalness = 0.6;
            height = -0.15; // Water is slightly below ground level
          } 
          else if (tileType === "forest") {
            color = "#228B22";
            height = 0.05; // Forest is slightly elevated
            
            // Add small tree indicators for forests
            const treeGroup = (
              <group position={[0, 0.3, 0]}>
                {/* Tree trunk */}
                <mesh position={[0, 0.2, 0]}>
                  <cylinderGeometry args={[0.05, 0.07, 0.4, 8]} />
                  <meshStandardMaterial color="#8B4513" />
                </mesh>
                {/* Tree foliage */}
                <mesh position={[0, 0.5, 0]}>
                  <coneGeometry args={[0.2, 0.5, 8]} />
                  <meshStandardMaterial color="#006400" />
                </mesh>
              </group>
            );
            
            return (
              <group key={`${x}-${z}`} position={[x - size/2, height, z - size/2]}>
                {/* Base terrain tile */}
                <mesh 
                  rotation={[-Math.PI / 2, 0, 0]}
                  receiveShadow
                >
                  <planeGeometry args={[1, 1, 4, 4]} />
                  <meshStandardMaterial 
                    color={color} 
                    roughness={roughness} 
                    metalness={metalness}
                  />
                </mesh>
                
                {/* Trees only if it's not a resource tile */}
                {!cell.resource && treeGroup}
                
                {/* Resource indicator */}
                {cell.resource && (
                  <mesh position={[0, 0.15, 0]}>
                    <cylinderGeometry args={[0.2, 0.25, 0.1, 8]} />
                    <meshStandardMaterial 
                      color={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"} 
                      emissive={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"}
                      emissiveIntensity={0.3}
                      roughness={0.3}
                      metalness={0.7}
                    />
                  </mesh>
                )}
              </group>
            );
          } 
          else if (tileType === "hills") {
            color = "#8B4513";
            height = 0.2; // Hills are elevated
            roughness = 0.9;
            
            return (
              <group key={`${x}-${z}`} position={[x - size/2, 0, z - size/2]}>
                {/* Base hill shape */}
                <mesh 
                  position={[0, height/2, 0]}
                  receiveShadow
                  castShadow
                >
                  <boxGeometry args={[1, height, 1]} />
                  <meshStandardMaterial 
                    color={color} 
                    roughness={roughness} 
                    metalness={metalness}
                  />
                </mesh>
                
                {/* Resource indicator on top of hill if present */}
                {cell.resource && (
                  <mesh position={[0, height + 0.15, 0]}>
                    <cylinderGeometry args={[0.2, 0.25, 0.1, 8]} />
                    <meshStandardMaterial 
                      color={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"} 
                      emissive={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"}
                      emissiveIntensity={0.3}
                      roughness={0.3}
                      metalness={0.7}
                    />
                  </mesh>
                )}
              </group>
            );
          }
          
          // Default tile (grass)
          return (
            <group key={`${x}-${z}`} position={[x - size/2, height, z - size/2]}>
              <mesh 
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
              >
                <planeGeometry args={[1, 1, 2, 2]} />
                <meshStandardMaterial 
                  color={color} 
                  roughness={roughness} 
                  metalness={metalness}
                />
              </mesh>
              
              {/* Resource indicator */}
              {cell.resource && (
                <mesh position={[0, 0.15, 0]}>
                  <cylinderGeometry args={[0.2, 0.25, 0.1, 8]} />
                  <meshStandardMaterial 
                    color={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"} 
                    emissive={cell.resource.type === "food" ? "#FFD700" : "#A0A0A0"}
                    emissiveIntensity={0.3}
                    roughness={0.3}
                    metalness={0.7}
                  />
                </mesh>
              )}
            </group>
          );
        })
      )}
    </group>
  );
};

// Enhanced lighting setup component with atmospheric effects
const SceneLighting = () => {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const [time, setTime] = useState(0);
  
  // Create a day/night cycle effect
  useFrame((state, delta) => {
    // Update time - slow cycle for day/night
    setTime(prevTime => (prevTime + delta * 0.05) % 24);
  });
  
  // Calculate sun position based on time of day (0-24 hours)
  const sunPosition = useMemo(() => {
    // Make the sun move in an arc from east to west
    const angle = (time / 24) * Math.PI * 2;
    const height = Math.sin(angle) * 10;
    const horizontal = Math.cos(angle) * 15;
    
    return [horizontal, Math.max(1, height), 5] as [number, number, number];
  }, [time]);
  
  // Determine if it's night time (roughly 6PM to 6AM)
  const isNightTime = time > 18 || time < 6;
  
  // Calculate light intensities based on time of day
  const ambientIntensity = isNightTime ? 0.3 : 0.6;
  const directionalIntensity = isNightTime ? 0.2 : 0.8;
  
  // Sky inclination and azimuth based on time
  const skyInclination = Math.sin((time / 24) * Math.PI) * 0.5 + 0.5;
  const skyAzimuth = (time / 24) * 2;
  
  return (
    <>
      {/* Base ambient light - reduced at night */}
      <ambientLight intensity={ambientIntensity} color={isNightTime ? "#1a237e" : "#ffffff"} />
      
      {/* Main directional light (sun or moon) */}
      <directionalLight
        ref={directionalLightRef}
        position={sunPosition}
        intensity={directionalIntensity}
        color={isNightTime ? "#94a3f7" : "#fffaf0"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      {/* Add a secondary fill light for better visibility at night */}
      {isNightTime && (
        <hemisphereLight
          intensity={0.2}
          color="#94a3f7"
          groundColor="#000000"
        />
      )}
      
      {/* Dynamic sky that changes with time of day */}
      <Sky 
        distance={450000} 
        sunPosition={sunPosition} 
        inclination={skyInclination}
        azimuth={skyAzimuth}
        mieCoefficient={isNightTime ? 0.005 : 0.001}
        mieDirectionalG={isNightTime ? 0.7 : 0.8}
        rayleigh={isNightTime ? 1 : 0.5}
      />
      
      {/* Atmospheric fog - heavier at night */}
      <fog 
        attach="fog" 
        color={isNightTime ? "#0c1445" : "#f0f5ff"} 
        near={30} 
        far={isNightTime ? 50 : 100} 
      />
    </>
  );
};

// Main Game Scene Component
// Camera controller component with smooth transitions
const CameraController = ({ 
  target, 
  initialPosition, 
  mapSize 
}: { 
  target: [number, number, number];
  initialPosition: [number, number, number];
  mapSize: number;
}) => {
  const controlsRef = useRef<any>(null);
  const [cameraRotating, setCameraRotating] = useState(false);
  const [cameraMoving, setCameraMoving] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>(target);
  const [rotationAngle, setRotationAngle] = useState(0);
  
  // Handle camera rotation animation
  useFrame((state, delta) => {
    if (cameraRotating && controlsRef.current) {
      // Perform smooth rotation around target
      setRotationAngle(prev => {
        const newAngle = prev + delta * 0.5; // Adjust speed
        
        // Update camera position based on rotation
        const radius = mapSize * 0.8;
        const height = mapSize * 0.7;
        const x = Math.sin(newAngle) * radius + mapSize / 2;
        const z = Math.cos(newAngle) * radius + mapSize / 2;
        
        // Update controls target
        controlsRef.current.target.set(mapSize / 2, 0, mapSize / 2);
        
        return newAngle;
      });
    }
    
    if (cameraMoving && controlsRef.current) {
      // Smoothly interpolate camera target
      const currentTarget = controlsRef.current.target;
      currentTarget.x += (cameraTarget[0] - currentTarget.x) * 0.05;
      currentTarget.y += (cameraTarget[1] - currentTarget.y) * 0.05;
      currentTarget.z += (cameraTarget[2] - currentTarget.z) * 0.05;
      
      // Check if we've reached the target (close enough)
      const distanceSquared = 
        Math.pow(currentTarget.x - cameraTarget[0], 2) + 
        Math.pow(currentTarget.y - cameraTarget[1], 2) + 
        Math.pow(currentTarget.z - cameraTarget[2], 2);
      
      if (distanceSquared < 0.01) {
        setCameraMoving(false);
      }
    }
  });
  
  // Functions to trigger camera movements
  const rotateCameraAround = () => {
    setCameraRotating(prev => !prev);
  };
  
  const focusOnPosition = (x: number, y: number, z: number) => {
    setCameraTarget([x, y, z]);
    setCameraMoving(true);
  };
  
  // Effect to expose camera control methods globally
  useEffect(() => {
    // Expose camera controls to parent component via a global object
    (window as any).cameraControls = {
      rotateCameraAround,
      focusOnPosition,
      resetCamera: () => {
        if (controlsRef.current) {
          controlsRef.current.target.set(mapSize / 2, 0, mapSize / 2);
          setCameraRotating(false);
        }
      }
    };
    
    return () => {
      // Clean up global object
      (window as any).cameraControls = null;
    };
  }, [mapSize]);
  
  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        position={initialPosition} 
        fov={45}
      />
      <OrbitControls 
        ref={controlsRef}
        target={[mapSize / 2, 0, mapSize / 2]}
        maxPolarAngle={Math.PI / 2 - 0.1} // Prevent camera from going below ground
        minDistance={5}
        maxDistance={mapSize * 1.5}
        enableDamping
        dampingFactor={0.1}
      />
    </>
  );
};

// Main scene component
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
  
  // Map size calculation
  const mapSize = mapData.length;
  
  // Camera positioning
  const cameraPosition = useMemo<[number, number, number]>(() => {
    return [mapSize / 2, mapSize * 0.8, mapSize * 0.8];
  }, [mapSize]);
  
  // UI Controls for camera
  const [showCameraControls, setShowCameraControls] = useState(false);
  
  // Toggle camera control panel
  const toggleCameraControls = () => {
    setShowCameraControls(prev => !prev);
  };
  
  // Add camera control UI
  const handleRotateCameraClick = () => {
    if ((window as any).cameraControls) {
      (window as any).cameraControls.rotateCameraAround();
    }
  };
  
  const handleResetCameraClick = () => {
    if ((window as any).cameraControls) {
      (window as any).cameraControls.resetCamera();
    }
  };
  
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
      {/* Camera control UI overlay */}
      <div 
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}
      >
        <button 
          onClick={toggleCameraControls}
          style={{
            padding: "10px",
            backgroundColor: "#2a4d9e",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
          }}
        >
          Camera Controls
        </button>
        
        {showCameraControls && (
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.7)",
              padding: "15px",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}
          >
            <button
              onClick={handleRotateCameraClick}
              style={{
                padding: "8px 12px",
                backgroundColor: "#4287f5",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Orbit Camera
            </button>
            
            <button
              onClick={handleResetCameraClick}
              style={{
                padding: "8px 12px",
                backgroundColor: "#f54242",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Reset View
            </button>
          </div>
        )}
      </div>
      <Canvas shadows>
        {/* Enhanced camera control system */}
        <CameraController 
          target={[mapSize / 2, 0, mapSize / 2]} 
          initialPosition={cameraPosition}
          mapSize={mapSize}
        />
        
        {/* Environment & Lighting */}
        <SceneLighting />
        <Environment preset="sunset" />
        
        {/* Terrain */}
        <Terrain mapData={mapData} size={mapSize} />
        
        {/* Units with enhanced visuals */}
        {units.map((unit) => {
          // Dynamic unit elevation based on terrain type
          const terrainCell = mapData[unit.y] && mapData[unit.y][unit.x];
          let elevation = 0;
          
          if (terrainCell) {
            if (terrainCell.type === "water") elevation = -0.05;
            else if (terrainCell.type === "hills") elevation = 0.2;
            else if (terrainCell.type === "forest") elevation = 0.05;
          }
          
          return (
            <group
              key={unit.id}
              position={[unit.x - mapSize/2, elevation, unit.y - mapSize/2]}
              onClick={(e) => {
                e.stopPropagation();
                onUnitClick(unit.id);
              }}
            >
              {/* Add shadow blob under unit */}
              <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[0.4, 16]} />
                <meshBasicMaterial color="black" transparent opacity={0.3} />
              </mesh>
              
              {/* The unit model */}
              <ModelLoader 
                modelPath={getModelPathByType(unit.type, unit.faction)}
                scale={[0.5, 0.5, 0.5]}
                position={[0, 0.5, 0]} // Lifted slightly off ground
                animate={unit.selected} // Animate if selected
              />
              
              {/* Enhanced selection effect */}
              {unit.selected && (
                <>
                  {/* Bottom selection ring */}
                  <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.6, 0.7, 32]} />
                    <meshBasicMaterial 
                      color={unit.faction === "Nephites" ? "#4287f5" : "#f54242"} 
                      transparent 
                      opacity={0.8} 
                    />
                  </mesh>
                  
                  {/* Vertical selection beam effect */}
                  <mesh position={[0, 2, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 3, 8, 1, true]} />
                    <meshBasicMaterial 
                      color={unit.faction === "Nephites" ? "#4287f5" : "#f54242"} 
                      transparent 
                      opacity={0.3} 
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </>
              )}
            </group>
          );
        })}
        
        {/* Buildings with enhanced visuals */}
        {buildings.map((building) => {
          // Dynamic building elevation based on terrain type
          const terrainCell = mapData[building.y] && mapData[building.y][building.x];
          let elevation = 0;
          
          if (terrainCell) {
            if (terrainCell.type === "water") elevation = -0.1; // Buildings in water are partially submerged
            else if (terrainCell.type === "hills") elevation = 0.2; // Buildings on hills are elevated
            else if (terrainCell.type === "forest") elevation = 0.05; // Buildings in forest are slightly elevated
          }
          
          // Building size varies by type
          let buildingScale = 1;
          if (building.type === "cityCenter") buildingScale = 1.2;
          else if (building.type === "barracks") buildingScale = 0.9;
          else if (building.type === "archeryRange") buildingScale = 0.85;
          
          return (
            <group
              key={building.id}
              position={[building.x - mapSize/2, elevation, building.y - mapSize/2]}
              onClick={(e) => {
                e.stopPropagation();
                onUnitClick(building.id); // Handle building selection
              }}
            >
              {/* Add ground shadow effect beneath building */}
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[1.1, 24]} />
                <meshBasicMaterial color="black" transparent opacity={0.2} />
              </mesh>
              
              {/* The building model with faction-specific appearance */}
              <ModelLoader 
                modelPath={getModelPathByType(building.type, building.faction)}
                scale={[buildingScale, buildingScale, buildingScale]}
                position={[0, 0, 0]}
              />
              
              {/* Enhanced selection effects for selected buildings */}
              {building.selected && (
                <>
                  {/* Bottom selection ring */}
                  <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1.2, 1.3, 32]} />
                    <meshBasicMaterial 
                      color={building.faction === "Nephites" ? "#4287f5" : "#f54242"} 
                      transparent 
                      opacity={0.7} 
                    />
                  </mesh>
                  
                  {/* Building highlight effect - subtle glow */}
                  <pointLight 
                    position={[0, 1.5, 0]} 
                    color={building.faction === "Nephites" ? "#4287f5" : "#f54242"}
                    intensity={0.8}
                    distance={3}
                  />
                  
                  {/* Faction banner/flag indicator */}
                  <group position={[0.8, 1.0, 0.8]}>
                    {/* Flag pole */}
                    <mesh position={[0, 0.7, 0]}>
                      <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
                      <meshStandardMaterial color="#5c5c5c" />
                    </mesh>
                    
                    {/* Flag */}
                    <mesh position={[0.15, 1.2, 0]} rotation={[0, 0, Math.PI/20]}>
                      <planeGeometry args={[0.4, 0.25]} />
                      <meshStandardMaterial 
                        color={building.faction === "Nephites" ? "#2a4d9e" : "#8B0000"}
                        side={THREE.DoubleSide}
                      />
                    </mesh>
                  </group>
                </>
              )}
            </group>
          );
        })}
        
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