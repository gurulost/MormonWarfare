import Phaser from "phaser";
import { FactionType, GameData, MapTile, ResourceType, UnitType } from "../types";
import { ResourceManager } from "../managers/ResourceManager";
import { UnitManager } from "../managers/UnitManager";
import { BuildingManager } from "../managers/BuildingManager";
import { PathfindingManager } from "../managers/PathfindingManager";
import { CombatManager } from "../managers/CombatManager";
import { TechManager } from "../managers/TechManager";
import { TutorialManager } from "../managers/TutorialManager";
import { GameUI } from "../ui/GameUI";
import { EnhancedTechTreePanel } from "../ui/EnhancedTechTreePanel";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { useAudio } from "../../lib/stores/useAudio";
import { TILE_SIZE, MAP_SIZE, CAMERA_SPEED } from "../config";

export class GameScene extends Phaser.Scene {
  // Game data
  private gameData!: GameData;
  private localPlayerId!: string;
  private players: Array<{ id: string; username: string; faction: FactionType }> = [];
  
  // Map and camera
  private map: MapTile[][] = [];
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private edgeScrollThreshold: number = 20;
  
  // Managers
  private resourceManager!: ResourceManager;
  private unitManager!: UnitManager;
  private buildingManager!: BuildingManager;
  private pathfindingManager!: PathfindingManager;
  private combatManager!: CombatManager;
  private techManager!: TechManager;
  private tutorialManager!: TutorialManager;
  private gameUI!: GameUI;
  private enhancedTechTree!: EnhancedTechTreePanel;
  
  // Selection
  private selectedUnits: string[] = [];
  private selectionRect!: Phaser.GameObjects.Rectangle;
  private selectionStart: { x: number; y: number } = { x: 0, y: 0 };
  private isSelecting: boolean = false;
  
  // Minimap
  private minimap!: Phaser.GameObjects.Graphics;
  private minimapSize: number = 150;
  
  constructor() {
    super("GameScene");
  }
  
  init(data: { gameData: GameData, isSolo?: boolean }) {
    this.gameData = data.gameData;
    this.localPlayerId = "local"; // In a real implementation, this would come from the server
    
    // Check if this is a solo game
    const isSoloMode = data.isSolo === true;
    
    // Make sure we only include players with valid factions
    this.players = this.gameData.players
      .filter(player => player.faction !== null)
      .map(player => ({
        id: player.id,
        username: player.username,
        faction: player.faction as FactionType
      }));
    
    // Log game initialization
    console.log(`Initializing game with ${this.players.length} players. Solo mode: ${isSoloMode}`);
    this.players.forEach(player => {
      console.log(`Player: ${player.id}, Faction: ${player.faction}`);
    });
  }
  
  create() {
    const { width, height } = this.cameras.main;
    
    // Initialize cursor keys
    this.cursorKeys = this.input.keyboard!.createCursorKeys();
    
    // Create particle textures for resource effects
    this.createParticleTextures();
    
    // Initialize the managers
    this.pathfindingManager = new PathfindingManager(this);
    this.resourceManager = new ResourceManager(this);
    this.unitManager = new UnitManager(this, this.pathfindingManager);
    this.buildingManager = new BuildingManager(this, this.unitManager);
    this.combatManager = new CombatManager(this, this.unitManager);
    this.techManager = new TechManager(this);
    this.tutorialManager = new TutorialManager(this);
    
    // Generate the map
    this.generateMap();
    
    // Set up camera with bounds (no zoom)
    this.cameras.main.setBounds(0, 0, MAP_SIZE * TILE_SIZE, MAP_SIZE * TILE_SIZE);
    
    // Create selection rectangle
    this.selectionRect = this.add.rectangle(0, 0, 0, 0, 0x00ff00, 0.3)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x00ff00)
      .setVisible(false);
    
    // Set up selection events
    this.setupSelectionEvents();
    
    // Initialize minimap
    this.createMinimap();
    
    // Initialize UI
    this.gameUI = new GameUI(this, this.resourceManager, this.unitManager, this.buildingManager, this.techManager);
    
    // Initialize enhanced tech tree UI
    this.enhancedTechTree = new EnhancedTechTreePanel(this, this.techManager, this.resourceManager);
    
    // Add keyboard shortcut to toggle tech tree (T key)
    this.input.keyboard?.on('keydown-T', () => {
      this.enhancedTechTree.toggle();
    });
    
    // Initialize starting units and buildings for each player
    this.initializePlayersStartingEntities();
    
    // Center camera on local player's city center
    this.centerCameraOnPlayerCity();
    
    // Setup multiplayer event listeners
    this.setupMultiplayerEvents();
    
    // Play background music if enabled
    const audioStore = useAudio.getState();
    if (audioStore.backgroundMusic && !audioStore.isMuted) {
      audioStore.backgroundMusic.play().catch(e => console.log("Music play prevented:", e));
    }
    
    // Check if this is the first time playing and start tutorial if needed
    this.startTutorialIfFirstTime();
    
