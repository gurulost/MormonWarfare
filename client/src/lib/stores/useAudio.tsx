import { create } from "zustand";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  criticalHitSound: HTMLAudioElement | null;
  counterAttackSound: HTMLAudioElement | null;
  weaknessHitSound: HTMLAudioElement | null;
  deathSound: HTMLAudioElement | null;
  isMuted: boolean;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
  setCriticalHitSound: (sound: HTMLAudioElement) => void;
  setCounterAttackSound: (sound: HTMLAudioElement) => void;
  setWeaknessHitSound: (sound: HTMLAudioElement) => void;
  setDeathSound: (sound: HTMLAudioElement) => void;
  
  // Control functions
  toggleMute: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playCriticalHit: () => void;
  playCounterAttack: () => void;
  playWeaknessHit: () => void;
  playDeath: (unitType?: string) => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  criticalHitSound: null,
  counterAttackSound: null,
  weaknessHitSound: null,
  deathSound: null,
  isMuted: true, // Start muted by default
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  setCriticalHitSound: (sound) => set({ criticalHitSound: sound }),
  setCounterAttackSound: (sound) => set({ counterAttackSound: sound }),
  setWeaknessHitSound: (sound) => set({ weaknessHitSound: sound }),
  setDeathSound: (sound) => set({ deathSound: sound }),
  
  toggleMute: () => {
    const { isMuted } = get();
    const newMutedState = !isMuted;
    
    // Just update the muted state
    set({ isMuted: newMutedState });
    
    // Log the change
    console.log(`Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },
  
  /**
   * Play regular hit sound with enhanced error handling
   */
  playHit: () => {
    try {
      const { hitSound, isMuted } = get();
      
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }
      
      if (hitSound) {
        // Clone the sound to allow overlapping playback
        const soundClone = hitSound.cloneNode() as HTMLAudioElement;
        soundClone.volume = 0.3;
        
        // Add event listeners to handle errors
        soundClone.addEventListener('error', (e) => {
          console.error('Hit sound error:', e);
        });
        
        soundClone.play().catch(error => {
          console.log("Hit sound play prevented:", error);
        });
      }
    } catch (error) {
      console.error("Error playing hit sound:", error);
    }
  },
  
  /**
   * Play success sound with enhanced error handling
   */
  playSuccess: () => {
    try {
      const { successSound, isMuted } = get();
      
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Success sound skipped (muted)");
        return;
      }
      
      if (successSound) {
        // Reset playback position
        successSound.currentTime = 0;
        
        // Add event listeners to handle errors
        successSound.addEventListener('error', (e) => {
          console.error('Success sound error:', e);
        });
        
        successSound.play().catch(error => {
          console.log("Success sound play prevented:", error);
        });
      }
    } catch (error) {
      console.error("Error playing success sound:", error);
    }
  },
  
  /**
   * Play critical hit sound with enhanced error handling
   */
  playCriticalHit: () => {
    try {
      const { criticalHitSound, isMuted } = get();
      
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Critical hit sound skipped (muted)");
        return;
      }
      
      if (criticalHitSound) {
        // Clone the sound to allow overlapping playback
        const soundClone = criticalHitSound.cloneNode() as HTMLAudioElement;
        soundClone.volume = 0.4; // Slightly louder than regular hits
        
        // Add event listeners to handle errors
        soundClone.addEventListener('error', (e) => {
          console.error('Critical hit sound error:', e);
          // Fall back to hit sound
          get().playHit();
        });
        
        soundClone.play().catch(error => {
          console.log("Critical hit sound play prevented:", error);
          // Fall back to hit sound
          get().playHit();
        });
      } else {
        // Fallback to regular hit sound if critical hit sound is not set
        get().playHit();
      }
    } catch (error) {
      console.error("Error playing critical hit sound:", error);
    }
  },
  
  /**
   * Play counter attack sound with enhanced error handling
   */
  playCounterAttack: () => {
    try {
      const { counterAttackSound, isMuted } = get();
      
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Counter attack sound skipped (muted)");
        return;
      }
      
      if (counterAttackSound) {
        // Clone the sound to allow overlapping playback
        const soundClone = counterAttackSound.cloneNode() as HTMLAudioElement;
        soundClone.volume = 0.4;
        
        // Add event listeners to handle errors
        soundClone.addEventListener('error', (e) => {
          console.error('Counter attack sound error:', e);
          // Fall back to critical hit sound
          get().playCriticalHit();
        });
        
        soundClone.play().catch(error => {
          console.log("Counter attack sound play prevented:", error);
          // Fall back to critical hit sound
          get().playCriticalHit();
        });
      } else {
        // Use critical hit sound as fallback 
        get().playCriticalHit();
      }
    } catch (error) {
      console.error("Error playing counter attack sound:", error);
    }
  },
  
  /**
   * Play weakness hit sound with enhanced error handling
   */
  playWeaknessHit: () => {
    try {
      const { weaknessHitSound, isMuted } = get();
      
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Weakness hit sound skipped (muted)");
        return;
      }
      
      if (weaknessHitSound) {
        // Clone the sound to allow overlapping playback
        const soundClone = weaknessHitSound.cloneNode() as HTMLAudioElement;
        soundClone.volume = 0.3;
        
        // Add event listeners to handle errors
        soundClone.addEventListener('error', (e) => {
          console.error('Weakness hit sound error:', e);
          // Fall back to hit sound
          get().playHit();
        });
        
        soundClone.play().catch(error => {
          console.log("Weakness hit sound play prevented:", error);
          // Fall back to hit sound
          get().playHit();
        });
      } else {
        // Fallback to regular hit sound if weakness hit sound is not set
        get().playHit();
      }
    } catch (error) {
      console.error("Error playing weakness hit sound:", error);
    }
  },
  
  /**
   * Play death sound with enhanced error handling
   * Supports different unit types with different volumes
   */
  playDeath: (unitType = "default") => {
    try {
      const { deathSound, hitSound, isMuted } = get();
      
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Death sound skipped (muted)");
        return;
      }
      
      // Different unit types could have different volumes
      let volume = 0.3;
      if (unitType === "hero") {
        volume = 0.5; // Hero deaths are more dramatic
      }
      
      if (deathSound) {
        // Clone the sound to allow overlapping playback
        const soundClone = deathSound.cloneNode() as HTMLAudioElement;
        soundClone.volume = volume;
        
        // Add event listeners to handle errors
        soundClone.addEventListener('error', (e) => {
          console.error('Death sound error:', e);
          // Fall back to hit sound if available
          if (hitSound) {
            const fallbackClone = hitSound.cloneNode() as HTMLAudioElement;
            fallbackClone.volume = volume;
            fallbackClone.play().catch(e => console.log("Fallback hit sound prevented:", e));
          }
        });
        
        soundClone.play().catch(error => {
          console.log("Death sound play prevented:", error);
          // Fall back to hit sound if available
          if (hitSound) {
            const fallbackClone = hitSound.cloneNode() as HTMLAudioElement;
            fallbackClone.volume = volume;
            fallbackClone.play().catch(e => console.log("Fallback hit sound prevented:", e));
          }
        });
      } else if (hitSound) {
        // Fallback to regular hit sound if death sound is not set
        const fallbackClone = hitSound.cloneNode() as HTMLAudioElement;
        fallbackClone.volume = volume;
        fallbackClone.play().catch(e => console.log("Fallback hit sound prevented:", e));
      }
    } catch (error) {
      console.error("Error playing death sound:", error);
    }
  }
}));
