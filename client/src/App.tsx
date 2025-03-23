import { useEffect, useState } from "react";
import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { LobbyScene } from "./game/scenes/LobbyScene";
import { GameScene } from "./game/scenes/GameScene";
import "@fontsource/inter";
import { useMultiplayer } from "./lib/stores/useMultiplayer";

// Main App component
function App() {
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const { connectToServer } = useMultiplayer();

  useEffect(() => {
    // Connect to the socket.io server
    connectToServer();

    // Configure the game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: "game-container",
      width: window.innerWidth,
      height: window.innerHeight,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0 },
          debug: process.env.NODE_ENV === "development",
        },
      },
      scene: [BootScene, MainMenuScene, LobbyScene, GameScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: true,
        antialias: false,
      },
      audio: {
        disableWebAudio: false,
      },
      fps: {
        min: 30,
        target: 60,
      },
    };

    // Create the game instance
    const gameInstance = new Phaser.Game(config);
    setGame(gameInstance);

    // Cleanup when component unmounts
    return () => {
      if (gameInstance) {
        gameInstance.destroy(true);
      }
    };
  }, [connectToServer]);

  return (
    <div className="w-full h-full">
      {/* Game container */}
      <div id="game-container" className="w-full h-full"></div>
      
      {/* Audio elements for sound effects */}
      <audio id="background-music" src="/sounds/background.mp3" loop preload="auto"></audio>
      <audio id="hit-sound" src="/sounds/hit.mp3" preload="auto"></audio>
      <audio id="success-sound" src="/sounds/success.mp3" preload="auto"></audio>
    </div>
  );
}

export default App;
