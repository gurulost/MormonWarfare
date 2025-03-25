import { create } from 'zustand';
import { FactionType } from '../../game/types';
import { FACTION_BONUSES } from '../../game/config';
import { useAudio } from './useAudio';

export interface AbilityState {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  duration?: number;
  cooldownRemaining: number;
  durationRemaining?: number;
  isActive: boolean;
  inCooldown: boolean;
  unlocked: boolean;
}

interface FactionAbilityState {
  // Faction and abilities state
  currentFaction: FactionType | null;
  abilities: AbilityState[];
  
  // Actions
  setFaction: (faction: FactionType) => void;
  activateAbility: (id: string) => boolean;
  unlockAbility: (id: string) => void;
  resetAbilities: () => void;
  
  // Update function for game loop
  updateCooldowns: (deltaMs: number) => void;
}

export const useFactionAbilities = create<FactionAbilityState>((set, get) => ({
  currentFaction: null,
  abilities: [],
  
  // Set player's faction and initialize available abilities
  setFaction: (faction: FactionType) => {
    const factionConfig = FACTION_BONUSES[faction];
    if (!factionConfig || !factionConfig.abilities) return;
    
    // Convert config abilities to state
    const newAbilities: AbilityState[] = [];
    
    Object.entries(factionConfig.abilities).forEach(([id, ability]) => {
      newAbilities.push({
        id,
        name: ability.name,
        description: ability.description,
        cooldown: ability.cooldown,
        duration: ability.duration || undefined,
        cooldownRemaining: 0,
        durationRemaining: 0,
        isActive: false,
        inCooldown: false,
        unlocked: false // Initially locked, unlocked through tech tree
      });
    });
    
    set({
      currentFaction: faction,
      abilities: newAbilities
    });
    
    console.log(`Faction abilities initialized for ${faction}:`, newAbilities);
  },
  
  // Activate a faction ability (if available and not in cooldown)
  activateAbility: (id: string) => {
    const state = get();
    
    // Find the ability
    const abilityIndex = state.abilities.findIndex(a => a.id === id);
    if (abilityIndex === -1) return false;
    
    const ability = state.abilities[abilityIndex];
    
    // Check if ability can be activated
    if (!ability.unlocked || ability.inCooldown || ability.isActive) {
      console.log(`Cannot activate ability ${id}: ${!ability.unlocked ? 'not unlocked' : ability.inCooldown ? 'in cooldown' : 'already active'}`);
      return false;
    }
    
    // Clone the abilities array for immutability
    const updatedAbilities = [...state.abilities];
    
    // Update the ability state
    updatedAbilities[abilityIndex] = {
      ...ability,
      isActive: true,
      inCooldown: true,
      cooldownRemaining: ability.cooldown,
      durationRemaining: ability.duration || 0
    };
    
    // Play activation sound
    try {
      const audioStore = useAudio.getState();
      if (ability.id === 'titleOfLiberty' || ability.id === 'nephitePrayer') {
        audioStore.playSuccess();
      } else {
        audioStore.playCriticalHit(); // For Lamanite abilities
      }
    } catch (error) {
      console.error('Error playing ability activation sound:', error);
    }
    
    // Update state
    set({ abilities: updatedAbilities });
    
    console.log(`Activated faction ability: ${ability.name}`);
    
    // Display visual feedback
    const event = new CustomEvent('abilityActivated', {
      detail: { abilityId: id, abilityName: ability.name }
    });
    document.dispatchEvent(event);
    
    return true;
  },
  
  // Unlock an ability (typically triggered by tech research)
  unlockAbility: (id: string) => {
    const state = get();
    const abilityIndex = state.abilities.findIndex(a => a.id === id);
    
    if (abilityIndex === -1) return;
    
    const updatedAbilities = [...state.abilities];
    updatedAbilities[abilityIndex] = {
      ...updatedAbilities[abilityIndex],
      unlocked: true
    };
    
    set({ abilities: updatedAbilities });
    console.log(`Faction ability unlocked: ${updatedAbilities[abilityIndex].name}`);
  },
  
  // Reset all abilities (e.g., for a new game)
  resetAbilities: () => {
    set({
      currentFaction: null,
      abilities: []
    });
  },
  
  // Update function to be called during game loop
  updateCooldowns: (deltaMs: number) => {
    const state = get();
    let updated = false;
    
    const updatedAbilities = state.abilities.map(ability => {
      let newAbility = { ...ability };
      
      // Update duration if ability is active
      if (ability.isActive && ability.durationRemaining !== undefined) {
        newAbility.durationRemaining = Math.max(0, ability.durationRemaining - deltaMs);
        
        // Check if duration has expired
        if (newAbility.durationRemaining <= 0) {
          newAbility.isActive = false;
          console.log(`Faction ability '${ability.name}' duration ended`);
          updated = true;
        }
      }
      
      // Update cooldown if in cooldown
      if (ability.inCooldown) {
        newAbility.cooldownRemaining = Math.max(0, ability.cooldownRemaining - deltaMs);
        
        // Check if cooldown has expired
        if (newAbility.cooldownRemaining <= 0) {
          newAbility.inCooldown = false;
          console.log(`Faction ability '${ability.name}' cooldown ended`);
          updated = true;
        }
      }
      
      return newAbility;
    });
    
    // Only update state if changes occurred
    if (updated) {
      set({ abilities: updatedAbilities });
    }
  }
}));