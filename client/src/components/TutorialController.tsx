import React, { useState, useEffect } from 'react';
import TutorialOverlay from './ui/TutorialOverlay';

interface TutorialControllerProps {
  gameInstance?: Phaser.Game;
}

/**
 * This component connects the React tutorial UI with the Phaser game instance
 * It handles showing and hiding the tutorial overlay based on game state
 */
export const TutorialController: React.FC<TutorialControllerProps> = ({ gameInstance }) => {
  const [tutorialActive, setTutorialActive] = useState(false);
  
  useEffect(() => {
    if (!gameInstance) return;
    
    const checkTutorialState = () => {
      // Get the game scene
      const gameScene = gameInstance.scene.getScene('GameScene') as any;
      
      if (gameScene && gameScene.tutorialManager) {
        const isActive = gameScene.tutorialManager.isTutorialActive();
        setTutorialActive(isActive);
      }
    };
    
    // Check tutorial state periodically
    const interval = setInterval(checkTutorialState, 500);
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [gameInstance]);
  
  const handleSkipTutorial = () => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (gameScene && gameScene.tutorialManager) {
      gameScene.tutorialManager.skipTutorial();
      setTutorialActive(false);
      
      // Mark as completed so it doesn't show again
      localStorage.setItem('tutorialCompleted', 'true');
    }
  };
  
  const handleCompleteTutorial = () => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (gameScene && gameScene.tutorialManager) {
      gameScene.tutorialManager.endTutorial();
      setTutorialActive(false);
      
      // Mark as completed so it doesn't show again
      localStorage.setItem('tutorialCompleted', 'true');
    }
  };
  
  const handleRequestHelp = () => {
    if (!gameInstance) return;
    
    const gameScene = gameInstance.scene.getScene('GameScene') as any;
    if (gameScene && gameScene.tutorialManager) {
      gameScene.tutorialManager.startTutorial();
      setTutorialActive(true);
    }
  };
  
  // We always render the component to ensure we can show the help button
  // even when tutorial is not active
  return (
    <TutorialOverlay
      isActive={tutorialActive}
      onSkip={handleSkipTutorial}
      onComplete={handleCompleteTutorial}
      onRequestHelp={handleRequestHelp}
    />
  );
};

export default TutorialController;