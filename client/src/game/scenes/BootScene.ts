import Phaser from "phaser";
import { loadAssets } from "../assets/assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Create loading graphics
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(240, 270, 320, 50);
    
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Loading text
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: "Loading...",
      style: {
        font: "20px monospace",
        color: "#ffffff"
      }
    });
    loadingText.setOrigin(0.5, 0.5);
    
    // Percent text
    const percentText = this.make.text({
      x: width / 2,
      y: height / 2 - 5,
      text: "0%",
      style: {
        font: "18px monospace",
        color: "#ffffff"
      }
    });
    percentText.setOrigin(0.5, 0.5);
    
    // Game title
    const titleText = this.make.text({
      x: width / 2,
      y: height / 2 - 150,
      text: "Battles of the Covenant",
      style: {
        font: "bold 32px monospace",
        color: "#ffffff"
      }
    });
    titleText.setOrigin(0.5, 0.5);
    
    // Update loading progress
    this.load.on("progress", (value: number) => {
      percentText.setText(parseInt(String(value * 100)) + "%");
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(250, 280, 300 * value, 30);
    });
    
    // Clear loading graphics when complete
    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });
    
    // Load all assets
    loadAssets(this);
  }

  create() {
    console.log("BootScene: All assets loaded!");
    this.scene.start("MainMenuScene");
  }
}
