import React, { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Interface for camera controller props
interface CameraControllerProps {
  mapSize: number;
  initialPosition?: [number, number, number];
  onCameraUpdate?: (position: THREE.Vector3, target: THREE.Vector3) => void;
}

/**
 * Enhanced camera controller specifically designed for RTS-style gameplay
 * Provides smooth transitions between camera views and consistent control mechanics
 */
export const CameraController: React.FC<CameraControllerProps> = ({
  mapSize,
  initialPosition = [0, 0, 0],
  onCameraUpdate
}) => {
  const controlsRef = useRef<any>(null);
  const [cameraRotating, setCameraRotating] = useState(false);
  const [cameraMoving, setCameraMoving] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([mapSize / 2, 0, mapSize / 2]);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [cameraMode, setCameraMode] = useState<"strategic" | "top-down" | "cinematic">("strategic");
  
  // Camera boundary constraints - keep camera within the map boundaries
  const mapBounds = {
    minX: -mapSize * 0.1,
    maxX: mapSize * 1.1,
    minZ: -mapSize * 0.1,
    maxZ: mapSize * 1.1,
    minY: mapSize * 0.5, // Minimum height to prevent getting too close to the terrain
    maxY: mapSize * 1.2  // Maximum height to prevent zooming out too far
  };
  
  // Default camera heights for different modes
  const cameraHeights = {
    strategic: mapSize * 0.6,
    topDown: mapSize * 0.8,
    cinematic: mapSize * 0.4
  };
  
  // Smooth damping factor for camera movements
  const CAMERA_DAMPING = 0.08;
  
  // Pan speed adjusted by map size
  const PAN_SPEED = mapSize * 0.005;
  
  // Handle camera movement, rotation, and boundaries
  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    
    const camera = state.camera;
    const target = controlsRef.current.target;
    
    // Store original positions for interpolation
    const originalCameraPos = camera.position.clone();
    const originalTarget = target.clone();
    
    // Clamp target position to map bounds
    target.x = Math.max(mapBounds.minX, Math.min(target.x, mapBounds.maxX));
    target.z = Math.max(mapBounds.minZ, Math.min(target.z, mapBounds.maxZ));
    
    // Handle different camera modes
    if (cameraMode === "strategic") {
      // Maintain the strategic view angle (45° approximately)
      const idealHeight = cameraHeights.strategic;
      camera.position.y += (idealHeight - camera.position.y) * CAMERA_DAMPING;
      
      // Keep a fixed angle relative to the ground
      controlsRef.current.maxPolarAngle = Math.PI / 3;
      controlsRef.current.minPolarAngle = Math.PI / 3;
    } 
    else if (cameraMode === "top-down") {
      // Position camera directly above the target point
      const idealHeight = cameraHeights.topDown;
      camera.position.y += (idealHeight - camera.position.y) * CAMERA_DAMPING;
      
      // Align camera to look straight down
      const idealX = target.x;
      const idealZ = target.z;
      camera.position.x += (idealX - camera.position.x) * CAMERA_DAMPING;
      camera.position.z += (idealZ - camera.position.z) * CAMERA_DAMPING;
      
      // Enforce strict top-down view
      controlsRef.current.maxPolarAngle = Math.PI / 20;
      controlsRef.current.minPolarAngle = 0;
    }
    else if (cameraMode === "cinematic") {
      // Cinematic view with lower angle
      const idealHeight = cameraHeights.cinematic;
      camera.position.y += (idealHeight - camera.position.y) * CAMERA_DAMPING;
      
      // More dramatic angle
      controlsRef.current.maxPolarAngle = Math.PI / 2.2;
      controlsRef.current.minPolarAngle = Math.PI / 4;
    }
    
    // Handle camera rotation animation
    if (cameraRotating) {
      setRotationAngle(prev => {
        const newAngle = prev + delta * 0.2;
        
        // Calculate position based on rotation
        const radius = mapSize * 0.7;
        const x = Math.sin(newAngle) * radius + mapSize / 2;
        const z = Math.cos(newAngle) * radius + mapSize / 2;
        
        // Smoothly update camera position
        camera.position.x += (x - camera.position.x) * CAMERA_DAMPING;
        camera.position.z += (z - camera.position.z) * CAMERA_DAMPING;
        
        // Keep target centered
        target.set(mapSize / 2, 0, mapSize / 2);
        
        return newAngle;
      });
    }
    
    // Handle moving to a specific target
    if (cameraMoving) {
      // Smoothly interpolate camera target with easing
      target.x += (cameraTarget[0] - target.x) * CAMERA_DAMPING;
      target.y += (cameraTarget[1] - target.y) * CAMERA_DAMPING;
      target.z += (cameraTarget[2] - target.z) * CAMERA_DAMPING;
      
      // Check if we've reached the target (close enough)
      const distanceSquared = 
        Math.pow(target.x - cameraTarget[0], 2) + 
        Math.pow(target.y - cameraTarget[1], 2) + 
        Math.pow(target.z - cameraTarget[2], 2);
      
      if (distanceSquared < 0.01) {
        setCameraMoving(false);
      }
    }
    
    // If camera or target has changed, notify parent component
    if (
      !originalCameraPos.equals(camera.position) ||
      !originalTarget.equals(target)
    ) {
      onCameraUpdate?.(camera.position, target);
    }
  });
  
  // API functions for external control
  const rotateCameraAround = () => {
    setCameraRotating(prev => !prev);
  };
  
  const focusOnPosition = (x: number, y: number, z: number) => {
    setCameraTarget([x, y, z]);
    setCameraMoving(true);
  };
  
  // Set different camera views based on game requirements
  const setStrategicView = () => {
    if (!controlsRef.current) return;
    
    setCameraMode("strategic");
    
    // Position camera at a strategic angle (common for RTS games)
    const camera = controlsRef.current.object;
    const target = controlsRef.current.target;
    
    // Set target to map center or maintain current focus
    target.set(target.x, 0, target.z);
    
    // Position camera at a fixed strategic angle
    const offset = mapSize * 0.5;
    const targetPos = new THREE.Vector3(
      target.x - offset, 
      cameraHeights.strategic, 
      target.z + offset
    );
    
    // Smoothly transition to new position - setting initial values
    // that will be smoothly interpolated in the useFrame hook
    camera.position.set(targetPos.x, targetPos.y, targetPos.z);
    
    // Stop any ongoing rotation
    setCameraRotating(false);
    
    // Disable rotation for strategic view
    controlsRef.current.enableRotate = false;
  };
  
  const setTopDownView = () => {
    if (!controlsRef.current) return;
    
    setCameraMode("top-down");
    
    const camera = controlsRef.current.object;
    const target = controlsRef.current.target;
    
    // Set camera directly above the target
    const idealPos = new THREE.Vector3(
      target.x,
      cameraHeights.topDown,
      target.z
    );
    
    // Set initial position - will be smoothly interpolated
    camera.position.set(idealPos.x, idealPos.y, idealPos.z);
    
    // Stop rotation
    setCameraRotating(false);
    
    // Allow rotation for top-down view if desired
    controlsRef.current.enableRotate = true;
  };
  
  const setCinematicView = () => {
    if (!controlsRef.current) return;
    
    setCameraMode("cinematic");
    
    // Enable rotation and set a more dramatic angle
    controlsRef.current.enableRotate = true;
    
    // Begin rotation for cinematic effect
    setCameraRotating(true);
  };
  
  // Calculate a good pan distance based on camera height
  const calculatePanDistance = () => {
    if (!controlsRef.current) return 1;
    
    const camera = controlsRef.current.object;
    // Pan speed increases with height
    return Math.max(1, camera.position.y * 0.02) * PAN_SPEED;
  };
  
  // Pan camera in a specific direction
  const panCamera = (direction: "left" | "right" | "up" | "down", amount = 1) => {
    if (!controlsRef.current) return;
    
    const target = controlsRef.current.target;
    const distance = calculatePanDistance() * amount;
    
    switch (direction) {
      case "left":
        target.x -= distance;
        break;
      case "right":
        target.x += distance;
        break;
      case "up":
        target.z -= distance;
        break;
      case "down":
        target.z += distance;
        break;
    }
  };
  
  // Smooth transition between modes
  const transitionToMode = (mode: "strategic" | "top-down" | "cinematic") => {
    setCameraMode(mode);
    
    switch (mode) {
      case "strategic":
        setStrategicView();
        break;
      case "top-down":
        setTopDownView();
        break;
      case "cinematic":
        setCinematicView();
        break;
    }
  };
  
  // Effect to expose camera control methods globally for integration
  // with the 2D game core
  useEffect(() => {
    // Create the camera API object
    const cameraAPI = {
      // Main view presets
      setStrategicView,
      setTopDownView,
      setCinematicView,
      
      // Camera movement controls
      focusOnPosition,
      panCamera,
      rotateCameraAround,
      
      // Mode transitions
      transitionToMode,
      
      // Get current camera state
      getCurrentMode: () => cameraMode,
      
      // Reset camera to default strategic position
      resetCamera: () => {
        if (controlsRef.current) {
          // Reset target to current position (don't jump)
          const target = controlsRef.current.target;
          
          // Reset to strategic view
          setStrategicView();
          
          // Stop any animations
          setCameraRotating(false);
          setCameraMoving(false);
        }
      }
    };
    
    // Expose API via window object for access from Phaser
    (window as any).cameraControls = cameraAPI;
    
    // Initialize with strategic view
    setStrategicView();
    
    // Cleanup
    return () => {
      (window as any).cameraControls = null;
    };
  }, [mapSize]);
  
  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        target={[mapSize / 2, 0, mapSize / 2]}
        // Set constraints based on camera mode - these will be dynamically updated
        maxPolarAngle={Math.PI / 3}
        minPolarAngle={Math.PI / 3}
        // Disable rotation initially for strategic view
        enableRotate={false}
        // Allow zooming but with constraints
        enableZoom={true}
        maxDistance={mapSize}
        minDistance={mapSize * 0.1}
        // Enable panning
        enablePan={true}
        // Make panning feel right for an RTS game
        screenSpacePanning={true}
        // Dampen movements for smooth camera
        dampingFactor={0.1}
        // Enable damping for smoother controls
        enableDamping={true}
      />
    </>
  );
};

export default CameraController;