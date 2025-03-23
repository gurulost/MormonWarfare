import Phaser from "phaser";
import { FactionType, GameData, MapTile, ResourceType, UnitType } from "../types";
import { ResourceManager } from "../managers/ResourceManager";
import { UnitManager } from "../managers/UnitManager";
import { BuildingManager } from "../managers/BuildingManager";
import { PathfindingManager } from "../managers/PathfindingManager";
import { CombatManager } from "../managers/CombatManager";
import { TechManager } from "../managers/TechManager";
import { GameUI } from "../ui/GameUI";
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
  private gameUI!: GameUI;
  
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
  
  init(data: { gameData: GameData }) {
    this.gameData = data.gameData;
    this.localPlayerId = "local"; // In a real implementation, this would come from the server
    this.players = this.gameData.players.map(player => ({
      id: player.id,
      username: player.username,
      faction: player.faction as FactionType
    }));
  }
  
  create() {
    const { width, height } = this.cameras.main;
    
    // Initialize cursor keys
    this.cursorKeys = this.input.keyboard!.createCursorKeys();
    
    // Initialize the managers
    this.pathfindingManager = new PathfindingManager(this);
    this.resourceManager = new ResourceManager(this);
    this.unitManager = new UnitManager(this, this.pathfindingManager);
    this.buildingManager = new BuildingManager(this, this.unitManager);
    this.combatManager = new CombatManager(this, this.unitManager);
    this.techManager = new TechManager(this);
    
    // Generate the map
    this.generateMap();
    
    // Set up camera
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
    
    // Initialize starting units and buildings for each player
    this.initializePlayersStartingEntities();
    
    // Setup multiplayer event listeners
    this.setupMultiplayerEvents();
    
    // Play background music if enabled
    const audioStore = useAudio.getState();
    if (audioStore.backgroundMusic && !audioStore.isMuted) {
      audioStore.backgroundMusic.play().catch(e => console.log("Music play prevented:", e));
    }
    
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
    
    // Update minimap
    this.updateMinimap();
    
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
  
  private updateCameraPosition(delta: number) {
    const camera = this.cameras.main;
    const speed = CAMERA_SPEED * (delta / 16);
    
    // Keyboard movement
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
    
    // Edge scrolling
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
  
  private setupSelectionEvents() {
    // Start selection
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
        
        // Check if clicked on a resource
        if (this.map[targetY][targetX].resource) {
          this.unitManager.orderUnitsToGatherResource(this.selectedUnits, targetX, targetY);
        } else {
          // Move units to target position
          this.unitManager.moveUnitsTo(this.selectedUnits, targetX, targetY);
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
        
        // Clear previous selection
        this.selectedUnits = [];
        
        // Select all units within bounds
        this.selectedUnits = this.unitManager.selectUnitsInBounds(bounds, this.localPlayerId);
        
        // If no units were selected with the rectangle, try to select a single unit
        if (this.selectedUnits.length === 0 && bounds.width < 5 && bounds.height < 5) {
          const worldX = pointer.worldX;
          const worldY = pointer.worldY;
          const clickedUnit = this.unitManager.selectUnitAtPosition(worldX, worldY, this.localPlayerId);
          
          if (clickedUnit) {
            this.selectedUnits = [clickedUnit];
          }
        }
        
        // Update UI with selection
        this.gameUI.updateSelection(this.selectedUnits);
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
    }
  }
  
  private setupMultiplayerEvents() {
    // In a real implementation, this would connect to Socket.io events
    const multiplayerStore = useMultiplayer.getState();
    
    // Listen for unit movement commands
    multiplayerStore.subscribeToGameEvents((event: any) => {
      console.log("Received multiplayer event:", event);
      
      // Handle different event types
      if (event.type === 'unitMove') {
        this.unitManager.moveUnitsTo(event.unitIds, event.targetX, event.targetY, true);
      } else if (event.type === 'unitCreate') {
        this.unitManager.createUnit(event.playerId, event.unitType, event.x, event.y, true);
      } else if (event.type === 'buildingCreate') {
        this.buildingManager.createBuilding(event.playerId, event.buildingType, event.x, event.y, true);
      } else if (event.type === 'resourceUpdate') {
        this.resourceManager.updateResources(event.playerId, event.resources);
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
}
