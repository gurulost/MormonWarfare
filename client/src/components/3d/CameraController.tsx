import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Camera settings for different view modes
 */
const CAMERA_PRESETS = {
  strategic: {
    position: [25, 20, 25], // Slight angle view
    fov: 45,
    near: 0.1,
    far: 1000,
    rotationSpeed: 0.005,
    zoomSpeed: 1.5,
    panSpeed: 1.0,
    minDistance: 5,
    maxDistance: 60,
    minPolarAngle: Math.PI / 8, // Prevent camera from going below ground
    maxPolarAngle: Math.PI / 2.5, // Limit how high the camera can go
  },
  overhead: {
    position: [25, 40, 25], // Direct top-down view
    fov: 50,
    near: 0.1,
    far: 1000,
    rotationSpeed: 0,
    zoomSpeed: 2,
    panSpeed: 1.5,
    minDistance: 10,
    maxDistance: 60,
    minPolarAngle: 0, // Allow full top-down
    maxPolarAngle: Math.PI / 8, // Very limited angle from vertical
  },
  cinematic: {
    position: [15, 5, 25], // Close-up, dramatic angle
    fov: 35,
    near: 0.1,
    far: 1000,
    rotationSpeed: 0.01,
    zoomSpeed: 1,
    panSpeed: 0.5,
    minDistance: 5,
    maxDistance: 30,
    minPolarAngle: Math.PI / 6,
    maxPolarAngle: Math.PI / 2,
  }
};

interface CameraControllerProps {
  initialViewMode?: 'strategic' | 'overhead' | 'cinematic';
  mapSize?: number;
  isTransitioning?: boolean;
}

/**
 * Enhanced Camera Controller for RTS game that provides various view modes
 * and smooth transitions between them. Exposes control methods through the window object
 * for external components to access.
 */
