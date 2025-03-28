import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  OrbitControls, 
  PerspectiveCamera,
  OrthographicCamera, 
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
// Enhanced camera controller with additional RTS-friendly features
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
  const [useOrthographic, setUseOrthographic] = useState(false);
  
  // Camera boundary constraints - keep camera within the map boundaries
  const mapBounds = {
    minX: -mapSize * 0.1,
    maxX: mapSize * 1.1,
    minZ: -mapSize * 0.1,
    maxZ: mapSize * 1.1,
    minY: mapSize * 0.6, // Fixed height for RTS view
    maxY: mapSize * 0.6  // Fixed height for RTS view - same as min to lock
  };
  
  // Handle camera rotation animation and boundaries
  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    
    // Enforce camera boundaries
    const camera = state.camera;
    const target = controlsRef.current.target;
    
    // Clamp target position to map bounds
    target.x = Math.max(mapBounds.minX, Math.min(target.x, mapBounds.maxX));
    target.z = Math.max(mapBounds.minZ, Math.min(target.z, mapBounds.maxZ));
    target.y = Math.max(0, Math.min(target.y, 5)); // Limit vertical target to avoid awkward angles
    
    // Force camera to maintain fixed height - always reset to the specified height
    camera.position.y = mapBounds.minY; // Use minY which is equal to maxY for fixed height
    
    // Handle rotation animation
    if (cameraRotating) {
      // Perform smooth rotation around target
      setRotationAngle(prev => {
        const newAngle = prev + delta * 0.3; // Reduced speed for smoother rotation
        
        // Update camera position based on rotation
        const radius = mapSize * 0.8;
        const height = mapSize * 0.6;
        const x = Math.sin(newAngle) * radius + mapSize / 2;
        const z = Math.cos(newAngle) * radius + mapSize / 2;
        
        // Keep the target centered on the map
        controlsRef.current.target.set(mapSize / 2, 0, mapSize / 2);
        
        return newAngle;
      });
    }
    
    // Handle moving to a specific target
    if (cameraMoving) {
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
  
  // Toggle between perspective and orthographic cameras
  const toggleCameraType = () => {
    setUseOrthographic(prev => !prev);
  };
  
  // Top-down RTS view preset
  const setTopDownView = () => {
    if (controlsRef.current) {
      // Position camera directly above the center of the map
      const camera = controlsRef.current.object;
      const target = controlsRef.current.target;
      
      // Set target to map center
      target.set(mapSize / 2, 0, mapSize / 2);
      
      // Position camera above the map
      const height = mapSize * 0.7;
      camera.position.set(mapSize / 2, height, mapSize / 2);
      
      // Look straight down
      camera.lookAt(target);
      
      // Stop any ongoing rotation
      setCameraRotating(false);
    }
  };
  
  // Strategic angled view preset (classic RTS view)
  const setStrategicView = () => {
    if (controlsRef.current) {
      // Position camera at an angle commonly used in RTS games
      const camera = controlsRef.current.object;
      const target = controlsRef.current.target;
      
      // Set target to map center
      target.set(mapSize / 2, 0, mapSize / 2);
      
      // Position camera at a fixed strategic angle (behind and above)
      camera.position.set(mapSize / 2 - mapSize * 0.5, mapSize * 0.6, mapSize * 0.8);
      
      // Look at the center
      camera.lookAt(target);
      
      // Stop any ongoing rotation
      setCameraRotating(false);
      
      // Ensure rotation is disabled
      controlsRef.current.enableRotate = false;
    }
  };
  
  // Effect to expose camera control methods globally
  useEffect(() => {
    // Expose camera controls to parent component via a global object
    (window as any).cameraControls = {
      rotateCameraAround,
      focusOnPosition,
      toggleCameraType,
      setTopDownView,
      setStrategicView,
      resetCamera: () => {
        if (controlsRef.current) {
          // Reset target to center of map
          controlsRef.current.target.set(mapSize / 2, 0, mapSize / 2);
          
          // Reset to initial strategic position
          const camera = controlsRef.current.object;
          camera.position.set(mapSize / 2 - mapSize * 0.5, mapSize * 0.6, mapSize * 0.8);
          camera.lookAt(new THREE.Vector3(mapSize / 2, 0, mapSize / 2));
          
          // Ensure rotation is disabled
          controlsRef.current.enableRotate = false;
          
          // Stop any rotation animation
          setCameraRotating(false);
        }
      }
    };
    
    return () => {
      // Clean up global object
      (window as any).cameraControls = null;
    };
  }, [mapSize, useOrthographic]);
  
  return (
    <>
      {useOrthographic ? (
        // Orthographic camera for top-down strategic view without perspective distortion
        <OrthographicCamera
          makeDefault
          position={initialPosition}
          zoom={5}
          near={1}
          far={mapSize * 2}
          left={-mapSize / 2}
          right={mapSize / 2}
          top={mapSize / 2}
          bottom={-mapSize / 2}
        />
      ) : (
        // Perspective camera with moderate FOV for better depth perception
        <PerspectiveCamera 
          makeDefault 
          position={initialPosition} 
          fov={40} // Reduced FOV for less distortion
          near={1}
          far={mapSize * 2}
        />
      )}
      
      {/* Fixed RTS camera controls - only allowing panning, no rotation or zoom */}
      <OrbitControls 
        ref={controlsRef}
        target={[mapSize / 2, 0, mapSize / 2]}
        maxPolarAngle={Math.PI / 3} // Fixed angle for RTS view
        minPolarAngle={Math.PI / 3} // Same as max to lock the vertical angle
        enableRotate={false} // Disable rotation completely
        enableZoom={false} // Disable zoom functionality
        minDistance={mapSize * 0.6} // Fixed distance
        maxDistance={mapSize * 0.6} // Fixed distance
        enableDamping // Smooth movement
        dampingFactor={0.1}
        panSpeed={1.0} // Slightly increased pan speed
        screenSpacePanning={true} // More intuitive panning
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
  
  // Fixed camera positioning for a consistent RTS view
  const cameraPosition = useMemo<[number, number, number]>(() => {
    // Position camera at classic RTS angle (behind and above)
    return [mapSize / 2 - mapSize * 0.5, mapSize * 0.6, mapSize * 0.8];
  }, [mapSize]);
  
  // UI Controls for camera
  const [showCameraControls, setShowCameraControls] = useState(false);
  
  // Auto-set strategic view and center on main city when component loads
  useEffect(() => {
    // Give a small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      if ((window as any).cameraControls) {
        // Set strategic view first
        (window as any).cameraControls.setStrategicView();
        console.log("Initial strategic view set");
        
        // Find city center to focus camera on it
        const cityCenter = buildings.find(b => b.type === "cityCenter");
        if (cityCenter) {
          // Center the camera on the main city
          (window as any).cameraControls.focusOnPosition(cityCenter.x, 0, cityCenter.y);
          console.log("Camera centered on main city at position", cityCenter.x, cityCenter.y);
        } else {
          console.log("No city center found to focus camera on");
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [buildings]);
  
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
  
  const handleToggleCameraTypeClick = () => {
    if ((window as any).cameraControls) {
      (window as any).cameraControls.toggleCameraType();
    }
  };
  
  const handleTopDownViewClick = () => {
    if ((window as any).cameraControls) {
      (window as any).cameraControls.setTopDownView();
    }
  };
  
  const handleStrategicViewClick = () => {
    if ((window as any).cameraControls) {
      (window as any).cameraControls.setStrategicView();
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
          top: "80px", // Increased to avoid overlap with top bar
          right: "80px", // Increased to avoid overlap with toggle button
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
            {/* Camera type toggle */}
            <button
              onClick={handleToggleCameraTypeClick}
              style={{
                padding: "8px 12px",
                backgroundColor: "#4a9e2a",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Toggle Perspective/Ortho
            </button>
            
            {/* Camera view presets */}
            <div style={{ 
              display: "flex", 
              gap: "5px", 
              justifyContent: "space-between",
              marginBottom: "5px"
            }}>
              <button
                onClick={handleTopDownViewClick}
                style={{
                  padding: "8px 12px",
                  flex: 1,
                  backgroundColor: "#2a4d9e",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                Top-Down
              </button>
              
              <button
                onClick={handleStrategicViewClick}
                style={{
                  padding: "8px 12px",
                  flex: 1,
                  backgroundColor: "#2a4d9e",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                Strategic
              </button>
            </div>
            
            {/* Camera motion controls */}
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
            
            {/* Display camera hint */}
            <div style={{
              marginTop: "5px",
              padding: "5px",
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: "4px",
              fontSize: "0.8em",
              color: "#ddd"
            }}>
              <p>Tip: Hold right-click and drag to pan camera</p>
              <p>Camera height and angle are fixed for optimal RTS view</p>
              <p>Use strategic view for the best game experience</p>
            </div>
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