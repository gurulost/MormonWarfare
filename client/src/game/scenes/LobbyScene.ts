import Phaser from "phaser";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { FactionType } from "../types";

export class LobbyScene extends Phaser.Scene {
  private roomCode: string = "";
  private players: { id: string; username: string; faction: FactionType | null; ready: boolean }[] = [];
  private localPlayerIndex: number = -1;
  private roomCodeText!: Phaser.GameObjects.Text;
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private factionButtons: Phaser.GameObjects.Container[] = [];
  private readyButton!: Phaser.GameObjects.Text;
  private isReady: boolean = false;
  private startButton!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Text;
  
  constructor() {
    super("LobbyScene");
  }
  
  create() {
    const { width, height } = this.cameras.main;
    
    // Set background
    this.add.rectangle(0, 0, width, height, 0x000022)
      .setOrigin(0, 0)
      .setAlpha(0.8);
    
    // Create title
    this.add.text(width / 2, 50, "GAME LOBBY", {
      fontFamily: "monospace",
      fontSize: "36px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    
    // Create room code display
    this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.roomCodeText = this.add.text(width / 2, 100, `ROOM CODE: ${this.roomCode}`, {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffff00",
      align: "center"
    }).setOrigin(0.5);
    
    // Initialize player list
    const username = "Player" + Math.floor(Math.random() * 1000);
    this.players = [
      { id: "local", username, faction: null, ready: false }
    ];
    this.localPlayerIndex = 0;
    
    // Add UI for player list
    this.createPlayerList();
    
    // Create faction selection buttons
    this.createFactionButtons();
    
    // Create ready button
    this.readyButton = this.add.text(width / 2, height - 180, "READY", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#ffffff",
      backgroundColor: "#444444",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.readyButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.readyButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => {
        this.toggleReady();
      });
    
    // Create start button (initially disabled)
    this.startButton = this.add.text(width / 2, height - 120, "START GAME", {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#777777",
      backgroundColor: "#333333",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setAlpha(0.5);
    
    // Create back button
    this.backButton = this.add.text(100, height - 70, "BACK", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#aa3333",
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.backButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.backButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => {
        this.scene.start("MainMenuScene");
      });
    
    // Connect to multiplayer and listen for events
    this.setupMultiplayerListeners();
    
    // For demo/testing, add some fake players
    this.addFakePlayersForDemo();
  }
  
  private createPlayerList() {
    const { width } = this.cameras.main;
    
    // Clear existing texts
    this.playerListTexts.forEach(text => text.destroy());
    this.playerListTexts = [];
    
    // Create player list header
    this.add.text(width / 2, 150, "PLAYERS", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    
    // Create player list entries
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      const isLocal = i === this.localPlayerIndex;
      
      const factionText = player.faction ? ` (${player.faction})` : " (No Faction)";
      const readyText = player.ready ? " [READY]" : " [NOT READY]";
      const localIndicator = isLocal ? " (You)" : "";
      
      const playerText = this.add.text(
        width / 2,
        200 + i * 40,
        `${player.username}${localIndicator}${factionText}${readyText}`,
        {
          fontFamily: "monospace",
          fontSize: "18px",
          color: isLocal ? "#ffff00" : "#ffffff",
          align: "center"
        }
      ).setOrigin(0.5);
      
      this.playerListTexts.push(playerText);
    }
  }
  
  private createFactionButtons() {
    const { width } = this.cameras.main;
    
    // Clear existing buttons
    this.factionButtons.forEach(button => button.destroy());
    this.factionButtons = [];
    
    // Create faction selection label
    this.add.text(width / 2, 350, "SELECT YOUR FACTION", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    
    // Create Nephite faction button
    const nephiteButton = this.createFactionButton(
      width / 2 - 150,
      420,
      "NEPHITES",
      "Balanced forces with defensive bonuses",
      0x2244aa
    );
    nephiteButton.setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.selectFaction("Nephites");
      });
    this.factionButtons.push(nephiteButton);
    
    // Create Lamanite faction button
    const lamaniteButton = this.createFactionButton(
      width / 2 + 150,
      420,
      "LAMANITES",
      "Strong melee units with resource bonus",
      0xaa2222
    );
    lamaniteButton.setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.selectFaction("Lamanites");
      });
    this.factionButtons.push(lamaniteButton);
  }
  
  private createFactionButton(x: number, y: number, title: string, description: string, color: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    // Background
    const bg = this.add.rectangle(0, 0, 220, 100, color, 0.8)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff);
    
    // Title
    const titleText = this.add.text(0, -30, title, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    
    // Description
    const descText = this.add.text(0, 5, description, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 200 }
    }).setOrigin(0.5);
    
