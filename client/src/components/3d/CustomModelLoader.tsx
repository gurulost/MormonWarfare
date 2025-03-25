import React, { useRef, useEffect, useState, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTF } from "three-stdlib";

// Preload all custom models to avoid delays
useGLTF.preload('/models/stripling_warrior.glb');
useGLTF.preload('/models/lamanite_scout.glb');
useGLTF.preload('/models/nephite_temple.glb');
useGLTF.preload('/models/lamanite_tower.glb');

interface CustomModelProps {
  modelPath: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  color?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export const CustomModel: React.FC<CustomModelProps> = ({
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color,
  castShadow = true,
  receiveShadow = true,
}) => {
  const modelRef = useRef<THREE.Group>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Load the GLB model
  const { scene: customModel } = useGLTF(modelPath) as GLTF & {
    scene: THREE.Group
  };
  
  // Track loading state
  useEffect(() => {
    if (customModel) {
      setModelLoaded(true);
      console.log(`Custom model loaded successfully: ${modelPath}`);
    }
  }, [customModel, modelPath]);
  
  // Optional animation
  useFrame((state, delta) => {
    if (modelRef.current) {
      // You can add subtle animations or effects here if needed
      // For example, idle breathing or subtle movement
      // modelRef.current.rotation.y += delta * 0.1; // Slow rotation
    }
  });
  
  // Apply color to model materials if specified
  useEffect(() => {
    if (modelLoaded && customModel && color) {
      customModel.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material) {
          // Create a copy of the material to avoid affecting other instances
          node.material = node.material.clone();
          
          if (node.material instanceof THREE.MeshStandardMaterial) {
            node.material.color.set(color);
          }
        }
      });
    }
  }, [modelLoaded, customModel, color]);

  // Apply shadows to all meshes in the model
  useEffect(() => {
    if (modelLoaded && customModel) {
      customModel.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = castShadow;
          node.receiveShadow = receiveShadow;
        }
      });
    }
  }, [modelLoaded, customModel, castShadow, receiveShadow]);
  
  // Determine final scale as either uniform or non-uniform
  const finalScale = Array.isArray(scale) 
    ? scale 
    : [scale, scale, scale];
  
  return (
    <group 
      ref={modelRef} 
      position={new THREE.Vector3(...position)}
      rotation={new THREE.Euler(...rotation)}
      scale={new THREE.Vector3(...finalScale)}
    >
      {modelLoaded && customModel ? (
        <Suspense fallback={
          <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        }>
          <primitive object={customModel.clone()} castShadow={castShadow} receiveShadow={receiveShadow} />
        </Suspense>
      ) : (
        <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
};

// Helper function to get model path based on unit or building type
export function getModelPathByType(
  type: string, 
  faction: 'Nephites' | 'Lamanites'
): string {
  // Unit models
  if (type === 'striplingWarrior') {
    return '/models/stripling_warrior.glb';
  }
  
  if (type === 'lamaniteScout') {
    return '/models/lamanite_scout.glb';
  }
  
  // Building models
  if (type === 'nephiteTemple') {
    return '/models/nephite_temple.glb';
  }
  
  if (type === 'lamaniteTower') {
    return '/models/lamanite_tower.glb';
  }
  
  // Fallback to default models
  // We could add more conditionals here for regular units and buildings
  // based on faction, but for now we'll just use placeholders
  return '/models/placeholder.glb';
}

// Usage example:
// <CustomModel 
//   modelPath={getModelPathByType('striplingWarrior', 'Nephites')} 
//   position={[0, 0, 0]} 
//   scale={2.5} 
// />