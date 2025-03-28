/**
 * PhaserEvents - A centralized event system for communication between Phaser and React
 * 
 * This EventTarget-based approach allows for loosely coupled communication
 * between the game's Phaser managers and the React UI components.
 * 
 * Instead of polling for changes, components can listen for specific events
 * and update only when necessary.
 */

// Define all event types as constants for consistency
export const EVENTS = {
  // Resource events
  RESOURCES_UPDATED: 'resources-updated',
  
  // Selection events
  UNITS_SELECTED: 'units-selected',
  BUILDING_SELECTED: 'building-selected',
  SELECTION_CLEARED: 'selection-cleared',
  
  // Entity events
  UNIT_CREATED: 'unit-created',
  UNIT_REMOVED: 'unit-removed',
  BUILDING_CREATED: 'building-created',
  BUILDING_REMOVED: 'building-removed',
  
  // Production events
  PRODUCTION_QUEUED: 'production-queued',
  PRODUCTION_COMPLETED: 'production-completed',
  PRODUCTION_CANCELLED: 'production-cancelled',
  
  // Tech events
  TECH_RESEARCHED: 'tech-researched',
  TECH_AVAILABLE: 'tech-available',
  
  // Camera events
  CAMERA_MOVED: 'camera-moved',
  
  // Game state events
  GAME_STARTED: 'game-started',
  GAME_ENDED: 'game-ended',
  
  // Ability events
  ABILITY_ACTIVATED: 'ability-activated',
  ABILITY_COMPLETED: 'ability-completed',
  
  // Building placement
  BUILDING_PLACEMENT_STARTED: 'building-placement-started',
  BUILDING_PLACEMENT_VALID: 'building-placement-valid',
  BUILDING_PLACEMENT_INVALID: 'building-placement-invalid',
  BUILDING_PLACEMENT_COMPLETED: 'building-placement-completed',
  BUILDING_PLACEMENT_CANCELLED: 'building-placement-cancelled',
} as const;

// Create a type from the event names for better type checking
export type PhaserEventType = typeof EVENTS[keyof typeof EVENTS];

// Create and export the event emitter
class PhaserEventEmitter extends EventTarget {
  /**
   * Emit an event with custom data
   * @param eventName The name of the event to emit
   * @param detail The data to include with the event
   */
  emit<T>(eventName: PhaserEventType, detail: T): void {
    const event = new CustomEvent(eventName, { detail });
    
    // Dispatch on both this object and the document for React components to catch
    this.dispatchEvent(event);
    document.dispatchEvent(event);
    
    console.log(`Event emitted: ${eventName}`, detail);
  }
  
  /**
   * Register an event listener
   * @param eventName The name of the event to listen for
   * @param callback The callback function to execute when the event is received
   */
  on<T>(eventName: PhaserEventType, callback: (data: T) => void): void {
    const wrappedCallback = (event: Event) => {
      const customEvent = event as CustomEvent;
      callback(customEvent.detail);
    };
    
    // Store the original callback and wrapped callback to use during removal
    (callback as any).__wrapped = wrappedCallback;
    
    this.addEventListener(eventName, wrappedCallback);
  }
  
  /**
   * Remove an event listener
   * @param eventName The name of the event to stop listening for
   * @param callback The callback function to remove
   */
  off<T>(eventName: PhaserEventType, callback: (data: T) => void): void {
    // Use the stored wrapped callback if available
    const wrappedCallback = (callback as any).__wrapped || callback;
    this.removeEventListener(eventName, wrappedCallback);
  }
}

// Create a singleton instance to be used throughout the application
export const phaserEvents = new PhaserEventEmitter();

// Export a type for our event listeners for better TypeScript support
export type PhaserEventCallback<T = any> = (event: CustomEvent<T>) => void;