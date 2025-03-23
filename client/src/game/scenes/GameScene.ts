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
    
    // Generate terrain
    for (let y = 0; y < MAP_SIZE; y++) {
      this.map[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        // Determine terrain type (grass is default)
        let terrainType: 'grass' | 'forest' | 'hills' | 'water' = 'grass';
        
        // Create simple terrain patterns
        const noise = Math.random();
        if (noise < 0.1) {
          terrainType = 'water';
        } else if (noise < 0.3) {
          terrainType = 'forest';
        } else if (noise < 0.4) {
          terrainType = 'hills';
        }
        
        // Create tile sprite
        let tileColor = 0x44aa44; // grass
        if (terrainType === 'forest') tileColor = 0x228822;
        if (terrainType === 'hills') tileColor = 0x888888;
        if (terrainType === 'water') tileColor = 0x2288aa;
        
        const tile = this.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, tileColor)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x000000, 0.2);
        
        groundLayer.add(tile);
        
        // Store tile data
        this.map[y][x] = {
          x,
          y,
          type: terrainType,
          walkable: terrainType !== 'water',
          resource: null
        };
        
        // Add resources with some probability
        if (terrainType !== 'water') {
          if (terrainType === 'forest' && Math.random() < 0.4) {
            this.addResource(x, y, 'food');
          } else if (terrainType === 'hills' && Math.random() < 0.6) {
            this.addResource(x, y, 'ore');
          }
        }
      }
    }
  }
  
  private addResource(x: number, y: number, type: ResourceType) {
    // Update map data
    this.map[y][x].resource = {
      type,
      amount: type === 'food' ? 300 : 500 // Ore has more resources
    };
    
    // Create resource visual
    const resourceColor = type === 'food' ? 0x22aa22 : 0x884422;
    const resourceMarker = this.add.circle(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE / 4,
      resourceColor
    );
    
    // Add text indicator
    this.add.text(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      type === 'food' ? "F" : "O",
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff"
      }
    ).setOrigin(0.5);
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
    
    // Draw terrain
    const tileRatio = this.minimapSize / (MAP_SIZE * TILE_SIZE);
    
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.map[y][x];
        let color = 0x44aa44; // grass
        
        if (tile.type === 'forest') color = 0x228822;
        if (tile.type === 'hills') color = 0x888888;
        if (tile.type === 'water') color = 0x2288aa;
        
        // Draw mini tile
        const miniTileSize = this.minimapSize / MAP_SIZE;
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