    // Add elements to container
    container.add([bg, titleText, descText]);
    
    return container;
  }
  
  private selectFaction(faction: FactionType) {
    if (this.isReady) return; // Can't change faction when ready
    
    // Update local player's faction
    this.players[this.localPlayerIndex].faction = faction;
    
    // Update the UI
    this.createPlayerList();
    
    console.log(`Selected faction: ${faction}`);
    
    // Send to server (in real implementation)
    const multiplayerStore = useMultiplayer.getState();
    multiplayerStore.updateFaction(faction);
    
    // Check if we can enable the ready button
    this.updateReadyButtonState();
  }
  
  private toggleReady() {
    // Toggle ready state
    this.isReady = !this.isReady;
    this.players[this.localPlayerIndex].ready = this.isReady;
    
    // Update button appearance
    if (this.isReady) {
      this.readyButton.setStyle({ backgroundColor: "#22aa22" }).setText("READY ✓");
    } else {
      this.readyButton.setStyle({ backgroundColor: "#444444" }).setText("READY");
    }
    
    // Update player list
    this.createPlayerList();
    
    // Send to server (in real implementation)
    const multiplayerStore = useMultiplayer.getState();
    multiplayerStore.updateReadyState(this.isReady);
    
    // Check if we can start the game
    this.updateStartButtonState();
  }
  
  private updateReadyButtonState() {
    const localPlayer = this.players[this.localPlayerIndex];
    
    // Enable ready button only if faction is selected
    if (localPlayer.faction) {
      this.readyButton.setAlpha(1);
      this.readyButton.setInteractive({ useHandCursor: true });
    } else {
      this.readyButton.setAlpha(0.5);
      this.readyButton.disableInteractive();
    }
  }
  
  private updateStartButtonState() {
    // Check if all players are ready and have selected factions
    const allReady = this.players.every(player => player.ready && player.faction);
    const enoughPlayers = this.players.length >= 2;
    
    if (allReady && enoughPlayers) {
      this.startButton.setStyle({ color: "#ffffff", backgroundColor: "#22aa22" });
      this.startButton.setAlpha(1);
      this.startButton.setInteractive({ useHandCursor: true })
        .on("pointerover", () => this.startButton.setStyle({ color: "#ffff00", backgroundColor: "#22aa22" }))
        .on("pointerout", () => this.startButton.setStyle({ color: "#ffffff", backgroundColor: "#22aa22" }))
        .on("pointerdown", () => {
          this.startGame();
        });
    } else {
      this.startButton.setStyle({ color: "#777777", backgroundColor: "#333333" });
      this.startButton.setAlpha(0.5);
      this.startButton.disableInteractive();
    }
  }
  
  private startGame() {
    console.log("Starting game...");
    
    // Prepare game data
    const gameData = {
      players: this.players,
      roomCode: this.roomCode,
      map: "standard" // Default map
    };
    
    // Start the game scene
    this.scene.start("GameScene", { gameData });
  }
  
  private setupMultiplayerListeners() {
    // In a real implementation, you would connect to Socket.io
    // and listen for player join/leave events
    const multiplayerStore = useMultiplayer.getState();
    multiplayerStore.joinRoom(this.roomCode);
    
    // Listen for player updates from the store
    useMultiplayer.subscribe(
      state => state.players,
      (players) => {
        if (players.length > 0) {
          this.players = players;
          this.createPlayerList();
          this.updateStartButtonState();
        }
      }
    );
  }
  
  private addFakePlayersForDemo() {
    // For testing/demo purposes only
    setTimeout(() => {
      this.players.push({ id: "player2", username: "Opponent1", faction: "Lamanites", ready: true });
      this.createPlayerList();
      this.updateStartButtonState();
    }, 2000);
  }
}
