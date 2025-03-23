import React from 'react';
import GameIntegration from './GameIntegration';

interface GameContainerProps {
  gameInstance?: Phaser.Game;
}

/**
 * Container component that wraps our enhanced game UI
 * This provides a simple interface to inject the game instance
 * into our GameIntegration component with all the fancy UI
 */
export const GameContainer: React.FC<GameContainerProps> = ({ gameInstance }) => {
  return (
    <div className="w-full h-full relative">
      {/* Enhanced Game Integration with improved HUD and 3D overlay */}
      {gameInstance && <GameIntegration gameInstance={gameInstance} />}
    </div>
  );
};

export default GameContainer;