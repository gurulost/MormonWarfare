import { Scene } from 'phaser';
import { TILE_SIZE } from '../config';

/**
 * Tutorial step interface
 */
export interface TutorialStep {
  id: string;
  message: string;
  target?: string; // UI element ID or game object to highlight
  completeCondition?: () => boolean; // Function to check if step is complete
  position?: 'top' | 'bottom' | 'left' | 'right'; // Position of tooltip
  actions?: Array<{
    text: string;
    callback: () => void;
  }>;
  autoAdvance?: boolean; // Whether to auto-advance when completeCondition is met
}

/**
 * Manages the in-game tutorial system
 */
export class TutorialManager {
  private scene: Scene;
  private steps: TutorialStep[] = [];
  private currentStepIndex: number = -1;
  private tutorialActive: boolean = false;
  private tooltipContainer: Phaser.GameObjects.Container | null = null;
  private tooltipText: Phaser.GameObjects.Text | null = null;
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private actionButtons: Phaser.GameObjects.Text[] = [];
  private completionCallback: (() => void) | null = null;
  private stepCompletionListeners: Map<string, () => void> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    this.initTutorialSteps();
  }

  /**
   * Initialize the tutorial steps sequence
   */
  private initTutorialSteps() {
    // Define tutorial steps based on the Book of Mormon War RTS game mechanics
    this.steps = [
      {
        id: 'welcome',
        message: 'Welcome to the Book of Mormon War RTS! This tutorial will guide you through the basic mechanics of the game.',
        position: 'bottom',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'cityCenter',
        message: 'This is your City Center. It is your main building for producing workers and storing resources.',
        target: 'cityCenter', // ID or reference to the city center object
        position: 'top',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'resources',
        message: 'You need resources to build your civilization. Look for food (green) and ore (gray) on the map.',
        position: 'top',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'trainWorker',
        message: 'Let\'s train a worker to gather resources. Click on your City Center, then select "Train Worker".',
        target: 'cityCenter',
        position: 'bottom',
        completeCondition: () => {
          // Check if at least one worker unit exists
          const workerCount = (this.scene as any).unitManager?.getUnitsByTypeAndPlayer(
            (this.scene as any).getLocalPlayerId(),
            'worker'
          ).length;
          return workerCount > 0;
        },
        autoAdvance: true
      },
      {
        id: 'selectWorker',
        message: 'Great! Now select your worker by clicking on it.',
        completeCondition: () => {
          // Check if a worker is selected
          const selectedUnits = (this.scene as any).getSelectedUnits();
          if (selectedUnits.length === 0) return false;
          
          const unitManager = (this.scene as any).unitManager;
          const unit = unitManager.getUnit(selectedUnits[0]);
          return unit && unit.type === 'worker';
        },
        autoAdvance: true
      },
      {
        id: 'gatherResources',
        message: 'Now, right-click on a nearby food (green) resource to gather it.',
        completeCondition: () => {
          // Check if any worker is gathering resources
          const unitManager = (this.scene as any).unitManager;
          const workers = unitManager.getUnitsByTypeAndPlayer(
            (this.scene as any).getLocalPlayerId(),
            'worker'
          );
          return workers.some(worker => worker.isGathering);
        },
        autoAdvance: true
      },
      {
        id: 'buildBarracks',
        message: 'Once you have enough resources, let\'s build a Barracks. Select a worker, then click the "Build Barracks" button.',
        completeCondition: () => {
          // Check if barracks exists
          const buildingManager = (this.scene as any).buildingManager;
          const barracks = buildingManager.getBuildingsByTypeAndPlayer(
            (this.scene as any).getLocalPlayerId(),
            'barracks'
          );
          return barracks.length > 0;
        },
        autoAdvance: true
      },
      {
        id: 'trainMelee',
        message: 'Now select your Barracks and train a Melee unit by clicking the "Train Melee" button.',
        completeCondition: () => {
          // Check if melee unit exists
          const unitManager = (this.scene as any).unitManager;
          const meleeUnits = unitManager.getUnitsByTypeAndPlayer(
            (this.scene as any).getLocalPlayerId(),
            'melee'
          );
          return meleeUnits.length > 0;
        },
        autoAdvance: true
      },
      {
        id: 'armyMovement',
        message: 'You can move your units by selecting them and right-clicking on the destination.',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'techTree',
        message: 'The Tech Tree allows you to research technologies to improve your civilization. Click the "Tech" button to see available technologies.',
        target: 'techButton',
        position: 'bottom',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'minimap',
        message: 'Use the minimap in the corner to navigate quickly around the battlefield.',
        target: 'minimap',
        position: 'right',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'tutorial-complete',
        message: 'Tutorial complete! You now know the basics of the Book of Mormon War RTS. Build your civilization, defeat your enemies, and conquer the promised land!',
        actions: [
          {
            text: 'Finish Tutorial',
            callback: () => {
              this.endTutorial();
              if (this.completionCallback) this.completionCallback();
            }
          }
        ]
      }
    ];
  }

  /**
   * Start the tutorial sequence
   * @param completionCallback Function to call when tutorial is completed
   */
  startTutorial(completionCallback?: () => void) {
    if (completionCallback) {
      this.completionCallback = completionCallback;
    }
    
    this.tutorialActive = true;
    this.currentStepIndex = -1;
    
    // Create tooltip container
    this.tooltipContainer = this.scene.add.container(0, 0);
    this.tooltipContainer.setDepth(1000); // Ensure it's on top of everything
    
    // Create highlight graphics
    this.highlightGraphics = this.scene.add.graphics();
    this.highlightGraphics.setDepth(999);
    
    // Show first step
    this.nextStep();
    
    // Save tutorial state to localStorage
    localStorage.setItem('tutorialStarted', 'true');
    
    console.log('Tutorial started');
  }

  /**
   * Advance to the next tutorial step
   */
  nextStep() {
    this.currentStepIndex++;
    
    // Check if we've reached the end
    if (this.currentStepIndex >= this.steps.length) {
      this.endTutorial();
      return;
    }
    
    const step = this.steps[this.currentStepIndex];
    
    // Clear previous tooltip and highlight
    this.clearTooltip();
    
    // Show new tooltip for this step
    this.showTooltip(step);
    
    // Set up completion listener if needed
    if (step.completeCondition && step.autoAdvance) {
      const checkCompletionInterval = setInterval(() => {
        if (step.completeCondition && step.completeCondition()) {
          clearInterval(checkCompletionInterval);
          setTimeout(() => this.nextStep(), 1000); // Short delay before advancing
        }
      }, 500);
      
      // Store the interval so we can clear it if needed
      this.stepCompletionListeners.set(step.id, () => clearInterval(checkCompletionInterval));
    }
    
    console.log(`Tutorial step: ${step.id}`);
  }

  /**
   * Show tooltip for the current step
   */
  private showTooltip(step: TutorialStep) {
    if (!this.tooltipContainer) return;
    
    // Create tooltip background
    const tooltipBg = this.scene.add.rectangle(0, 0, 400, 150, 0x000000, 0.8);
    tooltipBg.setStrokeStyle(2, 0xFFFFFF);
    tooltipBg.setOrigin(0);
    
    // Create tooltip text
    this.tooltipText = this.scene.add.text(20, 20, step.message, {
      fontSize: '16px',
      color: '#FFFFFF',
      wordWrap: { width: 360 }
    });
    
    // Add action buttons
    this.actionButtons = [];
    if (step.actions && step.actions.length > 0) {
      let buttonY = this.tooltipText.y + this.tooltipText.height + 20;
      
      step.actions.forEach((action, index) => {
        const buttonX = 200 + (index * 120);
        const button = this.scene.add.text(buttonX, buttonY, action.text, {
          fontSize: '16px',
          color: '#FFFFFF',
          backgroundColor: '#4A5568',
          padding: { x: 10, y: 5 }
        }).setInteractive();
        
        button.on('pointerdown', action.callback);
        button.on('pointerover', () => button.setTint(0xcccccc));
        button.on('pointerout', () => button.clearTint());
        
        this.actionButtons.push(button);
        this.tooltipContainer?.add(button);
      });
      
      // Adjust tooltip height based on content
      tooltipBg.height = buttonY + 40;
    }
    
    // Position the tooltip
    this.positionTooltip(step, tooltipBg);
    
    // Add to container
    this.tooltipContainer.add(tooltipBg);
    this.tooltipContainer.add(this.tooltipText);
    
    // Highlight target if specified
    if (step.target) {
      this.highlightTarget(step.target);
    }
  }

  /**
   * Position the tooltip based on the target and specified position
   */
  private positionTooltip(step: TutorialStep, tooltipBg: Phaser.GameObjects.Rectangle) {
    if (!this.tooltipContainer) return;
    
    let x = this.scene.cameras.main.width / 2 - 200;
    let y = this.scene.cameras.main.height / 2 - 75;
    
    // If there's a target, position relative to it
    if (step.target) {
      const targetObject = this.getTargetObject(step.target);
      
      if (targetObject) {
        const bounds = this.getTargetBounds(targetObject);
        
        // Position based on specified direction
        switch (step.position) {
          case 'top':
            x = bounds.centerX - 200;
            y = bounds.top - tooltipBg.height - 10;
            break;
          case 'bottom':
            x = bounds.centerX - 200;
            y = bounds.bottom + 10;
            break;
          case 'left':
            x = bounds.left - tooltipBg.width - 10;
            y = bounds.centerY - tooltipBg.height / 2;
            break;
          case 'right':
            x = bounds.right + 10;
            y = bounds.centerY - tooltipBg.height / 2;
            break;
        }
      }
    }
    
    // Ensure tooltip stays within screen bounds
    x = Math.max(10, Math.min(x, this.scene.cameras.main.width - tooltipBg.width - 10));
    y = Math.max(10, Math.min(y, this.scene.cameras.main.height - tooltipBg.height - 10));
    
    this.tooltipContainer.setPosition(x, y);
  }

  /**
   * Get the target game object by ID or reference
   */
  private getTargetObject(targetId: string): any {
    // Try to find the target by ID in various places
    
    // Check specific game elements based on ID
    switch (targetId) {
      case 'cityCenter':
        // Find the player's city center
        const buildings = (this.scene as any).buildingManager?.getBuildingsByTypeAndPlayer(
          (this.scene as any).getLocalPlayerId(),
          'cityCenter'
        );
        return buildings && buildings.length > 0 ? buildings[0] : null;
      
      case 'techButton':
        // Reference to the tech button in game UI
        return (this.scene as any).gameUI?.techButton;
        
      case 'minimap':
        // Reference to the minimap
        return (this.scene as any).minimap;
        
      default:
        // Try to find UI element by ID
        return document.getElementById(targetId);
    }
  }

  /**
   * Get the bounds of a target object for positioning
   */
  private getTargetBounds(target: any): Phaser.Geom.Rectangle {
    if (target instanceof Phaser.GameObjects.GameObject) {
      // For Phaser objects, get their world position
      const bounds = target.getBounds ? target.getBounds() : { x: 0, y: 0, width: 0, height: 0 };
      
      return new Phaser.Geom.Rectangle(
        bounds.x,
        bounds.y,
        bounds.width || 32,
        bounds.height || 32
      );
    } else if (target.x !== undefined && target.y !== undefined) {
      // For game entities like units/buildings with x,y coordinates
      return new Phaser.Geom.Rectangle(
        target.x - (TILE_SIZE / 2),
        target.y - (TILE_SIZE / 2),
        TILE_SIZE,
        TILE_SIZE
      );
    } else if (target instanceof HTMLElement) {
      // For DOM elements, convert their bounds to Phaser coordinate space
      const rect = target.getBoundingClientRect();
      
      return new Phaser.Geom.Rectangle(
        rect.left,
        rect.top,
        rect.width,
        rect.height
      );
    }
    
    // Default bounds in the center of the screen
    return new Phaser.Geom.Rectangle(
      this.scene.cameras.main.width / 2 - 50,
      this.scene.cameras.main.height / 2 - 50,
      100,
      100
    );
  }

  /**
   * Highlight the target object
   */
  private highlightTarget(targetId: string) {
    if (!this.highlightGraphics) return;
    
    const target = this.getTargetObject(targetId);
    if (!target) return;
    
    const bounds = this.getTargetBounds(target);
    
    // Clear previous highlight
    this.highlightGraphics.clear();
    
    // Draw pulsing highlight
    const pulseTimeline = this.scene.tweens.createTimeline();
    
    pulseTimeline.add({
      targets: { alpha: 0.2 },
      alpha: 0.8,
      duration: 500,
      onUpdate: (tween) => {
        const target = tween.targets[0];
        
        this.highlightGraphics?.clear();
        this.highlightGraphics?.lineStyle(3, 0xFFFF00, target.alpha);
        this.highlightGraphics?.strokeRoundedRect(
          bounds.x - 5,
          bounds.y - 5,
          bounds.width + 10,
          bounds.height + 10,
          8
        );
      },
      yoyo: true,
      repeat: -1
    });
    
    pulseTimeline.play();
  }

  /**
   * Clear the current tooltip and highlight
   */
  private clearTooltip() {
    if (this.tooltipContainer) {
      this.tooltipContainer.removeAll(true);
    }
    
    if (this.highlightGraphics) {
      this.highlightGraphics.clear();
    }
    
    this.actionButtons = [];
    this.tooltipText = null;
    
    // Clear any completion listeners for the current step
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const currentStepId = this.steps[this.currentStepIndex].id;
      const listener = this.stepCompletionListeners.get(currentStepId);
      if (listener) {
        listener();
        this.stepCompletionListeners.delete(currentStepId);
      }
    }
  }

  /**
   * End the tutorial sequence
   */
  endTutorial() {
    this.tutorialActive = false;
    
    // Clear UI elements
    this.clearTooltip();
    
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = null;
    }
    
    if (this.highlightGraphics) {
      this.highlightGraphics.destroy();
      this.highlightGraphics = null;
    }
    
    // Mark tutorial as completed
    localStorage.setItem('tutorialCompleted', 'true');
    
    console.log('Tutorial completed');
    
    // Call completion callback if exists
    if (this.completionCallback) {
      this.completionCallback();
    }
  }

  /**
   * Skip the tutorial
   */
  skipTutorial() {
    this.endTutorial();
  }

  /**
   * Check if the tutorial is currently active
   */
  isTutorialActive(): boolean {
    return this.tutorialActive;
  }

  /**
   * Check if tutorial has been completed before
   */
  static hasTutorialBeenCompleted(): boolean {
    return localStorage.getItem('tutorialCompleted') === 'true';
  }

  /**
   * Check if tutorial has been started before
   */
  static hasTutorialBeenStarted(): boolean {
    return localStorage.getItem('tutorialStarted') === 'true';
  }

  /**
   * Reset tutorial state (for testing)
   */
  static resetTutorialState() {
    localStorage.removeItem('tutorialCompleted');
    localStorage.removeItem('tutorialStarted');
  }
}