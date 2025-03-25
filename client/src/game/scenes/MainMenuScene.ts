import Phaser from "phaser";
import { useMultiplayer } from "../../lib/stores/useMultiplayer";
import { useAudio } from "../../lib/stores/useAudio";

export class MainMenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private soloButton!: Phaser.GameObjects.Text;
  private multiplayerButton!: Phaser.GameObjects.Text;
  private joinButton!: Phaser.GameObjects.Text;
  private howToPlayButton!: Phaser.GameObjects.Text;
  private musicToggleButton!: Phaser.GameObjects.Text;
  private roomCodeInput!: Phaser.GameObjects.DOMElement;
  private musicOn: boolean = false;
  
  constructor() {
    super("MainMenuScene");
  }

  create() {
    const { width, height } = this.cameras.main;
    
    // Set background
    this.add.rectangle(0, 0, width, height, 0x000000)
      .setOrigin(0, 0)
      .setAlpha(0.7);
    
    // Create title text
    this.title = this.add.text(width / 2, height / 5, "BATTLES OF THE COVENANT", {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
      align: "center"
    }).setOrigin(0.5);
    
    // Create subtitle
    this.add.text(width / 2, height / 5 + 60, "A Book of Mormon RTS Game", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#eeeeee",
      align: "center"
    }).setOrigin(0.5);
    
    // Create solo play button
    this.soloButton = this.add.text(width / 2, height / 2 - 60, "SOLO GAME", {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.soloButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.soloButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => {
        this.soloGameClicked();
      });
    
    // Create host multiplayer button
    this.multiplayerButton = this.add.text(width / 2, height / 2, "HOST MULTIPLAYER GAME", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.multiplayerButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.multiplayerButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => {
        this.hostMultiplayerClicked();
      });
    
    // Create join game button
    this.joinButton = this.add.text(width / 2 + 120, height / 2 + 60, "JOIN GAME", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.joinButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.joinButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => {
        this.joinGameClicked();
      });
    
    // Create input for room code
    // Add a text label for the room code
    this.add.text(width / 2 - 140, height / 2 + 60, "ROOM CODE:", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(1, 0.5);
    
    // Create HTML input for room code
    const inputElement = document.createElement('input');
    inputElement.style.width = '100px';
    inputElement.style.height = '30px';
    inputElement.style.fontSize = '18px';
    inputElement.style.textAlign = 'center';
    inputElement.style.fontFamily = 'monospace';
    inputElement.maxLength = 6;
    
    this.roomCodeInput = this.add.dom(width / 2 - 80, height / 2 + 60, inputElement)
      .setOrigin(0, 0.5);
    
    // Create how to play button
    this.howToPlayButton = this.add.text(width / 2, height / 2 + 120, "HOW TO PLAY", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#4a6c6f",
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.howToPlayButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.howToPlayButton.setStyle({ color: "#ffffff" }))
      .on("pointerdown", () => {
        this.howToPlayButtonClicked();
      });
    
    // Create music toggle button
    this.musicToggleButton = this.add.text(width / 2, height / 2 + 180, "MUSIC: OFF", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#dddddd",
      padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.musicToggleButton.setStyle({ color: "#ffff00" }))
      .on("pointerout", () => this.musicToggleButton.setStyle({ color: "#dddddd" }))
      .on("pointerdown", () => {
        this.toggleMusic();
      });
    
    // Credits text
    this.add.text(width / 2, height - 50, "Based on Book of Mormon War Chapters", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#aaaaaa"
    }).setOrigin(0.5);
    
    // Initialize background music
    this.initializeBackgroundMusic();
  }
  
  private soloGameClicked() {
    console.log("Solo game selected");
    // Create a solo game with an AI opponent
    this.startSoloGame();
  }
  
  private hostMultiplayerClicked() {
    console.log("Host multiplayer game selected");
    this.scene.start("LobbyScene");
  }
  
  private joinGameClicked() {
    const inputElement = this.roomCodeInput.getChildByName('input') as HTMLInputElement;
    const roomCode = inputElement ? inputElement.value.toUpperCase() : '';
    
    if (roomCode && roomCode.length === 6) {
      console.log(`Joining game with room code: ${roomCode}`);
      this.scene.start("LobbyScene", { roomCode });
    } else {
      // Show error message for invalid room code
      this.showMessage("Please enter a valid 6-character room code", 0xff0000);
    }
  }
  
  private showMessage(text: string, color: number = 0xffffff) {
    const { width, height } = this.cameras.main;
    const message = this.add.text(width / 2, height - 100, text, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: color === 0xffffff ? "#ffffff" : "#ff0000",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: message,
      alpha: 0,
      duration: 2000,
      delay: 1500,
      onComplete: () => message.destroy()
    });
  }
  
  private startSoloGame() {
    // Create a game with the player as Nephites and AI as Lamanites
    const gameData = {
      players: [
        { id: "local", username: "Player", faction: "Nephites", ready: true },
        { id: "ai", username: "AI Opponent", faction: "Lamanites", ready: true }
      ],
      roomCode: "SOLO",
      map: "standard"
    };
    
    // Start the game directly
    this.scene.start("GameScene", { gameData, isSolo: true });
  }
  
  private howToPlayButtonClicked() {
    console.log("How to Play button clicked");
    
    // Create a semi-transparent background for the instructions
    const { width, height } = this.cameras.main;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0)
      .setInteractive();
    
    // Instructions text
    const instructions = [
      "HOW TO PLAY",
      "",
      "1. Gather resources (Food and Ore) using Worker units",
      "2. Build structures to produce more units",
      "3. Train military units to defend and attack",
      "4. Upgrade your technology to unlock stronger units",
      "5. Defeat your opponents by destroying their City Center",
      "",
      "CONTROLS:",
      "- Left-click to select units",
      "- Right-click to move selected units",
      "- Drag to select multiple units",
      "- Use the UI to build structures and train units"
    ];
    
    const instructionsText = this.add.text(width / 2, height / 2, instructions, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      align: "center",
      lineSpacing: 10
    }).setOrigin(0.5);
    
    // Close button
    const closeButton = this.add.text(width / 2, height - 100, "CLOSE", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#aa3333",
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        overlay.destroy();
        instructionsText.destroy();
        closeButton.destroy();
      });
  }
  
  private initializeBackgroundMusic() {
    try {
      // Get the HTML audio elements
      const musicElement = document.getElementById("background-music") as HTMLAudioElement;
      const hitSoundElement = document.getElementById("hit-sound") as HTMLAudioElement;
      const successSoundElement = document.getElementById("success-sound") as HTMLAudioElement;
      const criticalHitSoundElement = document.getElementById("critical-hit-sound") as HTMLAudioElement;
      const counterAttackSoundElement = document.getElementById("counter-attack-sound") as HTMLAudioElement;
      const weaknessHitSoundElement = document.getElementById("weakness-hit-sound") as HTMLAudioElement;
      const deathSoundElement = document.getElementById("death-sound") as HTMLAudioElement;

      // Set up the audio store
      const audioStore = useAudio.getState();

      // Only set audio elements that exist
      if (musicElement) {
        console.log("Background music found");
        audioStore.setBackgroundMusic(musicElement);
      }

      if (hitSoundElement) {
        console.log("Hit sound found");
        audioStore.setHitSound(hitSoundElement);
      }

      if (successSoundElement) {
        console.log("Success sound found");
        audioStore.setSuccessSound(successSoundElement);
      }

      // Set up enhanced combat sounds with proper fallbacks
      // Critical hit can fall back to regular hit sound
      if (criticalHitSoundElement) {
        console.log("Critical hit sound found");
        criticalHitSoundElement.volume = 0.4;
        audioStore.setCriticalHitSound(criticalHitSoundElement);
      } else if (hitSoundElement) {
        console.log("Using hit sound for critical hits");
        audioStore.setCriticalHitSound(hitSoundElement);
      }

      // Counter attack can fall back to hit sound
      if (counterAttackSoundElement) {
        console.log("Counter attack sound found");
        counterAttackSoundElement.volume = 0.4;
        audioStore.setCounterAttackSound(counterAttackSoundElement);
      } else if (hitSoundElement) {
        console.log("Using hit sound for counter attacks");
        audioStore.setCounterAttackSound(hitSoundElement);
      }

      // Weakness hit can fall back to hit sound
      if (weaknessHitSoundElement) {
        console.log("Weakness hit sound found");
        weaknessHitSoundElement.volume = 0.3;
        audioStore.setWeaknessHitSound(weaknessHitSoundElement);
      } else if (hitSoundElement) {
        console.log("Using hit sound for weakness hits");
        audioStore.setWeaknessHitSound(hitSoundElement);
      }

      // Death sound can fall back to hit sound
      if (deathSoundElement) {
        console.log("Death sound found");
        deathSoundElement.volume = 0.35;
        audioStore.setDeathSound(deathSoundElement);
      } else if (hitSoundElement) {
        console.log("Using hit sound for death effects");
        audioStore.setDeathSound(hitSoundElement);
      }

      console.log("Combat sound effects initialized");
    } catch (error) {
      console.error("Error initializing audio:", error);
    }
  }
  
  private toggleMusic() {
    const audioStore = useAudio.getState();
    audioStore.toggleMute();
    
    // Update button text
    this.musicOn = !this.musicOn;
    this.musicToggleButton.setText(`MUSIC: ${this.musicOn ? "ON" : "OFF"}`);
    
    // Play or pause background music
    const backgroundMusic = audioStore.backgroundMusic;
    if (backgroundMusic) {
      if (this.musicOn) {
        backgroundMusic.play().catch(e => console.log("Music play prevented:", e));
      } else {
        backgroundMusic.pause();
      }
    }
  }
}
