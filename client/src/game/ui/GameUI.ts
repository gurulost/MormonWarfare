import Phaser from "phaser";
import { ResourceManager } from "../managers/ResourceManager";
import { UnitManager } from "../managers/UnitManager";
import { BuildingManager } from "../managers/BuildingManager";
import { TechManager } from "../managers/TechManager";
import { UI_PANEL_HEIGHT, BUILDING_STATS } from "../config";

export class GameUI {
  private scene: Phaser.Scene;
  private resourceManager: ResourceManager;
  private unitManager: UnitManager;
  private buildingManager: BuildingManager;
  private techManager: TechManager;
  
  // UI elements
  private uiPanel!: Phaser.GameObjects.Rectangle;
  private resourceText!: Phaser.GameObjects.Text;
  private selectedUnitInfo!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private techButton!: Phaser.GameObjects.Text;
  private actionPanel!: Phaser.GameObjects.Container;
  private techPanel!: Phaser.GameObjects.Container;
  
  constructor(
    scene: Phaser.Scene,
    resourceManager: ResourceManager,
    unitManager: UnitManager,
    buildingManager: BuildingManager,
    techManager: TechManager
  ) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.unitManager = unitManager;
    this.buildingManager = buildingManager;
    this.techManager = techManager;
    
    this.createUI();
  }
  
  private createUI() {
    const { width, height } = this.scene.cameras.main;
    
    // Create UI panel background
    this.uiPanel = this.scene.add.rectangle(
      0, height - UI_PANEL_HEIGHT, 
      width, UI_PANEL_HEIGHT, 
      0x333333, 0.8
    )
      .setOrigin(0, 0)
      .setScrollFactor(0);
    
    // Create resource display
    this.resourceText = this.scene.add.text(
      10, height - UI_PANEL_HEIGHT + 10, 
      "Food: 0 | Ore: 0", 
      {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff"
      }
    )
      .setOrigin(0, 0)
      .setScrollFactor(0);
    
    // Create selected unit info panel
    this.selectedUnitInfo = this.scene.add.text(
      10, height - UI_PANEL_HEIGHT + 40, 
      "No units selected", 
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff"
      }
    )
      .setOrigin(0, 0)
      .setScrollFactor(0);
    
    // Create technology button
    this.techButton = this.scene.add.text(
      width - 150, height - UI_PANEL_HEIGHT + 10, 
      "TECHNOLOGIES", 
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#4a6c6f",
        padding: { x: 10, y: 5 }
      }
    )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.techButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.techButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => this.toggleTechPanel());
    
    // Create action panel (for buttons)
    this.actionPanel = this.scene.add.container(width / 2, height - UI_PANEL_HEIGHT / 2)
      .setScrollFactor(0);
    
    // Create tech panel (initially hidden)
    this.techPanel = this.scene.add.container(width / 2, height / 2)
      .setScrollFactor(0)
      .setVisible(false);
    this.createTechPanel();
    
    // Update resources
    this.updateResources();
  }
  
  updateResources() {
    const playerId = this.scene.registry.get("localPlayerId");
    const resources = this.resourceManager.getPlayerResources(playerId);
    
    this.resourceText.setText(`Food: ${resources.food} | Ore: ${resources.ore}`);
  }
  
  updateSelection(selectedUnitIds: string[]) {
    // Clear previous action buttons
    this.actionButtons.forEach(button => button.destroy());
    this.actionButtons = [];
    
    if (selectedUnitIds.length === 0) {
      this.selectedUnitInfo.setText("No units selected");
      return;
    }
    
    // Get the first selected unit to display info
    const firstUnitId = selectedUnitIds[0];
    const unit = this.unitManager.getUnit(firstUnitId);
    
    if (!unit) {
      this.selectedUnitInfo.setText("No units selected");
      return;
    }
    
    // Display unit info
    this.selectedUnitInfo.setText(`Selected: ${selectedUnitIds.length} ${unit.type} unit(s)\nHealth: ${unit.health}/${unit.maxHealth}`);
    
    // Create action buttons based on selection type
    if (unit.type === "worker") {
      this.createWorkerButtons();
    } else if (unit.type === "melee" || unit.type === "ranged") {
      this.createMilitaryButtons();
    }
  }
  
  createWorkerButtons() {
    const { width, height } = this.scene.cameras.main;
    const buttonY = height - UI_PANEL_HEIGHT / 2;
    let buttonX = width / 2 - 150;
    
    // Create "Build Barracks" button
    this.createActionButton(
      buttonX, buttonY, 
      "Build Barracks", 
      () => this.buildStructure("barracks")
    );
    
    // Create "Build Archery Range" button
    buttonX += 120;
    this.createActionButton(
      buttonX, buttonY, 
      "Build Archery Range", 
      () => this.buildStructure("archeryRange")
    );
    
    // Create "Build Wall" button
    buttonX += 120;
    const wallTech = this.techManager.isTechResearched("fortifications");
    this.createActionButton(
      buttonX, buttonY, 
      "Build Wall", 
      () => this.buildStructure("wall"),
      wallTech // Only enabled if fortifications tech is researched
    );
  }
  
  createMilitaryButtons() {
    // For military units, no special actions available yet
    // In a full implementation, this would include "Attack" or special abilities
  }
  
  createActionButton(
    x: number, 
    y: number, 
    text: string, 
    callback: () => void,
    enabled: boolean = true
  ) {
    const buttonContainer = this.scene.add.container(x, y)
      .setScrollFactor(0);
    
    // Button background
    const bg = this.scene.add.rectangle(0, 0, 100, 30, 0x4a6c6f)
      .setOrigin(0.5);
    
    // Button text
    const buttonText = this.scene.add.text(0, 0, text, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: enabled ? "#ffffff" : "#999999",
      align: "center"
    })
      .setOrigin(0.5);
    
    buttonContainer.add([bg, buttonText]);
    
    // Make interactive if enabled
    if (enabled) {
      bg.setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          bg.setFillStyle(0x5d8a8d);
          buttonText.setStyle({ color: "#ffff00" });
        })
        .on("pointerout", () => {
          bg.setFillStyle(0x4a6c6f);
          buttonText.setStyle({ color: "#ffffff" });
        })
        .on("pointerdown", callback);
    }
    
    this.actionButtons.push(buttonContainer);
    this.actionPanel.add(buttonContainer);
  }
  
  private buildStructure(type: string) {
    const playerId = this.scene.registry.get("localPlayerId");
    const selectedUnitIds = this.scene.registry.get("selectedUnits") || [];
    
    if (selectedUnitIds.length === 0) {
      console.warn("No units selected to build structure");
      return;
    }
    
    // Check resource costs
    const buildingCost = BUILDING_STATS[type as keyof typeof BUILDING_STATS].cost;
    if (!this.resourceManager.hasEnoughResources(playerId, buildingCost.food, buildingCost.ore)) {
      this.showMessage("Not enough resources to build " + type);
      return;
    }
    
    // Create overlay to select build location
    this.showBuildLocationSelector(type);
  }
  
  private showBuildLocationSelector(buildingType: string) {
    const playerId = this.scene.registry.get("localPlayerId");
    
    // Create instructions text
    const { width, height } = this.scene.cameras.main;
    const instructionsText = this.scene.add.text(
      width / 2, 50, 
      "Click to place building", 
      {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 10, y: 5 }
      }
    )
      .setOrigin(0.5)
      .setScrollFactor(0);
    
    // Get building size
    let buildingSize = 2;
    if (buildingType === "cityCenter") buildingSize = 3;
    else if (buildingType === "wall") buildingSize = 1;
    
    // Create preview building sprite
    const previewBuildingSize = buildingSize * 32;
    const previewBuilding = this.scene.add.rectangle(0, 0, previewBuildingSize, previewBuildingSize, 0x00ff00, 0.5)
      .setOrigin(0.5);
    
    // Follow mouse
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      previewBuilding.setPosition(
        Math.floor(worldPoint.x / 32) * 32 + 16, 
        Math.floor(worldPoint.y / 32) * 32 + 16
      );
    });
    
    // On click
    const clickHandler = (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      
      const tileX = Math.floor(pointer.worldX / 32);
      const tileY = Math.floor(pointer.worldY / 32);
      
      // Try to build the structure
      const resources = this.resourceManager.getBuildingCost(buildingType);
      if (this.resourceManager.deductResourcesForBuilding(playerId, buildingType)) {
        this.buildingManager.createBuilding(playerId, buildingType as any, tileX, tileY);
        
        // Update resources display
        this.updateResources();
      } else {
        this.showMessage("Failed to build - check resources or location");
      }
      
      // Clean up
      instructionsText.destroy();
      previewBuilding.destroy();
      this.scene.input.off("pointermove");
      this.scene.input.off("pointerdown", clickHandler);
    };
    
    this.scene.input.on("pointerdown", clickHandler);
  }
  
  private createTechPanel() {
    const { width, height } = this.scene.cameras.main;
    
    // Create background
    const techPanelBg = this.scene.add.rectangle(0, 0, 600, 400, 0x222222, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setOrigin(0.5);
    
    // Create title
    const techTitle = this.scene.add.text(0, -170, "TECHNOLOGIES", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      align: "center"
    })
      .setOrigin(0.5);
    
    // Create close button
    const closeButton = this.scene.add.text(270, -170, "X", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#aa3333",
      padding: { x: 8, y: 4 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toggleTechPanel());
    
    // Add to panel
    this.techPanel.add([techPanelBg, techTitle, closeButton]);
    
    // Will add tech items when panel is opened
  }
  
  private toggleTechPanel() {
    const visible = !this.techPanel.visible;
    this.techPanel.setVisible(visible);
    
    if (visible) {
      this.updateTechPanel();
    }
  }
  
  private updateTechPanel() {
    // Remove existing tech items
    const children = this.techPanel.getAll();
    for (let i = children.length - 1; i >= 3; i--) {
      // Keep the first 3 items (bg, title, close button)
      children[i].destroy();
    }
    
    // Get player's faction
    const playerId = this.scene.registry.get("localPlayerId");
    const players = this.scene.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    if (!player) return;
    
    // Get available technologies
    const techs = this.techManager.getResearchableTechs(playerId, player.faction);
    
    // Create tech items
    let yOffset = -100;
    techs.forEach((tech, index) => {
      const techItem = this.createTechItem(tech, 0, yOffset);
      this.techPanel.add(techItem);
      yOffset += 80;
    });
    
    // If no techs available
    if (techs.length === 0) {
      const noTechText = this.scene.add.text(0, 0, "No technologies available", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#aaaaaa",
        align: "center"
      })
        .setOrigin(0.5);
      
      this.techPanel.add(noTechText);
    }
  }
  
  private createTechItem(tech: any, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    // Tech background
    const bg = this.scene.add.rectangle(0, 0, 500, 70, 0x333333)
      .setStrokeStyle(1, 0x666666);
    
    // Tech name
    const nameText = this.scene.add.text(-230, -20, tech.name, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ffffff"
    })
      .setOrigin(0, 0);
    
    // Tech description
    const descText = this.scene.add.text(-230, 10, tech.description, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#cccccc"
    })
      .setOrigin(0, 0);
    
    // Cost text
    const costText = this.scene.add.text(200, -20, `Cost: ${tech.cost.food} Food, ${tech.cost.ore} Ore`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#aaaaaa"
    })
      .setOrigin(1, 0);
    
    // Research button
    const researchButton = this.scene.add.text(200, 15, "RESEARCH", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 10, y: 5 }
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => researchButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => researchButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => this.researchTech(tech.id));
    
    container.add([bg, nameText, descText, costText, researchButton]);
    return container;
  }
  
  private researchTech(techId: string) {
    const playerId = this.scene.registry.get("localPlayerId");
    
    if (this.techManager.researchTechnology(techId, playerId)) {
      this.updateResources();
      this.updateTechPanel();
      this.showMessage("Technology researched successfully!");
    } else {
      this.showMessage("Cannot research technology. Check resources.");
    }
  }
  
  showMessage(text: string, duration: number = 3000) {
    const { width, height } = this.scene.cameras.main;
    
    const message = this.scene.add.text(width / 2, height / 3, text, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 15, y: 10 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(999);
    
    // Fade out and destroy after duration
    this.scene.tweens.add({
      targets: message,
      alpha: 0,
      duration: 500,
      delay: duration - 500,
      onComplete: () => message.destroy()
    });
  }
}
