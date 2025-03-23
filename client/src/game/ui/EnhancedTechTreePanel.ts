import Phaser from "phaser";
import { TechInfo, FactionType } from "../types";
import { TechManager } from "../managers/TechManager";
import { ResourceManager } from "../managers/ResourceManager";

/**
 * Enhanced Tech Tree panel with improved visualization of tech dependencies,
 * clearer categorization, and better explanation of strategic choices
 */
export class EnhancedTechTreePanel {
  private scene: Phaser.Scene;
  private techManager: TechManager;
  private resourceManager: ResourceManager;
  private panel: Phaser.GameObjects.Container;
  private techNodes: Map<string, Phaser.GameObjects.Container>;
  private techConnections: Phaser.GameObjects.Graphics;
  private categoryButtons: Map<string, Phaser.GameObjects.Text>;
  private selectedCategory: string = "military";
  private scrollPosition: number = 0;
  private maxScrollPosition: number = 0;
  private isVisible: boolean = false;
  
  // Constants for panel layout
  private readonly PANEL_WIDTH: number = 800;
  private readonly PANEL_HEIGHT: number = 600;
  private readonly NODE_WIDTH: number = 200;
  private readonly NODE_HEIGHT: number = 120;
  private readonly NODE_SPACING_X: number = 250;
  private readonly NODE_SPACING_Y: number = 150;
  private techTiers: { [key: string]: number } = {}; // Changed from readonly to mutable
  private readonly CATEGORY_COLORS: { [key: string]: number } = {
    military: 0xb92d2d,   // Red for military
    economy: 0x2d8a36,    // Green for economy
    defense: 0x3d6fa3,    // Blue for defense
    special: 0x8a2d8a     // Purple for special
  };
  
  // Descriptions of strategic implications for each category
  private readonly CATEGORY_DESCRIPTIONS = {
    military: "Military technologies enhance your offensive capabilities. Focusing here allows for a more aggressive playstyle.",
    economy: "Economic technologies improve resource gathering and efficiency. Critical for sustained warfare and expansion.",
    defense: "Defensive technologies strengthen your buildings and fortifications. Essential for holding territory.",
    special: "Faction-specific technologies that provide unique advantages based on your civilization's strengths."
  };
  
  constructor(scene: Phaser.Scene, techManager: TechManager, resourceManager: ResourceManager) {
    this.scene = scene;
    this.techManager = techManager;
    this.resourceManager = resourceManager;
    this.techNodes = new Map();
    this.categoryButtons = new Map();
    
    this.panel = this.scene.add.container(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2
    );
    this.panel.setDepth(100); // Ensure it's above other UI elements
    this.panel.setVisible(false);
    
    // Create connection graphics for tech tree lines
    this.techConnections = this.scene.add.graphics();
    this.panel.add(this.techConnections);
    
    this.createPanelBase();
  }
  
  /**
   * Create the base panel with categories and controls
   */
  private createPanelBase() {
    // Panel background
    const panelBg = this.scene.add.rectangle(
      0, 0,
      this.PANEL_WIDTH, this.PANEL_HEIGHT,
      0x222222, 0.95
    ).setStrokeStyle(2, 0x444444);
    
    // Panel title
    const titleText = this.scene.add.text(
      0, -this.PANEL_HEIGHT/2 + 30,
      "TECHNOLOGY TREE",
      {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff",
        align: "center"
      }
    ).setOrigin(0.5);
    
    // Close button
    const closeButton = this.scene.add.text(
      this.PANEL_WIDTH/2 - 20, -this.PANEL_HEIGHT/2 + 20,
      "✕",
      {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff"
      }
    )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => closeButton.setStyle({ color: "#ff0000" }))
      .on("pointerout", () => closeButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => this.toggle());
    
    // Category tabs at the top
    const categories = ["military", "economy", "defense", "special"];
    const categoryWidth = this.PANEL_WIDTH / categories.length;
    
