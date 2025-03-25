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
  
  playHit: () => {
    const { hitSound, isMuted } = get();
    if (hitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted } = get();
    if (successSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Success sound skipped (muted)");
        return;
      }
      
      successSound.currentTime = 0;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  },
  
  playCriticalHit: () => {
    const { criticalHitSound, isMuted } = get();
    if (criticalHitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Critical hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = criticalHitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.4; // Slightly louder than regular hits
      soundClone.play().catch(error => {
        console.log("Critical hit sound play prevented:", error);
      });
    } else {
      // Fallback to regular hit sound if critical hit sound is not set
      get().playHit();
    }
  },
  
  playCounterAttack: () => {
    const { counterAttackSound, isMuted } = get();
    if (counterAttackSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Counter attack sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = counterAttackSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.4;
      soundClone.play().catch(error => {
        console.log("Counter attack sound play prevented:", error);
      });
    } else {
      // Use critical hit sound as fallback 
      get().playCriticalHit();
    }
  },
  
  playWeaknessHit: () => {
    const { weaknessHitSound, isMuted } = get();
    if (weaknessHitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Weakness hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = weaknessHitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.play().catch(error => {
        console.log("Weakness hit sound play prevented:", error);
      });
    } else {
      // Fallback to regular hit sound if weakness hit sound is not set
      get().playHit();
    }
  },
  
  playDeath: (unitType = "default") => {
    const { deathSound, isMuted } = get();
    if (deathSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Death sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = deathSound.cloneNode() as HTMLAudioElement;
      
      // Different unit types could have different volumes
      let volume = 0.3;
      if (unitType === "hero") {
        volume = 0.5; // Hero deaths are more dramatic
      }
      
      soundClone.volume = volume;
      soundClone.play().catch(error => {
        console.log("Death sound play prevented:", error);
      });
    }
  }
}));
