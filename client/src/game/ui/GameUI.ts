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
  
  // Production queue container for displaying building production
  private productionQueueContainer: Phaser.GameObjects.Container | null = null;
  private selectedBuilding: any | null = null;
  
  updateSelection(selectedUnitIds: string[], selectedBuildingId?: string) {
    // Clear previous action buttons and UI elements
    this.actionButtons.forEach(button => button.destroy());
    this.actionButtons = [];
    
    // Clear production queue display if it exists
    if (this.productionQueueContainer) {
      this.productionQueueContainer.destroy();
      this.productionQueueContainer = null;
    }
    
    this.selectedBuilding = null;
    
    // First check if a building is selected
    if (selectedBuildingId) {
      const building = this.buildingManager.getBuilding(selectedBuildingId);
      if (building) {
        this.displayBuildingInfo(building);
        return;
      }
    }
    
    // If no building is selected, process unit selection
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
  
  /**
   * Display information about a selected building and its production queue
   */
  private displayBuildingInfo(building: any) {
    this.selectedBuilding = building;
    
    // Set building info text
    this.selectedUnitInfo.setText(
      `Selected: ${this.getBuildingDisplayName(building.type)}\n` +
      `Health: ${building.health}/${building.maxHealth}\n` +
      `Owner: ${this.getPlayerName(building.playerId)}`
    );
    
    // Create buttons based on building type
    if (building.type === "cityCenter") {
      this.createTrainWorkerButton();
    } else if (building.type === "barracks") {
      this.createTrainMeleeButton();
    } else if (building.type === "archeryRange") {
      this.createTrainRangedButton();
    }
    
    // Create production queue display
    this.createProductionQueueDisplay(building);
  }
  
  /**
   * Get a user-friendly name for building types
   */
  private getBuildingDisplayName(type: string): string {
    switch (type) {
      case "cityCenter": return "City Center";
      case "barracks": return "Barracks";
      case "archeryRange": return "Archery Range";
      case "wall": return "Wall";
      default: return type;
    }
  }
  
  /**
   * Get player name by ID
   */
  private getPlayerName(playerId: string): string {
    const players = this.scene.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    return player ? player.username : "Unknown";
  }
  
  /**
   * Create a visual display of the building's production queue
   */
  private createProductionQueueDisplay(building: any) {
    const { width, height } = this.scene.cameras.main;
    
    // Create container for production queue elements
    this.productionQueueContainer = this.scene.add.container(width - 200, height - UI_PANEL_HEIGHT / 2)
      .setScrollFactor(0);
    
    // Get production queue
    const queue = building.getProductionQueue();
    const progress = building.getProductionProgress();
    
    // Create background for production panel
    const bg = this.scene.add.rectangle(0, 0, 180, 100, 0x333333, 0.8)
      .setStrokeStyle(1, 0xffffff, 0.5);
    
    // Create title
    const title = this.scene.add.text(0, -40, "Production Queue", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    
    this.productionQueueContainer.add([bg, title]);
    
    // No items in queue
    if (queue.length === 0) {
      const emptyText = this.scene.add.text(0, 0, "Nothing in production", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#aaaaaa",
        align: "center"
      }).setOrigin(0.5);
      
      this.productionQueueContainer.add(emptyText);
      return;
    }
    
    // Create an entry for the currently producing item with progress bar
    const currentItem = queue[0];
    const currentItemText = this.scene.add.text(-80, -20, this.getUnitDisplayName(currentItem.type), {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0, 0.5);
    
    // Progress bar background
    const progressBarBg = this.scene.add.rectangle(0, 0, 150, 12, 0x666666);
    
    // Progress bar fill
    const progressBarFill = this.scene.add.rectangle(-75, 0, 150 * progress, 12, 0x00aaff)
      .setOrigin(0, 0.5);
    
    // Percentage text
    const percentText = this.scene.add.text(75, 0, `${Math.floor(progress * 100)}%`, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(1, 0.5);
    
    this.productionQueueContainer.add([currentItemText, progressBarBg, progressBarFill, percentText]);
    
    // Add remaining queue items (limited to showing 3 for space)
    const queueToShow = queue.slice(1, 4);
    queueToShow.forEach((item: any, index: number) => {
      const y = 20 + index * 20;
      
      // Item name
      const itemText = this.scene.add.text(-80, y, `${index + 1}. ${this.getUnitDisplayName(item.type)}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#cccccc"
      }).setOrigin(0, 0.5);
      
      // Cancel button
      const cancelBtn = this.scene.add.text(70, y, "X", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ff6666",
        backgroundColor: "#553333",
        padding: { x: 5, y: 2 }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          // Cancel this production item
          if (this.selectedBuilding) {
            this.buildingManager.cancelUnitProduction(this.selectedBuilding.id, index + 1);
            
            // Refresh display
            this.displayBuildingInfo(this.selectedBuilding);
          }
        });
      
      this.productionQueueContainer.add([itemText, cancelBtn]);
    });
    
    // If there are more items than shown
    if (queue.length > 4) {
      const moreText = this.scene.add.text(0, 80, `+${queue.length - 4} more`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#aaaaaa"
      }).setOrigin(0.5);
      
      this.productionQueueContainer.add(moreText);
    }
  }
  
  /**
   * Get a user-friendly name for unit types
   */
  private getUnitDisplayName(type: string): string {
    switch (type) {
      case "worker": return "Worker";
      case "melee": return "Warrior";
      case "ranged": return "Archer";
      case "hero": return "Hero";
      default: return type;
    }
  }
  
  /**
   * Create button to train worker units
   */
  private createTrainWorkerButton() {
    const { width, height } = this.scene.cameras.main;
    const buttonX = width / 2 - 50;
    const buttonY = height - UI_PANEL_HEIGHT / 2;
    
    // Check if local player owns this building
    const playerId = this.scene.registry.get("localPlayerId");
    
    if (this.selectedBuilding && this.selectedBuilding.playerId === playerId) {
      // Get cost
      const unitCost = this.resourceManager.getUnitCost("worker");
      const cost = `(F:${unitCost.food}/O:${unitCost.ore})`;
      
      // Check if player has resources
      const canAfford = this.resourceManager.hasEnoughResources(playerId, unitCost.food, unitCost.ore);
      
      this.createActionButton(
        buttonX, buttonY,
        `Train Worker ${cost}`,
        () => {
          if (this.selectedBuilding) {
            // Deduct resources
            if (this.resourceManager.deductResourcesForUnit(playerId, "worker")) {
              // Add to production queue
              this.buildingManager.queueUnitProduction(this.selectedBuilding.id, "worker");
              
              // Update resources
              this.updateResources();
              
              // Refresh building info
              this.displayBuildingInfo(this.selectedBuilding);
            } else {
              this.showMessage("Not enough resources");
            }
          }
        },
        canAfford
      );
    }
  }
  
  /**
   * Create button to train melee units
   */
  private createTrainMeleeButton() {
    const { width, height } = this.scene.cameras.main;
    const buttonX = width / 2 - 50;
    const buttonY = height - UI_PANEL_HEIGHT / 2;
    
    // Check if local player owns this building
    const playerId = this.scene.registry.get("localPlayerId");
    
    if (this.selectedBuilding && this.selectedBuilding.playerId === playerId) {
      // Get cost
      const unitCost = this.resourceManager.getUnitCost("melee");
      const cost = `(F:${unitCost.food}/O:${unitCost.ore})`;
      
      // Check if player has resources
      const canAfford = this.resourceManager.hasEnoughResources(playerId, unitCost.food, unitCost.ore);
      
      this.createActionButton(
        buttonX, buttonY,
        `Train Warrior ${cost}`,
        () => {
          if (this.selectedBuilding) {
            // Deduct resources
            if (this.resourceManager.deductResourcesForUnit(playerId, "melee")) {
              // Add to production queue
              this.buildingManager.queueUnitProduction(this.selectedBuilding.id, "melee");
              
              // Update resources
              this.updateResources();
              
              // Refresh building info
              this.displayBuildingInfo(this.selectedBuilding);
            } else {
              this.showMessage("Not enough resources");
            }
          }
        },
        canAfford
      );
    }
  }
  
  /**
   * Create button to train ranged units
   */
  private createTrainRangedButton() {
    const { width, height } = this.scene.cameras.main;
    const buttonX = width / 2 - 50;
    const buttonY = height - UI_PANEL_HEIGHT / 2;
    
    // Check if local player owns this building
    const playerId = this.scene.registry.get("localPlayerId");
    
    if (this.selectedBuilding && this.selectedBuilding.playerId === playerId) {
      // Get cost
      const unitCost = this.resourceManager.getUnitCost("ranged");
      const cost = `(F:${unitCost.food}/O:${unitCost.ore})`;
      
      // Check if player has resources
      const canAfford = this.resourceManager.hasEnoughResources(playerId, unitCost.food, unitCost.ore);
      
      this.createActionButton(
        buttonX, buttonY,
        `Train Archer ${cost}`,
        () => {
          if (this.selectedBuilding) {
            // Deduct resources
            if (this.resourceManager.deductResourcesForUnit(playerId, "ranged")) {
              // Add to production queue
              this.buildingManager.queueUnitProduction(this.selectedBuilding.id, "ranged");
              
              // Update resources
              this.updateResources();
              
              // Refresh building info
              this.displayBuildingInfo(this.selectedBuilding);
            } else {
              this.showMessage("Not enough resources");
            }
          }
        },
        canAfford
      );
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
    const techPanelBg = this.scene.add.rectangle(0, 0, 600, 500, 0x222222, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setOrigin(0.5);
    
    // Create title
    const techTitle = this.scene.add.text(0, -220, "TECHNOLOGIES", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      align: "center"
    })
      .setOrigin(0.5);
    
    // Create close button
    const closeButton = this.scene.add.text(270, -220, "X", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#aa3333",
      padding: { x: 8, y: 4 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toggleTechPanel());
    
    // Add faction banner
    const playerId = this.scene.registry.get("localPlayerId");
    const players = this.scene.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    
    if (player) {
      const factionBanner = this.scene.add.text(0, -180, `${player.faction} Tech Tree`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: player.faction === "Nephites" ? "#88aaff" : "#ff8888",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 }
      })
        .setOrigin(0.5);
      
      this.techPanel.add(factionBanner);
    }
    
    // Tab buttons for different tech categories
    const militaryTechBtn = this.scene.add.text(-160, -140, "MILITARY", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setData("category", "military");
    
    const economyTechBtn = this.scene.add.text(-40, -140, "ECONOMY", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setData("category", "economy");
    
    const defenseTechBtn = this.scene.add.text(80, -140, "DEFENSE", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setData("category", "defense");
    
    const specialTechBtn = this.scene.add.text(200, -140, "SPECIAL", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setData("category", "special");
    
    // Set up category button interactions
    [militaryTechBtn, economyTechBtn, defenseTechBtn, specialTechBtn].forEach(btn => {
      btn.on("pointerover", () => btn.setStyle({ color: "#ffff00" }))
         .on("pointerout", () => btn.setStyle({ color: "#ffffff" }))
         .on("pointerdown", () => {
           // Store selected category
           this.techPanel.setData("selectedCategory", btn.getData("category"));
           this.updateTechPanel();
         });
    });
    
    // Set default category
    this.techPanel.setData("selectedCategory", "military");
    
    // Add to panel
    this.techPanel.add([techPanelBg, techTitle, closeButton, 
                        militaryTechBtn, economyTechBtn, defenseTechBtn, specialTechBtn]);
    
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
    // Remove existing tech items except for initial elements (bg, title, etc.)
    const fixedElementCount = 7; // Background, title, close button, faction banner, and 4 category tabs
    const children = this.techPanel.getAll();
    for (let i = children.length - 1; i >= fixedElementCount; i--) {
      children[i].destroy();
    }
    
    // Get player's faction and selected category
    const playerId = this.scene.registry.get("localPlayerId");
    const players = this.scene.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    if (!player) return;
    
    const selectedCategory = this.techPanel.getData("selectedCategory") || "military";
    
    // Highlight the selected category button
    for (let i = 3; i < 7; i++) {
      if (i < children.length) {
        const categoryBtn = children[i] as Phaser.GameObjects.Text;
        const btnCategory = categoryBtn.getData("category");
        
        if (btnCategory === selectedCategory) {
          categoryBtn.setStyle({ 
            backgroundColor: "#5d8a8d",
            color: "#ffff00"
          });
        } else {
          categoryBtn.setStyle({ 
            backgroundColor: "#4a6c6f",
            color: "#ffffff"
          });
        }
      }
    }
    
    // Get available technologies and filter by category
    const allTechs = this.techManager.getResearchableTechs(playerId, player.faction);
    const techs = allTechs.filter(tech => {
      // Assign categories based on tech effects or id
      let category = "military";
      
      if (tech.id.includes("agriculture") || 
          tech.id.includes("economy") || 
          tech.id.includes("resources") ||
          tech.effects.foodGatherRate) {
        category = "economy";
      } else if (tech.id.includes("fortification") || 
                tech.id.includes("defense") || 
                tech.id.includes("wall") ||
                tech.effects.defense ||
                tech.effects.buildingDefense) {
        category = "defense";
      } else if (tech.id.includes("special") || 
                tech.faction) {
        category = "special";
      }
      
      return category === selectedCategory;
    });
    
    // Get researched technologies in this category to show at the top
    const researchedTechs = Array.from(this.techManager.getTechnologies(playerId, player.faction))
      .filter(tech => {
        // Same categorization logic as above
        let category = "military";
        
        if (tech.id.includes("agriculture") || 
            tech.id.includes("economy") || 
            tech.id.includes("resources") ||
            tech.effects?.foodGatherRate) {
          category = "economy";
        } else if (tech.id.includes("fortification") || 
                  tech.id.includes("defense") || 
                  tech.id.includes("wall") ||
                  tech.effects?.defense ||
                  tech.effects?.buildingDefense) {
          category = "defense";
        } else if (tech.id.includes("special") || 
                  tech.faction) {
          category = "special";
        }
        
        return category === selectedCategory && tech.researched;
      });
    
    // Create researched tech items first (grayed out)
    let yOffset = -90;
    
    // If there are researched techs, add a heading
    if (researchedTechs.length > 0) {
      const researchedHeader = this.scene.add.text(0, yOffset, "RESEARCHED TECHNOLOGIES", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#aaaaaa",
        align: "center"
      }).setOrigin(0.5);
      
      this.techPanel.add(researchedHeader);
      yOffset += 30;
      
      researchedTechs.forEach(tech => {
        const techItem = this.createCompletedTechItem(tech, 0, yOffset);
        this.techPanel.add(techItem);
        yOffset += 60;
      });
      
      // Add a separator
      const separator = this.scene.add.line(0, yOffset + 10, -250, 0, 250, 0, 0xaaaaaa);
      this.techPanel.add(separator);
      yOffset += 30;
    }
    
    // Add heading for available techs
    const availableHeader = this.scene.add.text(0, yOffset, "AVAILABLE TECHNOLOGIES", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    
    this.techPanel.add(availableHeader);
    yOffset += 30;
    
    // Create available tech items
    techs.forEach(tech => {
      const techItem = this.createTechItem(tech, 0, yOffset);
      this.techPanel.add(techItem);
      yOffset += 80;
    });
    
    // If no techs available in this category
    if (techs.length === 0) {
      const noTechText = this.scene.add.text(0, yOffset + 20, "No technologies available in this category", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#aaaaaa",
        align: "center"
      })
        .setOrigin(0.5);
      
      this.techPanel.add(noTechText);
    }
  }
  
  private createCompletedTechItem(tech: any, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    // Tech background (grayed out)
    const bg = this.scene.add.rectangle(0, 0, 500, 50, 0x282828)
      .setStrokeStyle(1, 0x444444);
    
    // Tech name
    const nameText = this.scene.add.text(-230, -10, tech.name, {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#888888"
    })
      .setOrigin(0, 0);
    
    // Researched indicator
    const researchedText = this.scene.add.text(200, -10, "RESEARCHED", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#22cc22",
      align: "right"
    })
      .setOrigin(1, 0);
    
    container.add([bg, nameText, researchedText]);
    return container;
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