    // Log game start
    console.log("Game started with players:", this.players);
  }
  
  update(time: number, delta: number) {
    // Update camera position based on keys and edge scrolling
    this.updateCameraPosition(delta);
    
    // Update managers
    this.unitManager.update(delta);
    this.buildingManager.update(delta);
    this.combatManager.update(delta);
    
    // Tutorial manager updates itself via its own timers and event listeners
    
    // Update minimap
    this.updateMinimap();
    
    // Update building placement preview if active
    if (this.buildingPlacementActive) {
      this.updateBuildingPlacement();
    }
    
    // Check for game-ending conditions
    this.checkVictoryConditions();
  }
  
  private generateMap() {
    // Initialize map array
    this.map = [];
    
    // Create layers
    const groundLayer = this.add.group();
    const resourceLayer = this.add.group();
    
    // Create a base map filled with grass
    for (let y = 0; y < MAP_SIZE; y++) {
      this.map[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        // Initialize with grass
        this.map[y][x] = {
          x,
          y,
          type: 'grass',
          walkable: true,
          resource: null
        };
      }
    }

    // Generate water bodies (lakes/rivers)
    this.generateWaterBodies();
    
    // Generate forest clusters
    this.generateForestClusters();
    
    // Generate hill regions
    this.generateHillRegions();
    
    // Add resource nodes
    this.addResourceNodes();
    
    // Create visual representation of the map
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.map[y][x];
        let tileColor = 0x44aa44; // grass
        
        if (tile.type === 'forest') tileColor = 0x228822;
        if (tile.type === 'hills') tileColor = 0x888888;
        if (tile.type === 'water') tileColor = 0x2288aa;
        
        const tileSprite = this.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, tileColor)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x000000, 0.2);
        
        groundLayer.add(tileSprite);
        
        // Draw resource indicators
        if (tile.resource) {
          const resourceType = tile.resource.type;
          this.addResource(x, y, resourceType);
        }
      }
    }
    
    console.log("Map generated successfully");
  }
  
  private generateWaterBodies() {
    // Create a few lakes
    const numLakes = 3 + Math.floor(Math.random() * 3); // 3-5 lakes
    
    for (let i = 0; i < numLakes; i++) {
      const centerX = 10 + Math.floor(Math.random() * (MAP_SIZE - 20)); // Avoid edges
      const centerY = 10 + Math.floor(Math.random() * (MAP_SIZE - 20));
      const size = 3 + Math.floor(Math.random() * 4); // Lake size 3-6
      
      // Create roughly circular lake
      for (let y = centerY - size; y <= centerY + size; y++) {
        for (let x = centerX - size; x <= centerX + size; x++) {
          if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
            // Distance from center
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            // Irregular circle with some randomness
            if (distance <= size * (0.7 + Math.random() * 0.3)) {
              this.map[y][x].type = 'water';
              this.map[y][x].walkable = false;
            }
          }
        }
      }
    }
    
    // Create a river or two
    const numRivers = 1 + Math.floor(Math.random() * 2); // 1-2 rivers
    
    for (let i = 0; i < numRivers; i++) {
      let x = Math.random() < 0.5 ? 0 : MAP_SIZE - 1; // Start at left or right edge
      let y = 5 + Math.floor(Math.random() * (MAP_SIZE - 10)); // Random y position not too close to edge
      
      const horizontal = x === 0; // Direction of flow
      const riverLength = MAP_SIZE - 10 - Math.floor(Math.random() * 20); // River length
      const turns = 3 + Math.floor(Math.random() * 4); // Number of direction changes
      
      // For each segment of the river
      for (let segment = 0; segment < turns; segment++) {
        const segmentLength = Math.floor(riverLength / turns);
        let isHorizontal = segment % 2 === 0 ? horizontal : !horizontal;
        const direction = isHorizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
        
        // Add a bit of meandering
        const meander = { x: 0, y: 0 };
        
        // Draw the river segment
        for (let j = 0; j < segmentLength; j++) {
          // Apply meandering (slight change in direction)
          if (j % 3 === 0) {
            meander.x = isHorizontal ? 0 : (Math.random() < 0.5 ? -1 : 1);
            meander.y = isHorizontal ? (Math.random() < 0.5 ? -1 : 1) : 0;
          }
          
          // Calculate new position
          x += direction.x + meander.x * 0.3;
          y += direction.y + meander.y * 0.3;
          
          // Ensure within bounds
          x = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(x)));
          y = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(y)));
          
          // Mark as water
          this.map[y][x].type = 'water';
          this.map[y][x].walkable = false;
          
          // Add some width to the river
          for (let w = -1; w <= 1; w++) {
            const nx = x + (isHorizontal ? 0 : w);
            const ny = y + (isHorizontal ? w : 0);
            
            if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
              // Thinner at the edges with probability
              if (w === 0 || Math.random() < 0.7) {
                this.map[ny][nx].type = 'water';
                this.map[ny][nx].walkable = false;
              }
            }
          }
        }
      }
    }
  }
  
  private generateForestClusters() {
    const numForestClusters = 4 + Math.floor(Math.random() * 4); // 4-7 forest clusters
    
    for (let i = 0; i < numForestClusters; i++) {
      const centerX = 5 + Math.floor(Math.random() * (MAP_SIZE - 10));
      const centerY = 5 + Math.floor(Math.random() * (MAP_SIZE - 10));
      const size = 4 + Math.floor(Math.random() * 5); // Forest size 4-8
      
      // Create forest cluster
      for (let y = centerY - size; y <= centerY + size; y++) {
        for (let x = centerX - size; x <= centerX + size; x++) {
          if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
            // Distance from center with some noise
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) 
                            + Math.random() * 2 - 1;
            
            // Only change to forest if the tile is currently grass
            if (distance <= size * 0.8 && this.map[y][x].type === 'grass') {
              // More dense near center, sparser at edges
              if (distance < size * 0.4 || Math.random() < 0.7) {
                this.map[y][x].type = 'forest';
              }
            }
          }
        }
      }
    }
  }
  
  private generateHillRegions() {
    const numHillRegions = 3 + Math.floor(Math.random() * 3); // 3-5 hill regions
    
    for (let i = 0; i < numHillRegions; i++) {
      const centerX = 5 + Math.floor(Math.random() * (MAP_SIZE - 10));
      const centerY = 5 + Math.floor(Math.random() * (MAP_SIZE - 10));
      const size = 3 + Math.floor(Math.random() * 4); // Hill size 3-6
      
      // Create hill region
      for (let y = centerY - size; y <= centerY + size; y++) {
        for (let x = centerX - size; x <= centerX + size; x++) {
          if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
            // Distance from center with some noise for irregular shape
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) 
                            + Math.random() * 1.5 - 0.75;
            
            // Only change to hills if the tile is currently grass
            if (distance <= size * 0.7 && this.map[y][x].type === 'grass') {
              this.map[y][x].type = 'hills';
            }
          }
        }
      }
    }
  }
  
  private addResourceNodes() {
    // Add food resources to some forest tiles
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (this.map[y][x].type === 'forest' && Math.random() < 0.4) {
          this.map[y][x].resource = {
            type: 'food',
            amount: 300 + Math.floor(Math.random() * 200) // 300-500 food
          };
        } else if (this.map[y][x].type === 'hills' && Math.random() < 0.6) {
          this.map[y][x].resource = {
            type: 'ore',
            amount: 400 + Math.floor(Math.random() * 300) // 400-700 ore
          };
        }
      }
    }
    
    // Add a few strategic resource deposits in grass areas
    const numStrategicDeposits = 5 + Math.floor(Math.random() * 6); // 5-10 strategic deposits
    
    for (let i = 0; i < numStrategicDeposits; i++) {
      // Find a suitable grass tile that's not near the edge
      let attempts = 0;
      let x, y;
      
      do {
        x = 10 + Math.floor(Math.random() * (MAP_SIZE - 20));
        y = 10 + Math.floor(Math.random() * (MAP_SIZE - 20));
        attempts++;
      } while ((this.map[y][x].type !== 'grass' || this.map[y][x].resource !== null) && attempts < 100);
      
      if (attempts < 100) {
        // Alternate between food and ore
        const resourceType: ResourceType = i % 2 === 0 ? 'food' : 'ore';
        this.map[y][x].resource = {
          type: resourceType,
          amount: 600 + Math.floor(Math.random() * 400) // 600-1000 resources (high value)
        };
      }
    }
  }
  
  private addResource(x: number, y: number, type: ResourceType, amount?: number) {
    // Update map data if amount not provided
    if (!this.map[y][x].resource || amount !== undefined) {
      this.map[y][x].resource = {
        type,
        amount: amount || (type === 'food' ? 300 : 500) // Ore has more resources by default
      };
    }
    
    // Get existing amount if already has resource
    const resourceAmount = this.map[y][x].resource!.amount;
    
    // Create resource container for the visuals
    const resourceContainer = this.add.container(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2
    );
    
    // Store reference to the container in the game registry for updates
    if (!this.registry.has('resourceMarkers')) {
      this.registry.set('resourceMarkers', {});
    }
    const resourceMarkers = this.registry.get('resourceMarkers');
    resourceMarkers[`${x},${y}`] = resourceContainer;
    
    // Create resource icon based on type
    if (type === 'food') {
      // Food resource (crops/fruit)
      const baseColor = 0x22aa22; // Darker green
      const highlightColor = 0x44cc44; // Lighter green
      
      // Base circle for food
      const baseCircle = this.add.circle(0, 0, TILE_SIZE / 4, baseColor);
      
      // Create stylized food icon (small stalks for crops)
      const stalk1 = this.add.rectangle(-3, -8, 2, 10, highlightColor).setRotation(-0.2);
      const stalk2 = this.add.rectangle(3, -8, 2, 10, highlightColor).setRotation(0.2);
      const stalk3 = this.add.rectangle(0, -10, 2, 12, highlightColor);
      
      resourceContainer.add([baseCircle, stalk1, stalk2, stalk3]);
    } else {
      // Ore resource (minerals)
      const baseColor = 0x884422; // Brown base
      const highlightColor = 0xaa6644; // Lighter brown/copper
      
      // Base circle for ore
      const baseCircle = this.add.circle(0, 0, TILE_SIZE / 4, baseColor);
      
      // Create stylized ore icon (small rock chunks)
      const rock1 = this.add.circle(-4, -4, 3, highlightColor);
      const rock2 = this.add.circle(4, -2, 4, highlightColor);
      const rock3 = this.add.circle(0, 3, 3, highlightColor);
      
      resourceContainer.add([baseCircle, rock1, rock2, rock3]);
    }
    
    // Add text indicator showing resource type
    const resourceText = this.add.text(
      0, 0,
      type === 'food' ? "F" : "O",
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 1
      }
    ).setOrigin(0.5);
    
    resourceContainer.add(resourceText);
    
    // Add resource amount indicator (size proportional to amount)
    const maxAmount = type === 'food' ? 300 : 500;
    const sizeRatio = Math.min(1, resourceAmount / maxAmount);
    
    // Outer ring indicating resource amount
    const resourceRing = this.add.circle(
      0, 0,
      TILE_SIZE / 3,
      type === 'food' ? 0x44ff44 : 0xcc8844,
      0.2
    ).setStrokeStyle(2, type === 'food' ? 0x44ff44 : 0xcc8844, sizeRatio);
    
    resourceContainer.add(resourceRing);
    
    // Add resource to registry for later reference
    this.registry.set(`resource_${x}_${y}`, {
      container: resourceContainer,
      ring: resourceRing,
      type: type,
      tileX: x,
      tileY: y
    });
    
    return resourceContainer;
  }
  
  /**
   * Create particle textures for resource gathering effects
   */
  private createParticleTextures() {
    // Create a basic particle texture if not already loaded
    if (!this.textures.exists('particle')) {
      // Create a white circle as a particle texture
      const graphics = this.add.graphics();
      graphics.fillStyle(0xffffff);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('particle', 16, 16);
      graphics.destroy();
      
      // Create gathering sound effects if they don't exist yet
      this.sound.add('gatherFood', { volume: 0.3 });
      this.sound.add('gatherOre', { volume: 0.3 });
      this.sound.add('deposit', { volume: 0.4 });
    }
  }
  
  /**
   * Updates the visual appearance of a resource based on its current amount
   */
  private updateResourceVisual(x: number, y: number) {
    const resource = this.map[y][x].resource;
    if (!resource) return;
    
    const resourceKey = `resource_${x}_${y}`;
    const resourceData = this.registry.get(resourceKey);
    
    if (!resourceData) return;
    
    const maxAmount = resource.type === 'food' ? 300 : 500;
    const sizeRatio = Math.min(1, resource.amount / maxAmount);
    
    // Update outer ring to show remaining resources
    resourceData.ring.setAlpha(0.2 * sizeRatio + 0.1);
    resourceData.ring.setStrokeStyle(2, 
      resource.type === 'food' ? 0x44ff44 : 0xcc8844, 
      sizeRatio
    );
    
    // If nearly depleted, make the resource icon pulse to indicate it's almost gone
    if (sizeRatio < 0.2) {
      const pulseRate = 500; // ms
      
      if (!resourceData.pulseTween) {
        resourceData.pulseTween = this.tweens.add({
          targets: resourceData.container,
          scaleX: { from: 0.8, to: 1 },
          scaleY: { from: 0.8, to: 1 },
          alpha: { from: 0.7, to: 1 },
          duration: pulseRate,
          yoyo: true,
          repeat: -1
        });
      }
    } else if (resourceData.pulseTween && resourceData.pulseTween.isPlaying()) {
      resourceData.pulseTween.stop();
      resourceData.container.setScale(1).setAlpha(1);
    }
  }
  
  /**
   * Updates camera position based on keyboard input and edge scrolling
   * Zoom functionality is disabled to maintain a fixed camera height
   * Only panning movement is allowed
   */
  private updateCameraPosition(delta: number) {
    const camera = this.cameras.main;
    const speed = CAMERA_SPEED * (delta / 16);
    
    // Keyboard movement - only panning (left, right, up, down)
    if (this.cursorKeys.left.isDown) {
      camera.scrollX -= speed;
    } else if (this.cursorKeys.right.isDown) {
      camera.scrollX += speed;
    }
    
    if (this.cursorKeys.up.isDown) {
      camera.scrollY -= speed;
    } else if (this.cursorKeys.down.isDown) {
      camera.scrollY += speed;
    }
    
    // Edge scrolling for mouse-based panning
    const pointer = this.input.activePointer;
    
    if (pointer.isDown && !this.isSelecting) {
      if (pointer.x < this.edgeScrollThreshold) {
        camera.scrollX -= speed;
      } else if (pointer.x > this.cameras.main.width - this.edgeScrollThreshold) {
        camera.scrollX += speed;
      }
      
      if (pointer.y < this.edgeScrollThreshold) {
        camera.scrollY -= speed;
      } else if (pointer.y > this.cameras.main.height - this.edgeScrollThreshold) {
        camera.scrollY += speed;
      }
    }
    
    // Ensure camera stays within bounds
    camera.scrollX = Phaser.Math.Clamp(
      camera.scrollX,
      0,
      MAP_SIZE * TILE_SIZE - camera.width
    );
    camera.scrollY = Phaser.Math.Clamp(
      camera.scrollY,
      0,
      MAP_SIZE * TILE_SIZE - camera.height
    );
  }
  
  // Track the selected building ID
  private selectedBuildingId: string | null = null;
  
  private setupSelectionEvents() {
    // Start selection
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Skip if building placement is active
      if (this.buildingPlacementActive) return;
      
      if (pointer.leftButtonDown()) {
        this.selectionStart.x = pointer.worldX;
        this.selectionStart.y = pointer.worldY;
        this.isSelecting = true;
        this.selectionRect.setPosition(this.selectionStart.x, this.selectionStart.y);
        this.selectionRect.setSize(0, 0);
        this.selectionRect.setVisible(true);
      } else if (pointer.rightButtonDown() && this.selectedUnits.length > 0) {
        // Right-click to move selected units
        const targetX = Math.floor(pointer.worldX / TILE_SIZE);
        const targetY = Math.floor(pointer.worldY / TILE_SIZE);
        
        // Check if the coordinates are within the map boundaries
        if (targetX >= 0 && targetX < MAP_SIZE && targetY >= 0 && targetY < MAP_SIZE && 
            this.map && this.map[targetY] && this.map[targetY][targetX]) {
          // Check if clicked on a resource
          if (this.map[targetY][targetX].resource) {
            this.unitManager.orderUnitsToGatherResource(this.selectedUnits, targetX, targetY);
          } else {
            // Move units to target position
            this.unitManager.moveUnitsTo(this.selectedUnits, targetX, targetY);
          }
        } else {
          console.log("Clicked outside map boundaries or invalid map data");
        }
      }
    });
    
    // Update selection rectangle
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isSelecting) {
        const width = pointer.worldX - this.selectionStart.x;
        const height = pointer.worldY - this.selectionStart.y;
        this.selectionRect.setSize(width, height);
      }
    });
    
    // End selection
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isSelecting) {
        this.isSelecting = false;
        this.selectionRect.setVisible(false);
        
        // Calculate selection bounds
        const bounds = this.selectionRect.getBounds();
        
        // Clear previous selections
        this.selectedUnits = [];
        this.selectedBuildingId = null;
        
        // For small selections (clicks), try to select buildings first
        if (bounds.width < 5 && bounds.height < 5) {
          const worldX = pointer.worldX;
          const worldY = pointer.worldY;
          
          // Try to select a building first
          const tileX = Math.floor(worldX / TILE_SIZE);
          const tileY = Math.floor(worldY / TILE_SIZE);
          
          // Get all buildings and find the one at the clicked position
          const buildings = this.buildingManager.getAllBuildings();
          for (const building of buildings) {
            // Check if the click is within the building's bounds
            // Buildings have size property
            const buildingSize = building.size || 2; // Default to 2 if size not defined
            
            // Calculate building bounds
            const buildingMinX = building.x;
            const buildingMinY = building.y;
            const buildingMaxX = building.x + buildingSize - 1;
            const buildingMaxY = building.y + buildingSize - 1;
            
            if (tileX >= buildingMinX && tileX <= buildingMaxX &&
                tileY >= buildingMinY && tileY <= buildingMaxY) {
              // Found a building at the clicked position
              this.selectedBuildingId = building.id;
              
              // Mark building as selected visually
              building.setSelected(true);
              
              // Update UI with building selection
              this.gameUI.updateSelection([], this.selectedBuildingId);
              return;
            }
          }
          
          // If no building was clicked, try to select a unit
          const clickedUnit = this.unitManager.selectUnitAtPosition(worldX, worldY, this.localPlayerId);
          
          if (clickedUnit) {
            this.selectedUnits = [clickedUnit];
          }
        } else {
          // For larger selections (drag), select all units within bounds
          this.selectedUnits = this.unitManager.selectUnitsInBounds(bounds, this.localPlayerId);
        }
        
        // Update UI with selection
        this.gameUI.updateSelection(this.selectedUnits);
        
        // Clear any previously selected buildings
        const buildings = this.buildingManager.getAllBuildings();
        for (const building of buildings) {
          if (building.id !== this.selectedBuildingId) {
            building.setSelected(false);
          }
        }
      }
    });
  }
  
  private createMinimap() {
    const { width, height } = this.cameras.main;
    
    // Create minimap background
    this.add.rectangle(
      width - this.minimapSize - 10,
      height - this.minimapSize - 10,
      this.minimapSize,
      this.minimapSize,
      0x000000,
      0.7
    ).setOrigin(0, 0).setScrollFactor(0);
    
    // Create minimap
    this.minimap = this.add.graphics().setScrollFactor(0);
    this.minimap.x = width - this.minimapSize - 10;
    this.minimap.y = height - this.minimapSize - 10;
    
    // Make the minimap interactive
    const minimapArea = this.add.rectangle(
      width - this.minimapSize - 10,
      height - this.minimapSize - 10,
      this.minimapSize,
      this.minimapSize,
      0xffffff,
      0
    ).setOrigin(0, 0).setScrollFactor(0).setInteractive();
    
    // Handle minimap clicks
    minimapArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const relativeX = pointer.x - this.minimap.x;
      const relativeY = pointer.y - this.minimap.y;
      
      // Calculate where to move the camera based on minimap click
      const targetX = (relativeX / this.minimapSize) * MAP_SIZE * TILE_SIZE;
      const targetY = (relativeY / this.minimapSize) * MAP_SIZE * TILE_SIZE;
      
      // Center camera on clicked position
      this.cameras.main.centerOn(targetX, targetY);
    });
  }
  
  private updateMinimap() {
    this.minimap.clear();
    
    // Calculate minimap tile size
    const miniTileSize = this.minimapSize / MAP_SIZE;
    
    // Draw terrain
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.map[y][x];
        let color = 0x44aa44; // grass
        
        if (tile.type === 'forest') color = 0x228822;
        if (tile.type === 'hills') color = 0x888888;
        if (tile.type === 'water') color = 0x2288aa;
        
        // Draw mini tile
        this.minimap.fillStyle(color);
        this.minimap.fillRect(
          x * miniTileSize,
          y * miniTileSize,
          miniTileSize,
          miniTileSize
        );
        
        // Draw resources
        if (tile.resource) {
          this.minimap.fillStyle(tile.resource.type === 'food' ? 0x22aa22 : 0x884422);
          this.minimap.fillRect(
            x * miniTileSize + miniTileSize * 0.25,
            y * miniTileSize + miniTileSize * 0.25,
            miniTileSize * 0.5,
            miniTileSize * 0.5
          );
        }
      }
    }
    
    // Draw units
    const units = this.unitManager.getAllUnits();
    for (const unit of units) {
      const color = unit.playerId === this.localPlayerId ? 0x00ff00 : 0xff0000;
      this.minimap.fillStyle(color);
      this.minimap.fillRect(
        unit.x / TILE_SIZE * miniTileSize,
        unit.y / TILE_SIZE * miniTileSize,
        miniTileSize,
        miniTileSize
      );
    }
    
    // Draw buildings
    const buildings = this.buildingManager.getAllBuildings();
    for (const building of buildings) {
      const color = building.playerId === this.localPlayerId ? 0x00ffff : 0xff00ff;
      this.minimap.fillStyle(color);
      this.minimap.fillRect(
        building.x / TILE_SIZE * miniTileSize - miniTileSize / 2,
        building.y / TILE_SIZE * miniTileSize - miniTileSize / 2,
        miniTileSize * 2,
        miniTileSize * 2
      );
    }
    
    // Draw camera view rectangle
    const camera = this.cameras.main;
    this.minimap.lineStyle(1, 0xffffff, 1);
    this.minimap.strokeRect(
      (camera.scrollX / (MAP_SIZE * TILE_SIZE)) * this.minimapSize,
      (camera.scrollY / (MAP_SIZE * TILE_SIZE)) * this.minimapSize,
      (camera.width / (MAP_SIZE * TILE_SIZE)) * this.minimapSize,
      (camera.height / (MAP_SIZE * TILE_SIZE)) * this.minimapSize
    );
  }
  
  private initializePlayersStartingEntities() {
    console.log("Initializing player entities for players:", this.players);
    
    // Determine starting positions for each player
    const startPositions = [
      { x: 5, y: 5 },
      { x: MAP_SIZE - 10, y: MAP_SIZE - 10 },
      { x: 5, y: MAP_SIZE - 10 },
      { x: MAP_SIZE - 10, y: 5 }
    ];
    
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      const startPos = startPositions[i];
      
      // Add extra logging to debug player object
      console.log(`Setting up player ${i}:`, player);
      
      // Ensure this area is clear for starting
      for (let y = startPos.y - 2; y <= startPos.y + 2; y++) {
        for (let x = startPos.x - 2; x <= startPos.x + 2; x++) {
          if (y >= 0 && y < MAP_SIZE && x >= 0 && x < MAP_SIZE) {
            // Clear resources and make sure it's walkable
            this.map[y][x].resource = null;
            this.map[y][x].type = 'grass';
            this.map[y][x].walkable = true;
          }
        }
      }
      
      // Create starting resources - make sure we have a valid faction
      if (player && player.id && player.faction) {
        // Create starting resources
        this.resourceManager.initializePlayerResources(player.id, player.faction);
        
        // Create city center
        this.buildingManager.createBuilding(
          player.id,
          'cityCenter',
          startPos.x,
          startPos.y
        );
        
        // Create initial workers
        for (let w = 0; w < 3; w++) {
          this.unitManager.createUnit(
            player.id,
            'worker',
            startPos.x + Math.cos(w * 2.1) * 2,
            startPos.y + Math.sin(w * 2.1) * 2
          );
        }
      } else {
        console.error("Invalid player data:", player);
      }
    }
  }
  
  /**
   * Centers the camera on the local player's city center
   */
  private centerCameraOnPlayerCity() {
    // Find the local player's city center building
    const localPlayerBuildings = this.buildingManager.getBuildingsByPlayer(this.localPlayerId);
    const cityCenter = localPlayerBuildings.find(building => building.type === 'cityCenter');
    
    if (cityCenter) {
      console.log("Centering camera on local player's city center", cityCenter.x, cityCenter.y);
      
      // Convert from tile coordinates to pixel coordinates
      const centerX = cityCenter.x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = cityCenter.y * TILE_SIZE + TILE_SIZE / 2;
      
      // Center the camera on the city center
      this.cameras.main.centerOn(centerX, centerY);
    } else {
      console.warn("Could not find local player's city center for camera centering");
    }
  }
  
  private setupMultiplayerEvents() {
    const multiplayerStore = useMultiplayer.getState();
    
    // Subscribe to all game events
    multiplayerStore.subscribeToGameEvents((event: any) => {
      console.log("Received multiplayer event:", event.type);
      
      // Handle different event types
      if (event.type === 'unitMove') {
        // Handle unit movement with prediction support
        this.unitManager.moveUnitsTo(
          event.unitIds, 
          event.targetX, 
          event.targetY, 
          { 
            fromServer: !event.isPrediction, 
            isPrediction: event.isPrediction,
            isReapplied: event.isReapplied
          }
        );
      } else if (event.type === 'unitCreate') {
        this.unitManager.createUnit(
          event.playerId, 
          event.unitType, 
          event.x, 
          event.y, 
          true
        );
      } else if (event.type === 'buildingCreate') {
        this.buildingManager.createBuilding(
          event.playerId, 
          event.buildingType, 
          event.x, 
          event.y, 
          true
        );
      } else if (event.type === 'resourceUpdate') {
        this.resourceManager.updateResources(event.playerId, event.resources);
      } else if (event.type === 'stateUpdate') {
        // Process state update with reconciliation
        this.processServerStateUpdate(event.changes, event.timestamp);
      }
    });
  }
  
  private checkVictoryConditions() {
    // Check if any player's city center is destroyed
    for (const player of this.players) {
      const cityCenters = this.buildingManager.getBuildingsByTypeAndPlayer(player.id, 'cityCenter');
      
      if (cityCenters.length === 0 && player.id !== 'defeated') {
        // This player is defeated
        console.log(`Player ${player.id} (${player.username}) has been defeated!`);
        
        // Mark player as defeated
        player.id = 'defeated';
        
        // Check if game is over (only one player remains)
        const remainingPlayers = this.players.filter(p => p.id !== 'defeated');
        
        if (remainingPlayers.length === 1) {
          // Game over - we have a winner!
          const winner = remainingPlayers[0];
          console.log(`Player ${winner.username} (${winner.faction}) wins the game!`);
          
          // Show victory/defeat message
          this.showGameOverMessage(winner.id === this.localPlayerId);
        }
      }
    }
  }
  
  private showGameOverMessage(isVictory: boolean) {
    const { width, height } = this.cameras.main;
    
    // Create overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setScrollFactor(0);
    
    // Create message
    const message = isVictory ? "VICTORY!" : "DEFEAT!";
    const messageColor = isVictory ? "#ffff00" : "#ff0000";
    
    const text = this.add.text(width / 2, height / 2, message, {
      fontFamily: "monospace",
      fontSize: "64px",
      color: messageColor,
      stroke: "#000000",
      strokeThickness: 6,
      align: "center"
    })
      .setOrigin(0.5)
      .setScrollFactor(0);
    
    // Add return to menu button
    const returnButton = this.add.text(width / 2, height / 2 + 100, "RETURN TO MENU", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#444444",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.scene.start("MainMenuScene");
      });
    
    // Play victory/defeat sound
    const audioStore = useAudio.getState();
    if (!audioStore.isMuted) {
      if (isVictory) {
        audioStore.playSuccess();
      } else {
        audioStore.playHit();
      }
    }
  }
  
  // Public getter methods for use by managers
  getMap(): MapTile[][] {
    return this.map;
  }
  
  getLocalPlayerId(): string {
    return this.localPlayerId;
  }
  
  getPlayers(): Array<{ id: string; username: string; faction: FactionType }> {
    return this.players;
  }
  
  getSelectedUnits(): string[] {
    return this.selectedUnits;
  }
  
  // Method to select a unit by ID - added for 3D view interaction
  selectUnitById(unitId: string): void {
    // Skip multi-select check in 3D view since we can't easily check shift key from ThreeJS
    // Just clear selection every time for now
    this.selectedUnits = [];
    
    // Find the unit
    const unit = this.unitManager.getUnit(unitId);
    if (unit && unit.playerId === this.localPlayerId) {
      // Add to selection if not already selected
      if (!this.selectedUnits.includes(unitId)) {
        this.selectedUnits.push(unitId);
        unit.setSelected(true);
      }
      
      // Update UI
      this.gameUI.updateSelection(this.selectedUnits);
    }
  }
  
  // Method to move selected units - added for 3D view interaction
  moveSelectedUnitsTo(unitIds: string[], targetX: number, targetY: number): void {
    // Validate coordinates
    if (targetX < 0 || targetX >= this.map.length || targetY < 0 || targetY >= this.map[0].length) {
      console.warn("Invalid target position in moveSelectedUnitsTo");
      return;
    }
    
    // Check if tile is walkable
    if (!this.map[targetY][targetX].walkable) {
      console.warn("Target position is not walkable");
      return;
    }
    
    // Move the units (no prediction settings - this is direct user input)
    this.unitManager.moveUnitsTo(unitIds, targetX, targetY, {});
  }
  
  /**
   * Process state updates from the server with reconciliation
   * @param changes State changes from server
   * @param timestamp Server timestamp for reconciliation
   */
  private processServerStateUpdate(changes: any, timestamp: number): void {
    if (!changes) return;
    
    // Update units based on server state
    if (changes.units) {
      Object.entries(changes.units).forEach(([unitId, unitData]: [string, any]) => {
        const unit = this.unitManager.getUnit(unitId);
        
        if (unit) {
          // If unit was marked as predicted, check if we need to correct its position
          if (unit.isPredicted) {
            // Check if the server's position is significantly different
            const serverX = unitData.x * TILE_SIZE + TILE_SIZE / 2;
            const serverY = unitData.y * TILE_SIZE + TILE_SIZE / 2;
            const positionDiff = Phaser.Math.Distance.Between(unit.x, unit.y, serverX, serverY);
            
            if (positionDiff > TILE_SIZE / 2) {
              console.log(`Correcting unit ${unitId} position due to server reconciliation`);
              
              // Server position is authoritative - snap to it
              unit.x = serverX;
              unit.y = serverY;
              unit.sprite.setPosition(unit.x, unit.y);
              
              // If the unit had a path, update it
              if (unit.isMoving && 
                  unitData.targetX !== undefined && 
                  unitData.targetY !== undefined && 
                  unitData.targetX !== null && 
                  unitData.targetY !== null) {
                const startX = Math.floor(unit.x / TILE_SIZE);
                const startY = Math.floor(unit.y / TILE_SIZE);
                const path = this.pathfindingManager.findPath(
                  startX, 
                  startY, 
                  unitData.targetX, 
                  unitData.targetY
                );
                if (path.length > 0) {
                  unit.setPath(path);
                }
              } else if (unitData.isMoving === false) {
                // Server says unit is not moving
                unit.stopMoving();
              }
            }
            
            // Clear prediction status using our new method
            unit.clearPrediction();
            console.log(`Clearing prediction for unit ${unitId} - server confirmed position`);
          }
          
          // Update unit health and other attributes
          if (unitData.health !== undefined) {
            unit.health = unitData.health;
          }
        }
      });
    }
    
    // Handle buildings
    if (changes.buildings) {
      Object.entries(changes.buildings).forEach(([buildingId, buildingData]: [string, any]) => {
        const building = this.buildingManager.getBuilding(buildingId);
        
        if (building && buildingData.health !== undefined) {
          building.health = buildingData.health;
        }
      });
    }
    
    // Update player resources
    if (changes.resources) {
      Object.entries(changes.resources).forEach(([playerId, resourceData]: [string, any]) => {
        this.resourceManager.updateResources(playerId, resourceData);
      });
    }
    
    // Update the UI to reflect any changes
    this.gameUI.updateResources();
  }
  
  // Method to start building placement mode - added for 3D view interaction
  // Building placement variables
  private buildingPreview: Phaser.GameObjects.Container | null = null;
  private buildingPlacementActive: boolean = false;
  private buildingPlacementType: string = '';
  private placementGrid: Phaser.GameObjects.Grid | null = null;
  private validPlacementIndicator: Phaser.GameObjects.Rectangle | null = null;
  private buildingSize: { width: number, height: number } = { width: 0, height: 0 };

  startBuildingPlacement(type: string): void {
    // Check if player has enough resources
    const buildingCost = this.resourceManager.getBuildingCost(type);
    if (!this.resourceManager.hasEnoughResources(
      this.localPlayerId, 
      buildingCost.food, 
      buildingCost.ore
    )) {
      this.gameUI.showMessage("Not enough resources to build " + type, 2000);
      console.warn("Not enough resources to build " + type);
      return;
    }
    
    // Get player faction
    const playerData = this.players.find(p => p.id === this.localPlayerId);
    if (!playerData) {
      console.warn("Player data not found");
      return;
    }
    
    // Clean up any existing placement mode
    this.cleanupBuildingPlacement();
    
    console.log(`Starting building placement for ${type}`);
    
    // Set building placement as active
    this.buildingPlacementActive = true;
    this.buildingPlacementType = type;
    
    // Determine building size based on type
    this.buildingSize = { width: 1, height: 1 }; // Default size
    if (type === "cityCenter") {
      this.buildingSize = { width: 2, height: 2 };
    } else if (type === "barracks" || type === "archeryRange") {
      this.buildingSize = { width: 2, height: 2 };
    }
    
    // Create grid overlay for building placement
    this.placementGrid = this.add.grid(
      0, 0, // Position will be updated in update loop
      this.map.length * TILE_SIZE, this.map[0].length * TILE_SIZE, // Size of the grid
      TILE_SIZE, TILE_SIZE, // Cell size
      0x000000, 0, // Fill color (transparent)
      0xffffff, 0.2 // Stroke color and alpha
    );
    this.placementGrid.setDepth(100); // Ensure grid is drawn above other elements
    
    // Create placement validity indicator
    this.validPlacementIndicator = this.add.rectangle(
      0, 0, // Position will be updated in update loop
      this.buildingSize.width * TILE_SIZE, this.buildingSize.height * TILE_SIZE,
      0x00ff00, 0.3 // Green for valid placement
    );
    this.validPlacementIndicator.setDepth(99); // Below grid but above other elements
    
    // Create building preview
    this.buildingPreview = this.add.container(0, 0);
    this.buildingPreview.setDepth(101); // Above everything
    
    // Add building shape based on type and faction
    const colorMain = playerData.faction === "Nephites" ? 0x2244cc : 0xcc3300;
    const shape = this.add.rectangle(
      0, 0,
      this.buildingSize.width * TILE_SIZE, this.buildingSize.height * TILE_SIZE,
      colorMain, 0.5
    );
    
    // Add label
    const label = this.add.text(0, 0, type, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    this.buildingPreview.add(shape);
    this.buildingPreview.add(label);
    
    // Show building cost
    this.gameUI.showMessage(`Click to place ${type} (Cost: ${buildingCost.food} food, ${buildingCost.ore} ore)`, 3000);
    
    // Add click handler for placement
    this.input.on('pointerdown', this.handleBuildingPlacement, this);
    
    // Add escape key to cancel placement
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ESC', this.cancelBuildingPlacement, this);
    }
  }
  
  // Update method addition for building placement preview
  private updateBuildingPlacement() {
    if (!this.buildingPlacementActive || !this.buildingPreview || !this.validPlacementIndicator || !this.placementGrid) {
      return;
    }
    
    // Get mouse position in world coordinates
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    // Convert to tile coordinates
    const tileX = Math.floor(worldPoint.x / TILE_SIZE);
    const tileY = Math.floor(worldPoint.y / TILE_SIZE);
    
    // Position the grid overlay
    this.placementGrid.setPosition(0, 0);
    
    // Position the placement indicator at the tile
    this.validPlacementIndicator.setPosition(
      tileX * TILE_SIZE + (this.buildingSize.width * TILE_SIZE) / 2,
      tileY * TILE_SIZE + (this.buildingSize.height * TILE_SIZE) / 2
    );
    
    // Position the building preview
    this.buildingPreview.setPosition(
      tileX * TILE_SIZE + (this.buildingSize.width * TILE_SIZE) / 2,
      tileY * TILE_SIZE + (this.buildingSize.height * TILE_SIZE) / 2
    );
    
    // Check if placement is valid
    const isValid = this.isValidBuildingPlacement(tileX, tileY);
    
    // Update indicator color
    this.validPlacementIndicator.fillColor = isValid ? 0x00ff00 : 0xff0000;
    this.validPlacementIndicator.alpha = isValid ? 0.3 : 0.5;
  }
  
  // Handle building placement based on mouse position
  private handleBuildingPlacement(pointer: Phaser.Input.Pointer): void {
    if (!this.buildingPlacementActive || !this.buildingPreview) return;
    
    // Get tile coordinates from pointer position
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tileX = Math.floor(worldPoint.x / TILE_SIZE);
    const tileY = Math.floor(worldPoint.y / TILE_SIZE);
    
    if (this.isValidBuildingPlacement(tileX, tileY)) {
      // Get player faction
      const playerData = this.players.find(p => p.id === this.localPlayerId);
      if (!playerData) return;
      
      // Create the building
      const building = this.buildingManager.createBuilding(
        this.localPlayerId,
        this.buildingPlacementType as any,
        tileX,
        tileY,
        playerData.faction as any
      );
      
      if (building) {
        // Deduct resources
        const buildingCost = this.resourceManager.getBuildingCost(this.buildingPlacementType);
        this.resourceManager.removeResource(this.localPlayerId, "food", buildingCost.food);
        this.resourceManager.removeResource(this.localPlayerId, "ore", buildingCost.ore);
        
        console.log(`Building ${this.buildingPlacementType} placed at ${tileX},${tileY}`);
        this.gameUI.showMessage(`${this.buildingPlacementType} constructed!`, 2000);
        
        // Clean up placement mode
        this.cleanupBuildingPlacement();
      }
    } else {
      // Show error message
      this.gameUI.showMessage("Invalid placement location", 2000);
    }
  }
  
  // Check if building placement is valid at given coordinates
  private isValidBuildingPlacement(tileX: number, tileY: number): boolean {
    // Check map bounds
    if (tileX < 0 || tileX + this.buildingSize.width > this.map.length ||
        tileY < 0 || tileY + this.buildingSize.height > this.map[0].length) {
      return false;
    }
    
    // Check all tiles in the building's footprint
    for (let y = tileY; y < tileY + this.buildingSize.height; y++) {
      for (let x = tileX; x < tileX + this.buildingSize.width; x++) {
        // Skip if out of bounds
        if (x >= this.map.length || y >= this.map[0].length) continue;
        
        // Check if tile is walkable and has no resource
        if (!this.map[y][x].walkable || this.map[y][x].resource) {
          return false;
        }
        
        // Check for other buildings or units
        const buildings = this.buildingManager.getAllBuildings();
        for (const building of buildings) {
          const buildingTileX = Math.floor(building.x / TILE_SIZE);
          const buildingTileY = Math.floor(building.y / TILE_SIZE);
          
          // Simplified collision check (could be improved with actual building sizes)
          if (Math.abs(buildingTileX - x) < 1 && Math.abs(buildingTileY - y) < 1) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  // Cancel building placement
  private cancelBuildingPlacement(): void {
    if (this.buildingPlacementActive) {
      this.gameUI.showMessage("Building placement canceled", 2000);
      this.cleanupBuildingPlacement();
    }
  }
  
  // Clean up building placement mode
  private cleanupBuildingPlacement(): void {
    // Remove event listeners
    this.input.off('pointerdown', this.handleBuildingPlacement, this);
    
    // Destroy visual elements
    if (this.buildingPreview) {
      this.buildingPreview.destroy();
      this.buildingPreview = null;
    }
    
    if (this.placementGrid) {
      this.placementGrid.destroy();
      this.placementGrid = null;
    }
    
    if (this.validPlacementIndicator) {
      this.validPlacementIndicator.destroy();
      this.validPlacementIndicator = null;
    }
    
    // Reset placement state
    this.buildingPlacementActive = false;
    this.buildingPlacementType = '';
  }
  
  /**
   * Start the tutorial sequence if this is the player's first time playing
   */
  private startTutorialIfFirstTime(): void {
    // Check if this is the first time the player has played
    const hasTutorialBeenCompleted = localStorage.getItem('tutorialCompleted') === 'true';
    
    if (!hasTutorialBeenCompleted) {
      console.log("Starting first-time tutorial");
      
      // Add a slight delay to ensure game elements are initialized
      this.time.delayedCall(1000, () => {
        this.tutorialManager.startTutorial(() => {
          // When tutorial is completed, mark it as done
          localStorage.setItem('tutorialCompleted', 'true');
          console.log("Tutorial completed");
        });
      });
    }
  }
}
