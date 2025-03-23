import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, HelpCircle } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  completeWhen?: () => boolean;
  showSkip?: boolean;
}

interface TutorialOverlayProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onRequestHelp?: () => void;
}

/**
 * React component that provides tutorial UI overlay for first-time users
 */
export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isActive,
  onComplete,
  onSkip,
  onRequestHelp
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highlightPosition, setHighlightPosition] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Tutorial steps specifically for React UI components (not game objects)
  const steps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Book of Mormon Wars!',
      content: 'This tutorial will guide you through the basics of the game and help you get started.',
      position: 'bottom',
      showSkip: true
    },
    {
      id: 'resources',
      title: 'Resources',
      content: 'Keep an eye on your resources at the top of the screen. You need food and ore to build units and structures.',
      target: 'resource-display',
      position: 'bottom'
    },
    {
      id: 'minimap',
      title: 'Minimap',
      content: 'The minimap shows your position on the battlefield. Click anywhere on it to quickly navigate to that location.',
      target: 'minimap',
      position: 'left'
    },
    {
      id: 'unit-panel',
      title: 'Unit Management',
      content: 'When you select units, their information and available actions will appear here.',
      target: 'unit-panel',
      position: 'top'
    },
    {
      id: 'tech-tree',
      title: 'Technology Tree',
      content: 'Click here to view and research technologies that will strengthen your civilization.',
      target: 'tech-button',
      position: 'bottom'
    },
    {
      id: 'building',
      title: 'Building',
      content: 'Select a worker and click these buttons to construct buildings like Barracks and Archery Ranges.',
      target: 'building-buttons',
      position: 'right'
    },
    {
      id: 'complete',
      title: 'You\'re Ready!',
      content: 'You now know the basics of the interface. Continue playing to learn more about strategies and units. Good luck!',
      position: 'bottom'
    }
  ];

  const currentStep = steps[currentStepIndex];

  // Calculate positions when active or step changes
  useEffect(() => {
    if (!isActive) return;

    const positionTooltip = () => {
      if (!currentStep.target) {
        // Center on screen if no target
        setHighlightPosition({ left: 0, top: 0, width: 0, height: 0 });
        setTooltipPosition({
          left: window.innerWidth / 2 - 150,
          top: window.innerHeight / 2 - 100
        });
        return;
      }

      const targetElement = document.getElementById(currentStep.target);
      if (!targetElement) return;

      const targetRect = targetElement.getBoundingClientRect();
      setHighlightPosition({
        left: targetRect.left,
        top: targetRect.top,
        width: targetRect.width,
        height: targetRect.height
      });

      // Position tooltip based on specified position
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        
        let left = 0;
        let top = 0;
        
        switch (currentStep.position) {
          case 'top':
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            top = targetRect.top - tooltipRect.height - 10;
            break;
          case 'bottom':
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            top = targetRect.bottom + 10;
            break;
          case 'left':
            left = targetRect.left - tooltipRect.width - 10;
            top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
            break;
          case 'right':
            left = targetRect.right + 10;
            top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
            break;
          default:
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            top = targetRect.bottom + 10;
        }
        
        // Ensure tooltip stays within screen bounds
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
        
        setTooltipPosition({ left, top });
      }
    };

    // Initial positioning
    positionTooltip();
    
    // Reposition on window resize
    window.addEventListener('resize', positionTooltip);
    
    // Some elements might be loaded dynamically, so retry positioning after a delay
    const retryTimeout = setTimeout(positionTooltip, 500);
    
    return () => {
      window.removeEventListener('resize', positionTooltip);
      clearTimeout(retryTimeout);
    };
  }, [isActive, currentStep, currentStepIndex]);

  // Check for completion condition
  useEffect(() => {
    if (!isActive || !currentStep.completeWhen) return;
    
    const checkCompletion = () => {
      if (currentStep.completeWhen && currentStep.completeWhen()) {
        nextStep();
      }
    };
    
    const interval = setInterval(checkCompletion, 500);
    return () => clearInterval(interval);
  }, [isActive, currentStep]);

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  };

  if (!isActive) {
    // When not in tutorial mode, just show the help button
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          className="p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          onClick={onRequestHelp}
          aria-label="Help"
        >
          <HelpCircle size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Highlight around target element */}
      {currentStep.target && (
        <div
          className="absolute border-2 border-yellow-400 rounded-md animate-pulse pointer-events-none"
          style={{
            left: `${highlightPosition.left - 5}px`,
            top: `${highlightPosition.top - 5}px`,
            width: `${highlightPosition.width + 10}px`,
            height: `${highlightPosition.height + 10}px`
          }}
        />
      )}
      
      {/* Cut out around target to allow interaction */}
      {currentStep.target && (
        <div
          className="absolute bg-transparent pointer-events-auto"
          style={{
            left: `${highlightPosition.left}px`,
            top: `${highlightPosition.top}px`,
            width: `${highlightPosition.width}px`,
            height: `${highlightPosition.height}px`
          }}
        />
      )}
      
      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={tooltipRef}
          key={currentStep.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute bg-gray-800 text-white rounded-lg shadow-xl p-4 w-80 pointer-events-auto"
          style={{
            left: `${tooltipPosition.left}px`,
            top: `${tooltipPosition.top}px`
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg">{currentStep.title}</h3>
            {currentStep.showSkip && (
              <button 
                className="text-gray-400 hover:text-white"
                onClick={onSkip}
                aria-label="Skip tutorial"
              >
                <X size={18} />
              </button>
            )}
          </div>
          
          <p className="mb-4">{currentStep.content}</p>
          
          <div className="flex justify-end">
            <button
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
              onClick={nextStep}
            >
              {currentStepIndex < steps.length - 1 ? (
                <>Next <ArrowRight size={16} /></>
              ) : (
                'Finish'
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;