    categories.forEach((category, index) => {
      // Position tab evenly across the top
      const x = -this.PANEL_WIDTH/2 + categoryWidth * (index + 0.5);
      const y = -this.PANEL_HEIGHT/2 + 70;
      
      const displayName = category.charAt(0).toUpperCase() + category.slice(1);
      const categoryColor = this.CATEGORY_COLORS[category];
      
      // Create tab
      const tab = this.scene.add.text(
        x, y,
        displayName,
        {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ffffff",
          backgroundColor: `#${categoryColor.toString(16)}`,
          padding: { x: 15, y: 8 }
        }
      )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setData("category", category);
      
      // Tab interactions
      tab.on("pointerdown", () => {
        this.selectedCategory = category;
        this.updateCategorySelection();
        this.populateTechTree();
      });
      
      this.categoryButtons.set(category, tab);
    });
    
    // Scrolling controls
    const scrollUpButton = this.scene.add.text(
      this.PANEL_WIDTH/2 - 30, -70,
      "▲",
      {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff"
      }
    )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scroll(-50));
    
    const scrollDownButton = this.scene.add.text(
      this.PANEL_WIDTH/2 - 30, 70,
      "▼",
      {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff"
      }
    )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scroll(50));
    
    // Add elements to panel
    this.panel.add([
      panelBg,
      titleText,
      closeButton,
      scrollUpButton,
      scrollDownButton,
      ...this.categoryButtons.values()
    ]);
    
    // Add category description container
    const descriptionContainer = this.scene.add.container(0, -this.PANEL_HEIGHT/2 + 120);
    const descriptionBg = this.scene.add.rectangle(
      0, 0,
      this.PANEL_WIDTH - 60, 60,
      0x333333
    ).setStrokeStyle(1, 0x555555);
    
    const descriptionText = this.scene.add.text(
      0, 0,
      this.CATEGORY_DESCRIPTIONS.military,
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: this.PANEL_WIDTH - 80 }
      }
    ).setOrigin(0.5);
    
    descriptionContainer.add([descriptionBg, descriptionText]);
    descriptionContainer.setData("descriptionText", descriptionText);
    this.panel.add(descriptionContainer);
    
    // Content container for tech nodes (will be populated later)
    const contentContainer = this.scene.add.container(0, 0);
    contentContainer.setData("isContent", true);
    this.panel.add(contentContainer);
  }
  
  /**
   * Update the visual selection state of category tabs
   */
  private updateCategorySelection() {
    this.categoryButtons.forEach((button, category) => {
      const isSelected = category === this.selectedCategory;
      const color = this.CATEGORY_COLORS[category];
      
      button.setStyle({
        fontSize: isSelected ? "20px" : "18px",
        backgroundColor: `#${color.toString(16)}`,
        color: isSelected ? "#ffffff" : "#cccccc"
      });
      
      // Update description text
      const descriptionContainer = this.panel.getAll().find(item => item.getData && item.getData("descriptionText"));
      if (descriptionContainer) {
        const descriptionText = descriptionContainer.getData("descriptionText") as Phaser.GameObjects.Text;
        descriptionText.setText(this.CATEGORY_DESCRIPTIONS[this.selectedCategory]);
      }
    });
  }
  
  /**
   * Toggle panel visibility
   */
  public toggle() {
    this.isVisible = !this.isVisible;
    this.panel.setVisible(this.isVisible);
    
    if (this.isVisible) {
      this.updateCategorySelection();
      this.populateTechTree();
    }
  }
  
  /**
   * Scroll the tech tree content
   */
  private scroll(amount: number) {
    // Get content container
    const contentContainer = this.panel.getAll().find(item => item.getData && item.getData("isContent")) as Phaser.GameObjects.Container;
    if (!contentContainer) return;
    
    // Calculate new scroll position with limits
    this.scrollPosition = Phaser.Math.Clamp(
      this.scrollPosition + amount,
      0,
      this.maxScrollPosition
    );
    
    // Apply the scroll position
    contentContainer.y = -this.scrollPosition;
  }
  
  /**
   * Clear and rebuild the tech tree visualization
   */
  private populateTechTree() {
    // Get player info
    const playerId = this.scene.registry.get("localPlayerId");
    const players = this.scene.registry.get("players") || [];
    const player = players.find((p: any) => p.id === playerId);
    if (!player) return;
    
    // Get content container
    const contentContainer = this.panel.getAll().find(item => item.getData && item.getData("isContent")) as Phaser.GameObjects.Container;
    if (!contentContainer) return;
    
    // Clear previous content
    contentContainer.removeAll(true);
    this.techNodes.clear();
    this.techConnections.clear();
    
    // Get technologies for this player and faction
    const allTechs = this.techManager.getTechnologies(playerId, player.faction);
    
    // Calculate tech tiers based on prerequisites
    this.calculateTechTiers(allTechs);
    
    // Filter technologies by selected category
    const techs = allTechs.filter(tech => this.getTechCategory(tech) === this.selectedCategory);
    
    // First, create all nodes
    techs.forEach(tech => {
      const tier = this.TECH_TIERS[tech.id] || 0;
      const node = this.createTechNode(tech, tier);
      this.techNodes.set(tech.id, node);
      contentContainer.add(node);
    });
    
    // Then, draw connections between prerequisites
    this.drawTechConnections(techs);
    
    // Calculate max scroll position based on content height
    let maxY = 0;
    this.techNodes.forEach(node => {
      const nodeY = node.y + this.NODE_HEIGHT/2;
      if (nodeY > maxY) maxY = nodeY;
    });
    
    this.maxScrollPosition = Math.max(0, maxY - this.PANEL_HEIGHT/2 + 100);
    
    // Reset scroll position
    this.scrollPosition = 0;
    contentContainer.y = 0;
  }
  
  /**
   * Calculate tier positions for each technology based on prerequisites
   */
  private calculateTechTiers(techs: TechInfo[]) {
    // Reset tiers
    this.TECH_TIERS = {};
    
    // First pass: assign tier 0 to techs with no prerequisites
    techs.forEach(tech => {
      if (tech.prerequisites.length === 0) {
        this.TECH_TIERS[tech.id] = 0;
      }
    });
    
    // Multiple passes to handle dependencies
    let changed = true;
    let maxIterations = 10; // Safety limit
    
    while (changed && maxIterations > 0) {
      changed = false;
      maxIterations--;
      
      techs.forEach(tech => {
        // Skip techs that already have a tier assigned
        if (this.TECH_TIERS[tech.id] !== undefined) return;
        
        // Check if all prerequisites have tiers assigned
        const prereqTiers = tech.prerequisites
          .map(prereqId => this.TECH_TIERS[prereqId])
          .filter(tier => tier !== undefined);
        
        // If all prerequisites have tiers, assign this tech to next tier
        if (prereqTiers.length === tech.prerequisites.length && prereqTiers.length > 0) {
          this.TECH_TIERS[tech.id] = Math.max(...prereqTiers) + 1;
          changed = true;
        }
      });
    }
    
    // Assign default tier for any remaining techs
    techs.forEach(tech => {
      if (this.TECH_TIERS[tech.id] === undefined) {
        this.TECH_TIERS[tech.id] = 0;
      }
    });
  }
  
  /**
   * Create a visual node for a technology
   */
  private createTechNode(tech: TechInfo, tier: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    
    // Position based on tier and category
    const categoryIndex = ["military", "economy", "defense", "special"].indexOf(this.getTechCategory(tech));
    const x = tier * this.NODE_SPACING_X - this.PANEL_WIDTH/2 + 200;
    
    // For same-tier techs, stack them vertically
    const sameTierTechs = Array.from(this.techNodes.values())
      .filter(node => node.getData("tier") === tier && node.getData("category") === this.getTechCategory(tech));
    
    const y = sameTierTechs.length * this.NODE_SPACING_Y + 50;
    
    container.setPosition(x, y);
    container.setData("tier", tier);
    container.setData("techId", tech.id);
    container.setData("category", this.getTechCategory(tech));
    
    // Background with category color
    const categoryColor = this.CATEGORY_COLORS[this.getTechCategory(tech)];
    const alpha = tech.researched ? 0.5 : 0.8;
    const bg = this.scene.add.rectangle(
      0, 0,
      this.NODE_WIDTH, this.NODE_HEIGHT,
      categoryColor, alpha
    ).setStrokeStyle(2, tech.researched ? 0x888888 : 0xffffff);
    
    // Tech name
    const nameText = this.scene.add.text(
      0, -this.NODE_HEIGHT/2 + 20,
      tech.name,
      {
        fontFamily: "monospace",
        fontSize: "16px",
        color: tech.researched ? "#aaaaaa" : "#ffffff",
        align: "center"
      }
    ).setOrigin(0.5);
    
    // Description (shortened)
    const descText = this.scene.add.text(
      0, -this.NODE_HEIGHT/2 + 45,
      tech.description,
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: tech.researched ? "#888888" : "#cccccc",
        align: "center",
        wordWrap: { width: this.NODE_WIDTH - 20 }
      }
    ).setOrigin(0.5);
    
    // Costs
    const costText = this.scene.add.text(
      0, this.NODE_HEIGHT/2 - 35,
      `Cost: ${tech.cost.food} 🌽 | ${tech.cost.ore} ⛏️`,
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#aaaaaa",
        align: "center"
      }
    ).setOrigin(0.5);
    
    container.add([bg, nameText, descText, costText]);
    
    // Add unique effects text
    let effectsText = "";
    if (tech.effects.attack) effectsText += `+${tech.effects.attack} Attack `;
    if (tech.effects.defense) effectsText += `+${tech.effects.defense} Defense `;
    if (tech.effects.speed) effectsText += `+${Math.round((tech.effects.speed-1)*100)}% Speed `;
    if (tech.effects.foodGatherRate) effectsText += `+${Math.round((tech.effects.foodGatherRate-1)*100)}% Food `;
    if (tech.effects.oreGatherRate) effectsText += `+${Math.round((tech.effects.oreGatherRate-1)*100)}% Ore `;
    if (tech.effects.buildingDefense) effectsText += `+${tech.effects.buildingDefense} Bldg Def `;
    if (tech.effects.buildingHealth) effectsText += `+${Math.round((tech.effects.buildingHealth-1)*100)}% Bldg HP `;
    
    const effectsTextObj = this.scene.add.text(
      0, this.NODE_HEIGHT/2 - 15,
      effectsText || "No direct effects",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffff99",
        align: "center"
      }
    ).setOrigin(0.5);
    
    container.add(effectsTextObj);
    
    // Status text or research button
    if (tech.researched) {
      // Researched badge
      const researchedText = this.scene.add.text(
        0, this.NODE_HEIGHT/2 - 55,
        "RESEARCHED",
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#33ff33",
          backgroundColor: "#225522",
          padding: { x: 8, y: 4 }
        }
      ).setOrigin(0.5);
      
      container.add(researchedText);
    } else {
      // Check if all prerequisites are met
      const canResearch = tech.prerequisites.every(prereqId => {
        const prereqTech = this.techManager.getTechById(prereqId);
        return prereqTech && prereqTech.researched;
      });
      
      // Check if player has enough resources
      const hasResources = this.resourceManager.hasEnoughResources(
        playerId,
        tech.cost.food,
        tech.cost.ore
      );
      
      // Research button
      const btnColor = canResearch && hasResources ? "#33aa33" : "#888888";
      const researchBtn = this.scene.add.text(
        0, this.NODE_HEIGHT/2 - 55,
        "RESEARCH",
        {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: btnColor,
          padding: { x: 10, y: 5 }
        }
      ).setOrigin(0.5);
      
      if (canResearch && hasResources) {
        researchBtn.setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            this.techManager.researchTechnology(tech.id, playerId);
            // Refresh the panel after researching
            this.populateTechTree();
          });
      } else if (!canResearch) {
        // Show "Prerequisites needed" badge
        const prereqText = this.scene.add.text(
          -this.NODE_WIDTH/2 + 10, -this.NODE_HEIGHT/2 + 10,
          "LOCKED",
          {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#ff3333",
            backgroundColor: "#552222",
            padding: { x: 5, y: 2 }
          }
        ).setOrigin(0, 0);
        
        container.add(prereqText);
      } else if (!hasResources) {
        // Show "Not enough resources" badge
        const resourceText = this.scene.add.text(
          -this.NODE_WIDTH/2 + 10, -this.NODE_HEIGHT/2 + 10,
          "NEED RESOURCES",
          {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#ffaa33",
            backgroundColor: "#554422",
            padding: { x: 5, y: 2 }
          }
        ).setOrigin(0, 0);
        
        container.add(resourceText);
      }
      
      container.add(researchBtn);
    }
    
    // If tech unlocks units or buildings, show icon
    if (tech.unlocks && (tech.unlocks.units?.length > 0 || tech.unlocks.buildings?.length > 0)) {
      const unlockItems = [];
      if (tech.unlocks.units) unlockItems.push(...tech.unlocks.units);
      if (tech.unlocks.buildings) unlockItems.push(...tech.unlocks.buildings);
      
      const unlockText = this.scene.add.text(
        this.NODE_WIDTH/2 - 10, -this.NODE_HEIGHT/2 + 10,
        "UNLOCKS",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#33ffff",
          backgroundColor: "#225555",
          padding: { x: 5, y: 2 }
        }
      ).setOrigin(1, 0);
      
      container.add(unlockText);
    }
    
    return container;
  }
  
  /**
   * Draw connection lines between tech prerequisites
   */
  private drawTechConnections(techs: TechInfo[]) {
    this.techConnections.clear();
    
    techs.forEach(tech => {
      const nodeFrom = this.techNodes.get(tech.id);
      if (!nodeFrom) return;
      
      tech.prerequisites.forEach(prereqId => {
        const nodeTo = this.techNodes.get(prereqId);
        if (!nodeTo) return;
        
        // Draw line between nodes
        const fromX = nodeFrom.x;
        const fromY = nodeFrom.y;
        const toX = nodeTo.x;
        const toY = nodeTo.y;
        
        // Color based on research status
        const color = tech.researched ? 0x888888 : 0xffffff;
        const alpha = tech.researched ? 0.5 : 0.8;
        
        this.techConnections.lineStyle(2, color, alpha);
        this.techConnections.beginPath();
        
        // Connect from right of prerequisite to left of tech
        const startX = toX + this.NODE_WIDTH/2;
        const endX = fromX - this.NODE_WIDTH/2;
        
        // Draw a curved line
        this.techConnections.moveTo(startX, toY);
        
        // Control points for smoother curve
        const controlX = (startX + endX) / 2;
        
        this.techConnections.lineTo(controlX, toY);
        this.techConnections.lineTo(controlX, fromY);
        this.techConnections.lineTo(endX, fromY);
        
        this.techConnections.closePath();
        this.techConnections.strokePath();
      });
    });
  }
  
  /**
   * Determine the category of a technology based on its effects and ID
   */
  private getTechCategory(tech: TechInfo): string {
    // Check faction-specific special techs first
    if (tech.faction && tech.id.includes("Title") || tech.id.includes("Record") || 
        tech.id.includes("Alliance") || tech.id.includes("Prophecy")) {
      return "special";
    }
    
    // Check defense technologies
    if (tech.id.includes("fortification") || 
        tech.id.includes("defense") || 
        tech.id.includes("wall") ||
        tech.effects.defense || 
        tech.effects.buildingDefense) {
      return "defense";
    }
    
    // Check economy technologies
    if (tech.id.includes("agriculture") || 
        tech.id.includes("mining") || 
        tech.id.includes("economy") || 
        tech.id.includes("resources") ||
        tech.effects.foodGatherRate ||
        tech.effects.oreGatherRate) {
      return "economy";
    }
    
    // Default to military
    return "military";
  }
}