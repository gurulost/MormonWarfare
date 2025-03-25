import React, { useRef, useEffect, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { 
  PerspectiveCamera,
  Environment, 
  Sky, 
  useHelper,
  Stats
} from "@react-three/drei";
import * as THREE from "three";
import { ModelLoader, getModelPathByType } from "./ModelLoader";
import CameraController from "./CameraController";

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

// Interface for the selection halo effect
interface SelectionHaloProps {
  position: [number, number, number];
  color?: string;
  pulseSpeed?: number;
  size?: number;
}

// A pulsing halo effect for selected units/buildings
const SelectionHalo: React.FC<SelectionHaloProps> = ({ 
  position,
  color = "#ffffff",
  pulseSpeed = 1.5,
  size = 1.0
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Create a pulsing effect
      const scale = 0.8 + Math.sin(clock.elapsedTime * pulseSpeed) * 0.2;
      meshRef.current.scale.set(scale, 1, scale);
      
      // Rotate the halo
      meshRef.current.rotation.y += 0.01;
    }
  });
  
  return (
    <mesh 
      ref={meshRef} 
      position={[position[0], position[1] + 0.05, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[size * 0.5, size * 0.6, 32]} />
      <meshBasicMaterial 
        color={color} 
        transparent={true} 
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Component for rendering a visually enhanced terrain with varying elevations and details
const Terrain = ({ mapData, size }: { mapData: any[][], size: number }) => {
  // Generate a noise-based height map for terrain variation
  const heightMap = useMemo(() => {
    const map = [];
    for (let z = 0; z < mapData.length; z++) {
      const row = [];
      for (let x = 0; x < mapData[z].length; x++) {
        // Add subtle variation to terrain height
        const noiseValue = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.05;
        row.push(noiseValue);
      }
      map.push(row);
    }
    return map;
  }, [mapData]);
  
  return (
    <group>
      {mapData.map((row, z) =>
        row.map((cell, x) => {
          const tileType = cell.type;
          let color = "#8BC34A"; // Default grass color
          let height = heightMap[z][x]; // Base height from noise map
          let roughness = 0.8;
          let metalness = 0.1;
          
          // Enhanced terrain visuals based on type
          if (tileType === "water") {
            color = "#64B5F6"; // Brighter blue for better visibility
            roughness = 0.1;
            metalness = 0.6;
            height = -0.15; // Water is below ground level
            
            return (
              <group key={`${x}-${z}`} position={[x - size/2, height, z - size/2]}>
                {/* Water surface with animated material */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[1.01, 1.01, 8, 8]} />
                  <meshStandardMaterial 
                    color={color} 
                    roughness={roughness} 
                    metalness={metalness}
                    transparent={true}
                    opacity={0.8}
                  />
                </mesh>
                
                {/* Underwater terrain */}
                <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[1, 1, 4, 4]} />
                  <meshStandardMaterial color="#1A237E" roughness={0.9} metalness={0.1} />
                </mesh>
                
                {/* Resource indicator if present */}
                {cell.resource && (
                  <mesh position={[0, 0.05, 0]}>
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
          else if (tileType === "forest") {
            color = "#2E7D32"; // Darker green for forests
            height += 0.05; // Forests are slightly elevated
            
            // Create decorations for forest tiles
            return (
              <group key={`${x}-${z}`} position={[x - size/2, height, z - size/2]}>
                {/* Base terrain tile */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[1, 1, 4, 4]} />
                  <meshStandardMaterial 
                    color={color} 
                    roughness={roughness} 
                    metalness={metalness}
                  />
                </mesh>
                
                {/* Forest decorations if no resource */}
                {!cell.resource && (
                  <group position={[0, 0.3, 0]}>
                    {/* Tree trunk */}
                    <mesh position={[0, 0.2, 0]} castShadow>
                      <cylinderGeometry args={[0.05, 0.07, 0.4, 8]} />
                      <meshStandardMaterial color="#5D4037" />
                    </mesh>
                    {/* Tree foliage */}
                    <mesh position={[0, 0.5, 0]} castShadow>
                      <coneGeometry args={[0.2, 0.5, 8]} />
                      <meshStandardMaterial color="#1B5E20" />
                    </mesh>
                  </group>
                )}
                
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
            color = "#795548"; // Brown for hills
            height += 0.2; // Hills are elevated
            roughness = 0.9;
            
            return (
              <group key={`${x}-${z}`} position={[x - size/2, 0, z - size/2]}>
                {/* Base hill shape */}
                <mesh position={[0, height/2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1, height, 1]} />
                  <meshStandardMaterial 
                    color={color} 
                    roughness={roughness} 
                    metalness={metalness}
                  />
                </mesh>
                
                {/* Resource indicator on hill */}
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
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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

// Clickable terrain component that handles interactions
const InteractiveTerrain = ({ 
  mapData, 
  size, 
  onTerrainClick 
}: { 
  mapData: any[][];
  size: number;
  onTerrainClick: (x: number, y: number) => void;
}) => {
  const handleClick = (event: any) => {
    // Stop event propagation
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    
    // Get intersection point in world coordinates
    let intersectionPoint = { x: 0, z: 0 };
    
    if (event.point) {
      intersectionPoint = event.point;
    } else if (event.intersections && event.intersections.length > 0) {
      // Use the first intersection point if available
      intersectionPoint = event.intersections[0].point;
    }
    
    // Convert to grid coordinates
    const gridX = Math.floor(intersectionPoint.x + size/2);
    const gridZ = Math.floor(intersectionPoint.z + size/2);
    
    // Check if within bounds
    if (gridX >= 0 && gridX < size && gridZ >= 0 && gridZ < size) {
      // Call the callback with grid coordinates
      onTerrainClick(gridX, gridZ);
    }
  };
  
  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.05, 0]} 
      receiveShadow
      onClick={handleClick}
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial visible={false} />
    </mesh>
  );
};

// Grid overlay for visual reference
const GridOverlay = ({ size, visible = true }: { size: number, visible?: boolean }) => {
  if (!visible) return null;
  
  return (
    <group position={[0, 0.01, 0]}>
      <gridHelper 
        args={[size, size, 0x888888, 0x444444]} 
        position={[0, 0, 0]} 
        rotation={[0, 0, 0]}
      />
    </group>
  );
};

// Post-processing effects manager
// Simplified version without requiring @react-three/postprocessing
const PostProcessingEffects = ({ enabled = true }) => {
  if (!enabled) return null;
  
  return (
    <>
      {/* Ambient occlusion approximation with a dark plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.05, 0]}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>
    </>
  );
};

// Visual transition effect between 2D and 3D views
const TransitionEffect = ({ 
  isTransitioning, 
  progress, 
  onComplete 
}: { 
  isTransitioning: boolean; 
  progress: number;
  onComplete: () => void;
}) => {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    if (isTransitioning && progress >= 1) {
      onComplete();
    }
  }, [isTransitioning, progress, onComplete]);
  
  return null;
};

// Main enhanced game scene component
export const EnhancedGameScene = ({ 
  mapData, 
  units, 
  buildings, 
  onUnitClick, 
  onTerrainClick,
  isTransitioning = false,
  onTransitionComplete = () => {}
}: { 
  mapData: any[][]; 
  units: SceneUnit[];
  buildings: SceneBuilding[];
  onUnitClick: (unitId: string) => void;
  onTerrainClick: (x: number, y: number) => void;
  isTransitioning?: boolean;
  onTransitionComplete?: () => void;
}) => {
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [showEffects, setShowEffects] = useState(true);
  const [enableGrid, setEnableGrid] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ type: string; id: string; } | null>(null);
  const [viewMode, setViewMode] = useState<'strategic' | 'overhead' | 'cinematic'>('strategic');
  
  // Calculate map size from data
  const mapSize = mapData.length;
  
  // Update transition progress
  useEffect(() => {
    if (isTransitioning) {
      let animationFrame: number;
      const animate = () => {
        setTransitionProgress(prev => {
          const newProgress = Math.min(prev + 0.05, 1);
          if (newProgress < 1) {
            animationFrame = requestAnimationFrame(animate);
          }
          return newProgress;
        });
      };
      
      animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    } else {
      setTransitionProgress(0);
    }
  }, [isTransitioning]);
  
  // Toggle grid visibility with the "G" key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "g" || e.key === "G") {
        setEnableGrid(prev => !prev);
      }
    };
    
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);
  
  return (
    <Canvas 
      shadows 
      gl={{ antialias: true }}
      style={{ 
        background: "#87CEEB" // Sky blue background
      }}
    >
      {/* Setup default camera - will be controlled by CameraController */}
      <PerspectiveCamera makeDefault position={[0, mapSize * 0.6, mapSize * 0.8]} fov={40} />
      
      {/* Enhanced camera controller */}
      <CameraController 
        mapSize={mapSize} 
      />
      
      {/* Dynamic lighting with day/night cycle */}
      <SceneLighting />
      
      {/* Terrain rendering with detailed visuals */}
      <Terrain mapData={mapData} size={mapSize} />
      
      {/* Units with 3D models */}
      {units.map(unit => {
        // Get terrain height at unit position
        let terrainCell = { type: "grass" };
        if (
          unit.x >= 0 && unit.x < mapData.length && 
          unit.y >= 0 && unit.y < mapData[0].length
        ) {
          terrainCell = mapData[unit.y][unit.x];
        }
        
        // Adjust elevation based on terrain type
        let elevation = 0;
        if (terrainCell.type === "water") elevation = -0.05; // Units in water are partially submerged
        else if (terrainCell.type === "hills") elevation = 0.2; // Units on hills are elevated
        else if (terrainCell.type === "forest") elevation = 0.05; // Units in forest are slightly elevated
        
        // Get model path based on unit type and faction
        const modelPath = getModelPathByType(unit.type, unit.faction);
        
        // Create scale and position based on unit type
        const scale: [number, number, number] = unit.type === "hero" ? [3.5, 3.5, 3.5] : [2.5, 2.5, 2.5];
        const position: [number, number, number] = [
          unit.x - mapSize/2, 
          elevation + 0.1,  // Slight offset to prevent Z-fighting
          unit.y - mapSize/2
        ];
        
        return (
          <group key={unit.id} onClick={(e) => {
            e.stopPropagation();
            onUnitClick(unit.id);
          }}
          onPointerOver={() => setHoverInfo({ type: unit.type, id: unit.id })}
          onPointerOut={() => setHoverInfo(null)}
          >
            {/* Unit model */}
            <ModelLoader
              modelPath={modelPath}
              position={position}
              scale={scale}
              rotation={[0, Math.PI, 0]} // Face forward
            />
            
            {/* Selection indicator for selected units */}
            {unit.selected && (
              <SelectionHalo 
                position={position} 
                color={unit.faction === "Nephites" ? "#4CAF50" : "#F44336"}
                size={unit.type === "hero" ? 1.4 : 1.0}
              />
            )}
          </group>
        );
      })}
      
      {/* Buildings with enhanced visuals */}
      {buildings.map(building => {
        // Get terrain height at building position
        let terrainCell = { type: "grass" };
        if (
          building.x >= 0 && building.x < mapData.length && 
          building.y >= 0 && building.y < mapData[0].length
        ) {
          terrainCell = mapData[building.y][building.x];
        }
        
        // Adjust elevation based on terrain type
        let elevation = 0;
        if (terrainCell.type === "water") elevation = -0.1; // Buildings in water are partially submerged
        else if (terrainCell.type === "hills") elevation = 0.2; // Buildings on hills are elevated
        else if (terrainCell.type === "forest") elevation = 0.05; // Buildings in forest are slightly elevated
        
        // Get model path based on building type and faction
        const modelPath = getModelPathByType(building.type, building.faction);
        
        // Building size varies by type
        let scale: [number, number, number] = [3, 3, 3];
        if (building.type === "cityCenter") {
          scale = [4, 4, 4];
        } else if (building.type === "wall") {
          scale = [3, 4, 3];
        }
        
        const position: [number, number, number] = [
          building.x - mapSize/2, 
          elevation,
          building.y - mapSize/2
        ];
        
        return (
          <group key={building.id} onClick={(e) => {
            e.stopPropagation();
            // Note: We could implement separate building click handler here
            // For now, we're just stopping propagation to prevent terrain click
          }}
          onPointerOver={() => setHoverInfo({ type: building.type, id: building.id })}
          onPointerOut={() => setHoverInfo(null)}
          >
            {/* Building model */}
            <ModelLoader
              modelPath={modelPath}
              position={position}
              scale={scale}
            />
            
            {/* Selection indicator for selected buildings */}
            {building.selected && (
              <>
                <SelectionHalo 
                  position={position} 
                  color={building.faction === "Nephites" ? "#4CAF50" : "#F44336"}
                  size={1.5}
                />
                
                {/* Building highlight effect - subtle glow */}
                <pointLight
                  position={[position[0], position[1] + 2, position[2]]}
                  intensity={1}
                  distance={4}
                  color={building.faction === "Nephites" ? "#4CAF50" : "#F44336"}
                />
              </>
            )}
          </group>
        );
      })}
      
      {/* Interactive terrain plane for click detection */}
      <InteractiveTerrain 
        mapData={mapData} 
        size={mapSize} 
        onTerrainClick={onTerrainClick} 
      />
      
      {/* Optional grid overlay */}
      <GridOverlay size={mapSize} visible={enableGrid} />
      
      {/* Post-processing effects */}
      <PostProcessingEffects enabled={showEffects} />
      
      {/* Visual transition effect */}
      <TransitionEffect 
        isTransitioning={isTransitioning}
        progress={transitionProgress}
        onComplete={onTransitionComplete}
      />
      
      {/* Performance stats - visible only in development */}
      {process.env.NODE_ENV === "development" && <Stats />}
    </Canvas>
  );
};

export default EnhancedGameScene;