import { useEffect, useState } from "react";
import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { LobbyScene } from "./game/scenes/LobbyScene";
import { GameScene } from "./game/scenes/GameScene";
import "@fontsource/inter";
import { useMultiplayer } from "./lib/stores/useMultiplayer";
import GameContainer from "./components/GameContainer";
import TutorialController from "./components/TutorialController";

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
          gravity: { x: 0, y: 0 },
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
      transparent: true, // Make the canvas transparent to allow React components to overlay
      backgroundColor: 'rgba(0,0,0,0)' // Transparent background
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
    <div className="w-full h-full relative overflow-hidden">
      {/* Game container for Phaser canvas */}
      <div id="game-container" className="w-full h-full absolute top-0 left-0 z-0"></div>
      
      {/* Our React Game Container with UI overlays and 3D rendering */}
      {game && <GameContainer gameInstance={game} />}
      
      {/* Tutorial controller to provide onboarding for new players */}
      {game && <TutorialController gameInstance={game} />}
      
      {/* Audio elements for sound effects */}
      <audio id="background-music" src="/sounds/background.mp3" loop preload="auto"></audio>
      <audio id="hit-sound" src="/sounds/hit.mp3" preload="auto"></audio>
      <audio id="success-sound" src="/sounds/success.mp3" preload="auto"></audio>
      <audio id="critical-hit-sound" src="/sounds/critical_hit.mp3" preload="auto"></audio>
      <audio id="counter-attack-sound" src="/sounds/counter_attack.mp3" preload="auto"></audio>
      <audio id="weakness-hit-sound" src="/sounds/weakness_hit.mp3" preload="auto"></audio>
      <audio id="death-sound" src="/sounds/death.mp3" preload="auto"></audio>
    </div>
  );
}

export default App;
