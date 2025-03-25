import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';

type CustomModelProps = {
  modelPath: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  faction?: 'Nephites' | 'Lamanites';
  isStealthed?: boolean;
  hasFaithShield?: boolean;
  animation?: string;
  onClick?: () => void;
};

/**
 * Component for loading and displaying custom GLB models for faction-specific units and buildings
 */
export const CustomModelLoader: React.FC<CustomModelProps> = ({
  modelPath,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  faction = 'Nephites',
  isStealthed = false,
  hasFaithShield = false,
  animation,
  onClick
}) => {
  const modelRef = useRef<THREE.Group>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [currentAction, setCurrentAction] = useState<THREE.AnimationAction | null>(null);
  
  // Preload the model
  useGLTF.preload(modelPath);
  
  // Load the model with useGLTF
  const { scene: originalScene, animations } = useGLTF(modelPath) as GLTF & {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };
  
  // Clone the scene to avoid modifying the cached original
  const model = originalScene.clone();
  
  // Effect for initial setup
  useEffect(() => {
    if (model && modelRef.current) {
      setModelLoaded(true);
      
      // Apply any material adjustments based on faction
      applyFactionColors(model, faction);
      
      // Apply effects for stealth or faith shield
      applySpecialEffects(model, isStealthed, hasFaithShield);
      
      // Set up animation mixer if animations exist
      if (animations.length > 0) {
        const newMixer = new THREE.AnimationMixer(model);
        setMixer(newMixer);
        
        // If animation is specified, play it
        if (animation) {
          const clip = animations.find(a => a.name === animation);
          if (clip) {
            const action = newMixer.clipAction(clip);
            action.play();
            setCurrentAction(action);
          }
        }
      }
      
      console.log(`Custom model loaded: ${modelPath}`);
    }
  }, [model, modelRef.current, faction, isStealthed, hasFaithShield, animation]);
  
  // Effect for handling animation changes
  useEffect(() => {
    if (mixer && animations.length > 0 && animation) {
      // Find the animation clip
      const clip = animations.find(a => a.name === animation);
      
      if (clip) {
        // Stop current animation if any
        if (currentAction) {
          currentAction.fadeOut(0.5);
        }
        
        // Play new animation with crossfade
        const newAction = mixer.clipAction(clip);
        newAction.reset().fadeIn(0.5).play();
        setCurrentAction(newAction);
      }
    }
  }, [animation, mixer]);
  
  // Effect for handling stealth changes
  useEffect(() => {
    if (modelLoaded) {
      applySpecialEffects(model, isStealthed, hasFaithShield);
    }
  }, [isStealthed, hasFaithShield]);
  
  // Update animations in the render loop
  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta);
    }
    
    // Add subtle floating movement for some models
    if (modelRef.current && modelPath.includes('stripling_warrior')) {
      // Add subtle breathing movement
      modelRef.current.position.y = position[1] + Math.sin(Date.now() * 0.002) * 0.05;
    }
    
    // Add rotation for scout models to simulate alertness
    if (modelRef.current && modelPath.includes('scout')) {
      // Slow rotation to simulate scanning surroundings
      modelRef.current.rotation.y += delta * 0.2;
    }
    
    // Add glow effect pulse for faith shield
    if (modelRef.current && hasFaithShield) {
      // Faith shield effect will be handled by material updates
    }
  });
  
  /**
   * Apply faction-specific colors to the model materials
   */
  const applyFactionColors = (model: THREE.Group, faction: string) => {
    if (faction === 'Nephites') {
      // Nephite colors - blue and gold
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Only adjust non-metallic materials to preserve gold/silver
          if (child.material instanceof THREE.MeshStandardMaterial && 
              child.material.metalness < 0.5) {
            // Apply blue tint to some materials
            child.material = child.material.clone();
            const hsl = { h: 0, s: 0, l: 0 };
            new THREE.Color(child.material.color).getHSL(hsl);
            
            // Shift toward blue if not already metallic
            if (hsl.s < 0.3) {
              child.material.color.setHSL(0.6, 0.5, hsl.l);
            }
          }
        }
      });
    } else if (faction === 'Lamanites') {
      // Lamanite colors - red and brown
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Only adjust non-metallic materials
          if (child.material instanceof THREE.MeshStandardMaterial && 
              child.material.metalness < 0.5) {
            // Apply red/brown tint
            child.material = child.material.clone();
            const hsl = { h: 0, s: 0, l: 0 };
            new THREE.Color(child.material.color).getHSL(hsl);
            
            // Shift toward red/brown if not already metallic
            if (hsl.s < 0.3) {
              child.material.color.setHSL(0.05, 0.7, hsl.l);
            }
          }
        }
      });
    }
  };
  
  /**
   * Apply visual effects for special unit abilities
   */
  const applySpecialEffects = (model: THREE.Group, isStealthed: boolean, hasFaithShield: boolean) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Handle stealth effect
        if (isStealthed) {
          if (child.material instanceof THREE.Material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.6;
          }
        } else {
          // Reset opacity if not stealthed
          if (child.material instanceof THREE.Material) {
            child.material.transparent = false;
            child.material.opacity = 1.0;
          }
        }
        
        // Handle faith shield effect
        if (hasFaithShield && child.material instanceof THREE.MeshStandardMaterial) {
          child.material = child.material.clone();
          // Add golden emission to simulate faith shield
          child.material.emissive.setHex(0xffcc00);
          // Pulsing emission in the animation frame
          child.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(Date.now() * 0.003);
        }
      }
    });
  };
  
  return (
    <group 
      ref={modelRef}
      position={position}
      rotation={rotation as any}
      scale={[scale, scale, scale]}
      onClick={onClick}
    >
      {modelLoaded ? (
        <primitive object={model} />
      ) : (
        // Fallback while loading
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={faction === 'Nephites' ? '#3366cc' : '#cc3300'} />
        </mesh>
      )}
    </group>
  );
};

export default CustomModelLoader;