import { useRef, useEffect, useState, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTF } from "three-stdlib";

export interface ModelLoaderProps {
  modelPath: string;
  scale?: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  animate?: boolean;
}

export function ModelLoader({
  modelPath,
  scale = [2.5, 2.5, 2.5],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  animate = false
}: ModelLoaderProps) {
  const modelRef = useRef<THREE.Group>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Preload the model
  useGLTF.preload(modelPath);

  // Load the model
  const { scene: model } = useGLTF(modelPath) as GLTF & {
    scene: THREE.Group
  };

  // Update loading state
  useEffect(() => {
    if (model) {
      setModelLoaded(true);
      console.log(`Model loaded successfully: ${modelPath}`);
    }
  }, [model, modelPath]);

  // Simple animation for the model
  useFrame((state, delta) => {
    if (modelRef.current && animate) {
      // Add a gentle floating animation
      modelRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.1;
      
      // Add subtle rotation if desired
      modelRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group ref={modelRef} position={position} rotation={rotation} scale={scale}>
      {modelLoaded && model ? (
        <Suspense fallback={
          <mesh castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        }>
          <primitive object={model.clone()} castShadow receiveShadow />
        </Suspense>
      ) : (
        <mesh castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
}

// Helper function for model mapping
export const getModelPathByType = (
  type: string, 
  faction: "Nephites" | "Lamanites" | null = null
): string => {
  // Unit models
  if (type === "melee") {
    return faction === "Nephites" 
      ? "/models/nephite_warrior.glb" 
      : "/models/lamanite_warrior.glb";
  }
  
  if (type === "ranged") {
    return faction === "Nephites" 
      ? "/models/nephite_archer.glb" 
      : "/models/lamanite_warrior.glb"; // Fallback to warrior for now
  }
  
  if (type === "worker") {
    return "/models/worker.glb";
  }
  
  // Building models
  if (type === "cityCenter") {
    return faction === "Nephites" 
      ? "/models/nephite_city_center.glb" 
      : "/models/lamanite_city_center.glb";
  }
  
  // Fallback to a default model
  return "/models/worker.glb";
};