export const CameraController: React.FC<CameraControllerProps> = ({
  initialViewMode = 'strategic',
  mapSize = 50,
  isTransitioning = false
}) => {
  const { camera, scene, size } = useThree();
  const controlsRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'strategic' | 'overhead' | 'cinematic'>(initialViewMode);
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3>(new THREE.Vector3(mapSize / 2, 0, mapSize / 2));
  const [isRotating, setIsRotating] = useState(false);
  const [rotationCenter, setRotationCenter] = useState<THREE.Vector3>(new THREE.Vector3(mapSize / 2, 0, mapSize / 2));
  const [rotationAngle, setRotationAngle] = useState(0);
  const [previousMousePosition, setPreviousMousePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [rotationActive, setRotationActive] = useState(false);
  
  // Camera transitions
  const [isTransitioningCamera, setIsTransitioningCamera] = useState(false);
  const [transitionStartPosition, setTransitionStartPosition] = useState<THREE.Vector3 | null>(null);
  const [transitionEndPosition, setTransitionEndPosition] = useState<THREE.Vector3 | null>(null);
  const [transitionStartTime, setTransitionStartTime] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(1000); // ms
  
  // Apply camera preset based on view mode
  useEffect(() => {
    if (!controlsRef.current) return;
    
    const preset = CAMERA_PRESETS[viewMode];
    const controls = controlsRef.current;
    
    // Start a transition to the new position
    startCameraTransition(
      camera.position.clone(),
      new THREE.Vector3(preset.position[0], preset.position[1], preset.position[2]),
      1000
    );
    
    // Apply other control settings
    controls.minDistance = preset.minDistance;
    controls.maxDistance = preset.maxDistance;
    controls.minPolarAngle = preset.minPolarAngle;
    controls.maxPolarAngle = preset.maxPolarAngle;
    controls.rotateSpeed = preset.rotationSpeed;
    controls.zoomSpeed = preset.zoomSpeed;
    controls.panSpeed = preset.panSpeed;
    
    // Update camera properties - check if it's PerspectiveCamera (which has fov)
    if ('fov' in camera) {
      camera.fov = preset.fov;
      camera.near = preset.near;
      camera.far = preset.far;
      camera.updateProjectionMatrix();
    }
    
    if (viewMode === 'cinematic') {
      // In cinematic mode, we might want to adjust the target
      controls.target.set(mapSize / 2, 2, mapSize / 2);
    } else {
      // Otherwise use the default target
      controls.target.copy(targetPosition);
    }
    
    controls.update();
  }, [viewMode, camera, targetPosition, mapSize]);
  
  // Start a camera position transition
  const startCameraTransition = (
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    duration: number
  ) => {
    setTransitionStartPosition(startPos);
    setTransitionEndPosition(endPos);
    setTransitionStartTime(Date.now());
    setTransitionDuration(duration);
    setIsTransitioningCamera(true);
  };
  
  // Process camera transition in animation frame
  const updateCameraTransition = (time: number) => {
    if (!isTransitioningCamera || !transitionStartPosition || !transitionEndPosition) return;
    
    const elapsedTime = time - transitionStartTime;
    const progress = Math.min(elapsedTime / transitionDuration, 1);
    
    // Apply easing function for smooth transition (ease-in-out)
    const easedProgress = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // Interpolate camera position
    camera.position.lerpVectors(
      transitionStartPosition,
      transitionEndPosition,
      easedProgress
    );
    
    // When transition is complete
    if (progress >= 1) {
      setIsTransitioningCamera(false);
    }
  };
  
  // Expose camera control methods to other components via window object
  useEffect(() => {
    const cameraControls = {
      setStrategicView: () => setViewMode('strategic'),
      setTopDownView: () => setViewMode('overhead'),
      setCinematicView: () => setViewMode('cinematic'),
      toggleCameraType: () => {
        setViewMode(prev => {
          const modes = ['strategic', 'overhead', 'cinematic'] as const;
          const currentIndex = modes.indexOf(prev);
          const nextIndex = (currentIndex + 1) % modes.length;
          return modes[nextIndex];
        });
      },
      rotateCameraAround: () => {
        setIsRotating(prev => !prev);
        
        if (!isRotating) {
          // Start rotation around the current target
          setRotationCenter(
            controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3(mapSize / 2, 0, mapSize / 2)
          );
        }
      },
      focusOnPosition: (x: number, y: number, z: number) => {
        // Start a camera movement to focus on specific position
        if (controlsRef.current) {
          const newTarget = new THREE.Vector3(x, y, z);
          setTargetPosition(newTarget);
          
          // Smoothly transition the camera target
          const controls = controlsRef.current;
          const currentTarget = controls.target.clone();
          
          // Animate the target change
          let startTime = Date.now();
          const duration = 800; // ms
          
          const animateTarget = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Apply easing
            const easedProgress = progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // Update orbit controls target
            controls.target.lerpVectors(currentTarget, newTarget, easedProgress);
            controls.update();
            
            if (progress < 1) {
              requestAnimationFrame(animateTarget);
            }
          };
          
          animateTarget();
        }
      }
    };
    
    // Expose to window for external access
    (window as any).cameraControls = cameraControls;
    
    return () => {
      // Clean up when component unmounts
      delete (window as any).cameraControls;
    };
  }, [isRotating, mapSize]);
  
  // Handle rotating camera animation
  useFrame((state, delta) => {
    // Skip rendering during React transitions for performance
    if (isTransitioning) return;
    
    // Update any camera transition
    if (isTransitioningCamera) {
      updateCameraTransition(Date.now());
    }
    
    // Handle automatic rotation mode
    if (isRotating && controlsRef.current) {
      const controls = controlsRef.current;
      
      // Update rotation angle
      setRotationAngle(prev => prev + delta * 0.2);
      
      // Calculate new camera position in a circle around center
      const radius = camera.position.distanceTo(rotationCenter);
      const x = rotationCenter.x + radius * Math.cos(rotationAngle);
      const z = rotationCenter.z + radius * Math.sin(rotationAngle);
      
      // Update camera position
      camera.position.x = x;
      camera.position.z = z;
      
      // Ensure camera is looking at the target
      controls.update();
    }
  });
  
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[
          CAMERA_PRESETS[viewMode].position[0] as number,
          CAMERA_PRESETS[viewMode].position[1] as number,
          CAMERA_PRESETS[viewMode].position[2] as number
        ] as [number, number, number]}
        fov={CAMERA_PRESETS[viewMode].fov}
        near={CAMERA_PRESETS[viewMode].near}
        far={CAMERA_PRESETS[viewMode].far}
      />
      <OrbitControls
        ref={controlsRef}
        target={new THREE.Vector3(mapSize / 2, 0, mapSize / 2)}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={CAMERA_PRESETS[viewMode].rotationSpeed}
        zoomSpeed={CAMERA_PRESETS[viewMode].zoomSpeed}
        panSpeed={CAMERA_PRESETS[viewMode].panSpeed}
        minDistance={CAMERA_PRESETS[viewMode].minDistance}
        maxDistance={CAMERA_PRESETS[viewMode].maxDistance}
        minPolarAngle={CAMERA_PRESETS[viewMode].minPolarAngle}
        maxPolarAngle={CAMERA_PRESETS[viewMode].maxPolarAngle}
        enablePan={true}
        screenSpacePanning={true}
      />
    </>
  );
};

export default CameraController;