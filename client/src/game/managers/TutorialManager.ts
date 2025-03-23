import { Scene } from 'phaser';

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
    this.steps = [
      {
        id: 'welcome',
        message: 'Welcome to the Book of Mormon Wars! This tutorial will guide you through the basics of the game.',
        position: 'bottom',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'resources',
        message: 'These are your resources. You need food to train units and ore to build structures.',
        target: 'resources-display',
        position: 'bottom',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'select_worker',
        message: 'Click on a worker unit to select it. Workers gather resources and build structures.',
        target: 'worker-unit',
        position: 'right',
        completeCondition: () => {
          // Check if player has selected a worker unit
          const unitManager = (this.scene as any).unitManager;
          const selectedUnits = (this.scene as any).selectedUnits || [];
          if (!unitManager || selectedUnits.length === 0) return false;
          
          const selectedWorkers = selectedUnits.filter(id => {
            const unit = unitManager.getUnit(id);
            return unit && unit.type === 'worker';
          });
          
          return selectedWorkers.length > 0;
        },
        autoAdvance: true
      },
      {
        id: 'gather_resources',
        message: 'Now right-click on a resource (food or ore) to gather it. Workers will automatically collect and return resources.',
        target: 'resource-node',
        position: 'bottom',
        completeCondition: () => {
          // Check if any worker is gathering resources
          const unitManager = (this.scene as any).unitManager;
          if (!unitManager) return false;
          
          const units = unitManager.getAllUnits();
          const gatheringWorkers = units.filter(unit => 
            unit.type === 'worker' && unit.isGathering
          );
          
          return gatheringWorkers.length > 0;
        },
        autoAdvance: true
      },
      {
        id: 'build_structure',
        message: 'Select a worker, then click the "Build" button to create your first building. Buildings are used to train units and research technology.',
        target: 'build-button',
        position: 'right',
        completeCondition: () => {
          // Check if player has built at least one building
          const buildingManager = (this.scene as any).buildingManager;
          if (!buildingManager) return false;
          
          const playerBuildings = buildingManager.getBuildingsByPlayer((this.scene as any).localPlayerId);
          return playerBuildings.length > 0;
        },
        autoAdvance: true
      },
      {
        id: 'train_unit',
        message: 'Select your building and click "Train" to create a combat unit. Different buildings can create different unit types.',
        target: 'train-button',
        position: 'bottom',
        completeCondition: () => {
          // Check if player has trained at least one combat unit
          const unitManager = (this.scene as any).unitManager;
          if (!unitManager) return false;
          
          const playerUnits = unitManager.getUnitsByPlayer((this.scene as any).localPlayerId);
          const combatUnits = playerUnits.filter(unit => 
            unit.type !== 'worker'
          );
          
          return combatUnits.length > 0;
        },
        autoAdvance: true
      },
      {
        id: 'research',
        message: 'Click the "Tech Tree" button to open the technology panel. Research new technologies to unlock better units and buildings.',
        target: 'tech-tree-button',
        position: 'bottom',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'combat',
        message: 'Select your combat units and right-click on enemy units to attack them. Different unit types are effective against different enemies.',
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
        message: 'The minimap shows your position in the world. Click on it to quickly navigate to different areas.',
        target: 'minimap',
        position: 'left',
        actions: [
          {
            text: 'Continue',
            callback: () => this.nextStep()
          }
        ]
      },
      {
        id: 'completion',
        message: 'Congratulations! You\'ve completed the tutorial. Defeat all enemy buildings to win the game. Good luck!',
        position: 'bottom',
        actions: [
          {
            text: 'Start Playing',
            callback: () => this.endTutorial()
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
    if (this.tutorialActive) return;
    
    this.tutorialActive = true;
    this.currentStepIndex = -1;
    this.completionCallback = completionCallback || null;
    
    console.log("Tutorial started");
    
    // Start with the first step
    this.nextStep();
  }

  /**
   * Advance to the next tutorial step
   */
  nextStep() {
    // Clean up current step if necessary
    this.clearTooltip();
    
    // Advance to next step
    this.currentStepIndex++;
    
    if (this.currentStepIndex >= this.steps.length) {
      this.endTutorial();
      return;
    }
    
    const step = this.steps[this.currentStepIndex];
    console.log(`Tutorial step ${this.currentStepIndex + 1}/${this.steps.length}: ${step.id}`);
    
    // Show tooltip for this step
    this.showTooltip(step);
    
    // Set up auto-advance if needed
    if (step.autoAdvance && step.completeCondition) {
      const checkInterval = this.scene.time.addEvent({
        delay: 500,
        callback: () => {
          if (step.completeCondition && step.completeCondition()) {
            this.nextStep();
            checkInterval.remove();
          }
        },
        loop: true
      });
      
      // Store reference to remove if step is manually advanced
      this.stepCompletionListeners.set(step.id, () => checkInterval.remove());
    }
  }

  /**
   * Show tooltip for the current step
   */
  private showTooltip(step: TutorialStep) {
    // Create container for tooltip
    this.tooltipContainer = this.scene.add.container(0, 0);
    
    // Determine position based on target
    let x = this.scene.cameras.main.centerX;
    let y = this.scene.cameras.main.centerY;
    
    // If there's a target element, try to position near it
    if (step.target) {
      const targetObject = this.getTargetObject(step.target);
      if (targetObject) {
        const bounds = this.getTargetBounds(targetObject);
        
        // Position based on specified direction
        switch (step.position) {
          case 'top':
            x = bounds.centerX;
            y = bounds.top - 20;
            break;
          case 'bottom':
            x = bounds.centerX;
            y = bounds.bottom + 20;
            break;
          case 'left':
            x = bounds.left - 20;
            y = bounds.centerY;
            break;
          case 'right':
            x = bounds.right + 20;
            y = bounds.centerY;
            break;
          default:
            x = bounds.centerX;
            y = bounds.bottom + 20;
        }
        
        // Highlight the target
        this.highlightTarget(step.target);
      }
    }
    
    // Create tooltip background
    const tooltipWidth = 300;
    const tooltipHeight = 150;
    const tooltipBg = this.scene.add.rectangle(
      0, 0, 
      tooltipWidth, tooltipHeight, 
      0x000000, 0.8
    ).setStrokeStyle(2, 0xffff00);
    
    // Add message text
    this.tooltipText = this.scene.add.text(
      0, -30,
      step.message,
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: tooltipWidth - 40 }
      }
    ).setOrigin(0.5, 0.5);
    
    // Add action buttons if provided
    this.actionButtons = [];
    if (step.actions && step.actions.length > 0) {
      const buttonWidth = 100;
      const totalWidth = step.actions.length * buttonWidth + (step.actions.length - 1) * 10;
      const startX = -totalWidth / 2 + buttonWidth / 2;
      
      step.actions.forEach((action, index) => {
        const button = this.scene.add.text(
          startX + index * (buttonWidth + 10),
          tooltipHeight / 2 - 30,
          action.text,
          {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#4444aa',
            padding: { left: 10, right: 10, top: 5, bottom: 5 }
          }
        ).setOrigin(0.5, 0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', action.callback);
          
        this.actionButtons.push(button);
      });
    }
    
    // Add components to container
    this.tooltipContainer.add(tooltipBg);
    this.tooltipContainer.add(this.tooltipText);
    this.actionButtons.forEach(button => this.tooltipContainer.add(button));
    
    // Position the tooltip
    this.tooltipContainer.setPosition(x, y);
    
    // Ensure tooltip is on screen
    const camera = this.scene.cameras.main;
    const bounds = this.tooltipContainer.getBounds();
    
    if (bounds.left < camera.scrollX) {
      this.tooltipContainer.x += (camera.scrollX - bounds.left) + 20;
    } else if (bounds.right > camera.scrollX + camera.width) {
      this.tooltipContainer.x -= (bounds.right - (camera.scrollX + camera.width)) + 20;
    }
    
    if (bounds.top < camera.scrollY) {
      this.tooltipContainer.y += (camera.scrollY - bounds.top) + 20;
    } else if (bounds.bottom > camera.scrollY + camera.height) {
      this.tooltipContainer.y -= (bounds.bottom - (camera.scrollY + camera.height)) + 20;
    }
    
    // Add fancy animation
    this.scene.tweens.add({
      targets: this.tooltipContainer,
      scaleX: { from: 0.8, to: 1 },
      scaleY: { from: 0.8, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  /**
   * Position the tooltip based on the target and specified position
   */
  private positionTooltip(step: TutorialStep, tooltipBg: Phaser.GameObjects.Rectangle) {
    // This would handle more complex positioning based on the step and target
  }

  /**
   * Get the target game object by ID or reference
   */
  private getTargetObject(targetId: string): any {
    // For UI elements, this would need to be coordinated with the actual UI implementation
    // Here's a simplified version:
    switch (targetId) {
      case 'resources-display':
        // Find resource display object
        return this.scene.children.getByName('resources_panel');
      case 'minimap':
        return this.scene.children.getByName('minimap');
      case 'tech-tree-button':
        return this.scene.children.getByName('tech_button');
      case 'worker-unit':
        // Find a worker unit
        const unitManager = (this.scene as any).unitManager;
        if (unitManager) {
          const playerUnits = unitManager.getUnitsByPlayer((this.scene as any).localPlayerId);
          return playerUnits.find(unit => unit.type === 'worker');
        }
        return null;
      case 'resource-node':
        // Find a resource node
        const mapTiles = (this.scene as any).map;
        if (mapTiles && mapTiles.length > 0) {
          for (let y = 0; y < mapTiles.length; y++) {
            for (let x = 0; x < mapTiles[y].length; x++) {
              if (mapTiles[y][x].resource) {
                const resourceKey = `resource_${x}_${y}`;
                const resourceData = this.scene.registry.get(resourceKey);
                if (resourceData && resourceData.container) {
                  return resourceData.container;
                }
              }
            }
          }
        }
        return null;
      case 'build-button':
        return this.scene.children.getByName('build_button');
      case 'train-button':
        return this.scene.children.getByName('train_button');
      default:
        return null;
    }
  }

  /**
   * Get the bounds of a target object for positioning
   */
  private getTargetBounds(target: any): Phaser.Geom.Rectangle {
    if (!target) return new Phaser.Geom.Rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      10, 10
    );
    
    if (target.getBounds) {
      return target.getBounds();
    }
    
    // Fallback for objects without getBounds method
    return new Phaser.Geom.Rectangle(
      target.x - (target.width ? target.width / 2 : 25),
      target.y - (target.height ? target.height / 2 : 25),
      target.width || 50,
      target.height || 50
    );
  }

  /**
   * Highlight the target object
   */
  private highlightTarget(targetId: string) {
    const targetObject = this.getTargetObject(targetId);
    if (!targetObject) return;
    
    const bounds = this.getTargetBounds(targetObject);
    
    // Create highlight graphics
    this.highlightGraphics = this.scene.add.graphics();
    this.highlightGraphics.lineStyle(3, 0xffff00, 0.8);
    this.highlightGraphics.strokeRect(
      bounds.x - 5,
      bounds.y - 5,
      bounds.width + 10,
      bounds.height + 10
    );
    
    // Add pulsing animation
    const timeline = this.scene.tweens.createTimeline();
    
    timeline.add({
      targets: this.highlightGraphics,
      alpha: { from: 0.2, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    timeline.play();
  }

  /**
   * Clear the current tooltip and highlight
   */
  private clearTooltip() {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = null;
    }
    
    if (this.highlightGraphics) {
      this.highlightGraphics.destroy();
      this.highlightGraphics = null;
    }
    
    this.actionButtons = [];
    this.tooltipText = null;
    
    // Remove any auto-advance interval for the current step
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const stepId = this.steps[this.currentStepIndex].id;
      const cleanupListener = this.stepCompletionListeners.get(stepId);
      if (cleanupListener) {
        cleanupListener();
        this.stepCompletionListeners.delete(stepId);
      }
    }
  }

  /**
   * End the tutorial sequence
   */
  endTutorial() {
    this.clearTooltip();
    this.tutorialActive = false;
    this.currentStepIndex = -1;
    
    if (this.completionCallback) {
      this.completionCallback();
    }
    
    console.log("Tutorial completed");
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

  /**
   * Update the tutorial manager
   * @param delta Time since last update
   */
  update(delta: number): void {
    // Use this to implement any continuous updates needed for the tutorial
    // Such as checking for completion conditions
    
    // Currently no continuous updates needed as we use events and timers
  }
}