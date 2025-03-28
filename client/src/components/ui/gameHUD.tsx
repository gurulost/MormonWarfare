import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/lib/stores/useGame";
import { useAudio } from "@/lib/stores/useAudio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Icons
import { 
  Sword, 
  Shield, 
  Building2, 
  Users, 
  Cpu, 
  AreaChart, 
  TreePine, 
  Mountain, 
  Combine,
  Map as MapIcon,
  Settings,
  Camera,
  VolumeX,
  Volume2,
  Grid3x3,
  HelpCircle,
  Zap,
  BookOpen,
  Cog, 
  Star,
  GanttChart,
  Code2,
  Wheat,
  Coins
} from "lucide-react";

// Add global type definition for gameInstance for TypeScript compatibility
declare global {
  interface Window {
    gameInstance?: any;
  }
}

interface ResourceData {
  food: number;
  ore: number;
}

interface MiniMapProps {
  mapData: any[][];
  mapSize: number;
  units: any[];
  buildings: any[];
  playerFaction: string;
  localPlayerId: string;
  cameraPosition: { x: number; y: number; width: number; height: number };
  onClick: (x: number, y: number) => void;
}

// Component for the fixed minimap in the corner
const MiniMap: React.FC<MiniMapProps> = ({ 
  mapData, 
  mapSize, 
  units, 
  buildings, 
  playerFaction, 
  localPlayerId,
  cameraPosition,
  onClick 
}) => {
  const mapCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [pingPosition, setPingPosition] = useState<{x: number, y: number, alpha: number} | null>(null);
  const [pingHistory, setPingHistory] = useState<{x: number, y: number, timestamp: number, player?: string}[]>([]);
  const [rightClickMenuPosition, setRightClickMenuPosition] = useState<{x: number, y: number, mapX: number, mapY: number} | null>(null);
  
  // Auto-fade pings
  useEffect(() => {
    if (pingPosition) {
      const interval = setInterval(() => {
        setPingPosition(prev => {
          if (!prev) return null;
          if (prev.alpha <= 0.1) return null;
          return {...prev, alpha: prev.alpha - 0.1};
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [pingPosition]);
  
  // Clean up old pings
  useEffect(() => {
    if (pingHistory.length > 0) {
      const interval = setInterval(() => {
        const now = Date.now();
        setPingHistory(prev => prev.filter(ping => now - ping.timestamp < 5000));
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [pingHistory]);
  
  // Draw map and units on canvas
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate tile size
    const tileSize = canvas.width / mapSize;
    
    // Draw terrain
    if (mapData && mapData.length > 0) {
      for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
          if (!mapData[y] || !mapData[y][x]) continue;
          
          const tile = mapData[y][x];
          
          // Set color based on terrain type
          if (tile.type === 'grass') ctx.fillStyle = '#44aa44';
          else if (tile.type === 'forest') ctx.fillStyle = '#228822';
          else if (tile.type === 'hills') ctx.fillStyle = '#888888';
          else if (tile.type === 'water') ctx.fillStyle = '#2288aa';
          else ctx.fillStyle = '#44aa44'; // default
          
          // Draw tile
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          
          // Draw resources
          if (tile.resource) {
            ctx.fillStyle = tile.resource.type === 'food' ? '#22aa22' : '#884422';
            ctx.fillRect(
              x * tileSize + tileSize * 0.25,
              y * tileSize + tileSize * 0.25,
              tileSize * 0.5,
              tileSize * 0.5
            );
          }
        }
      }
    }
    
    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;
      
      for (let x = 0; x <= mapSize; x++) {
        const pixelX = x * tileSize;
        ctx.beginPath();
        ctx.moveTo(pixelX, 0);
        ctx.lineTo(pixelX, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= mapSize; y++) {
        const pixelY = y * tileSize;
        ctx.beginPath();
        ctx.moveTo(0, pixelY);
        ctx.lineTo(canvas.width, pixelY);
        ctx.stroke();
      }
    }
    
    // Draw units
    if (units && units.length > 0) {
      for (const unit of units) {
        // Draw dot for each unit, color based on faction/player
        ctx.fillStyle = unit.playerId === localPlayerId ? '#00ff00' : '#ff0000';
        
        // Calculate position
        const x = unit.x / mapSize * canvas.width;
        const y = unit.y / mapSize * canvas.width;
        
        // Draw unit dot
        ctx.beginPath();
        ctx.arc(x, y, tileSize * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw buildings
    if (buildings && buildings.length > 0) {
      for (const building of buildings) {
        // Draw rectangle for each building, color based on faction/player
        ctx.fillStyle = building.playerId === localPlayerId ? '#00ffff' : '#ff00ff';
        
        // Calculate position
        const x = building.x / mapSize * canvas.width;
        const y = building.y / mapSize * canvas.width;
        
        // Draw building square
        ctx.fillRect(
          x - tileSize * 0.8,
          y - tileSize * 0.8,
          tileSize * 1.6,
          tileSize * 1.6
        );
      }
    }
    
    // Draw camera view rectangle
    if (cameraPosition) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        cameraPosition.x / mapSize * canvas.width,
        cameraPosition.y / mapSize * canvas.width,
        cameraPosition.width / mapSize * canvas.width,
        cameraPosition.height / mapSize * canvas.width
      );
    }
    
    // Draw active ping
    if (pingPosition) {
      // Draw ping animation
      const { x, y, alpha } = pingPosition;
      const pingSize = 12;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      
      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, pingSize, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, pingSize/3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
      
      ctx.restore();
    }
    
    // Draw recent pings history
    if (pingHistory.length > 0) {
      pingHistory.forEach(ping => {
        const timeElapsed = Date.now() - ping.timestamp;
        const alpha = Math.max(0, 1 - (timeElapsed / 5000));
        const pingX = ping.x / mapSize * canvas.width;
        const pingY = ping.y / mapSize * canvas.width;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Outer ring
        ctx.beginPath();
        ctx.arc(pingX, pingY, 8, 0, Math.PI * 2);
        ctx.strokeStyle = ping.player === localPlayerId ? '#00ffff' : '#ff9900';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner dot
        ctx.beginPath();
        ctx.arc(pingX, pingY, 3, 0, Math.PI * 2);
        ctx.fillStyle = ping.player === localPlayerId ? '#00ffff' : '#ff9900';
        ctx.fill();
        
        ctx.restore();
      });
    }
    
  }, [mapData, mapSize, units, buildings, playerFaction, localPlayerId, cameraPosition, showGrid, pingPosition, pingHistory]);
  
  // Handle minimap clicks to move camera
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Close right-click menu if it's open
    if (rightClickMenuPosition) {
      setRightClickMenuPosition(null);
      return;
    }
    
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    
    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to map coordinates
    const mapX = Math.floor((x / canvas.width) * mapSize);
    const mapY = Math.floor((y / canvas.height) * mapSize);
    
    // Create ping animation at click point
    setPingPosition({
      x: x,
      y: y,
      alpha: 1.0
    });
    
    // Add to ping history for multiplayer
    setPingHistory(prev => [
      ...prev, 
      {
        x: mapX,
        y: mapY,
        timestamp: Date.now(),
        player: localPlayerId
      }
    ]);
    
    // Trigger click handler
    onClick(mapX, mapY);
  };
  
  // Handle right-click for context menu
  const handleRightClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    
    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to map coordinates
    const mapX = Math.floor((x / canvas.width) * mapSize);
    const mapY = Math.floor((y / canvas.height) * mapSize);
    
    // Show context menu
    setRightClickMenuPosition({
      x: x,
      y: y,
      mapX: mapX,
      mapY: mapY
    });
  };
  
  // Handle command from right-click menu
  const handleCommand = (command: string) => {
    if (!rightClickMenuPosition) return;
    
    const { mapX, mapY } = rightClickMenuPosition;
    
    // Create ping animation at command point
    setPingPosition({
      x: rightClickMenuPosition.x,
      y: rightClickMenuPosition.y,
      alpha: 1.0
    });
    
    // Add to ping history for multiplayer with command type
    setPingHistory(prev => [
      ...prev, 
      {
        x: mapX,
        y: mapY,
        timestamp: Date.now(),
        player: localPlayerId
      }
    ]);
    
    // Dispatch command based on type
    const phaserEvents = window.gameInstance?.registry.get('reactEvents');
    
    if (command === 'move') {
      onClick(mapX, mapY); // Use the existing click handler for basic move
    } else if (command === 'attack') {
      // Additional command for attack-move
      const customEvent = new CustomEvent('minimapAttackMove', { 
        detail: { x: mapX, y: mapY } 
      });
      document.dispatchEvent(customEvent);
    } else if (command === 'ping') {
      // Just keep the ping visual, no additional command
    }
    
    // Close menu
    setRightClickMenuPosition(null);
  };
  
  return (
    <div className="bg-black/60 backdrop-blur-sm p-1 rounded-md shadow-lg overflow-hidden relative">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="text-xs font-bold text-white/80 flex items-center">
          <MapIcon size={12} className="mr-1" /> Minimap
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3x3 size={10} className={`${showGrid ? 'text-white' : 'text-white/60'}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">Toggle grid</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <canvas 
        ref={mapCanvasRef} 
        width={150} 
        height={150} 
        className="rounded-sm cursor-pointer"
        onClick={handleClick}
        onContextMenu={handleRightClick}
        aria-label="Game minimap - click to navigate"
      />
      
      {/* Right-click context menu */}
      {rightClickMenuPosition && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded text-white text-xs z-50 overflow-hidden"
          style={{
            left: rightClickMenuPosition.x,
            top: rightClickMenuPosition.y,
          }}
        >
          <div className="flex flex-col">
            <button 
              className="px-3 py-1.5 text-left hover:bg-blue-700/50 flex items-center whitespace-nowrap"
              onClick={() => handleCommand('move')}
            >
              <svg className="w-3 h-3 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Move here
            </button>
            <button 
              className="px-3 py-1.5 text-left hover:bg-red-700/50 flex items-center whitespace-nowrap"
              onClick={() => handleCommand('attack')}
            >
              <Sword className="w-3 h-3 mr-1.5" />
              Attack-move here
            </button>
            <button 
              className="px-3 py-1.5 text-left hover:bg-yellow-700/50 flex items-center whitespace-nowrap"
              onClick={() => handleCommand('ping')}
            >
              <Zap className="w-3 h-3 mr-1.5" />
              Ping
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Component for displaying resources with animations
const ResourceDisplay: React.FC<{ resources: ResourceData }> = ({ resources }) => {
  const [prevResources, setPrevResources] = useState<ResourceData>(resources);
  const [isIncreasing, setIsIncreasing] = useState({ food: false, ore: false });
  
  // Detect resource changes for animations
  useEffect(() => {
    if (resources.food > prevResources.food) {
      setIsIncreasing(prev => ({ ...prev, food: true }));
      setTimeout(() => setIsIncreasing(prev => ({ ...prev, food: false })), 1500);
    }
    
    if (resources.ore > prevResources.ore) {
      setIsIncreasing(prev => ({ ...prev, ore: true }));
      setTimeout(() => setIsIncreasing(prev => ({ ...prev, ore: false })), 1500);
    }
    
    setPrevResources(resources);
  }, [resources, prevResources]);
  
  return (
    <div className="flex gap-4 items-center">
      <motion.div
        className="flex items-center"
        animate={isIncreasing.food ? { y: [0, -5, 0], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        <TreePine className="mr-2 text-green-400" size={20} />
        <span className="font-bold">Food: {resources.food}</span>
      </motion.div>
      
      <motion.div
        className="flex items-center"
        animate={isIncreasing.ore ? { y: [0, -5, 0], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        <Mountain className="mr-2 text-gray-400" size={20} />
        <span className="font-bold">Ore: {resources.ore}</span>
      </motion.div>
    </div>
  );
};

// Tooltips for unit/building cards with detailed information
// Define a more specific unit type interface later if needed
const UnitTooltip: React.FC<{ unit: any }> = ({ unit }) => {
  return (
    <div className="p-2 max-w-xs">
      <h4 className="font-bold capitalize mb-1">{unit.type}</h4>
      <p className="text-xs mb-2">Role: {getUnitRole(unit.type)}</p>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>Health: {unit.health}/{unit.maxHealth}</div>
        <div>Attack: {unit.attack}</div>
        <div>Defense: {unit.defense}</div>
        <div>Speed: {unit.speed.toFixed(1)}</div>
        <div>Range: {unit.range}</div>
      </div>
      
      {getUnitCounters(unit.type) && (
        <div className="mt-2 text-xs">
          <p className="font-semibold">Strong against:</p>
          <p>{getUnitCounters(unit.type)}</p>
        </div>
      )}
      
      {getUnitWeaknesses(unit.type) && (
        <div className="mt-1 text-xs">
          <p className="font-semibold">Weak against:</p>
          <p>{getUnitWeaknesses(unit.type)}</p>
        </div>
      )}
    </div>
  );
};

// Helper functions to get unit details
function getUnitRole(type: string): string {
  switch (type) {
    case 'worker': return 'Resource gatherer';
    case 'melee': return 'Front-line fighter';
    case 'ranged': return 'Deals damage from distance';
    case 'cavalry': return 'Fast attacker, flanking unit';
    case 'hero': return 'Powerful leader unit with special abilities';
    default: return 'Unknown';
  }
}

function getUnitCounters(type: string): string | null {
  switch (type) {
    case 'melee': return 'Ranged units';
    case 'ranged': return 'Cavalry units';
    case 'cavalry': return 'Melee units';
    case 'hero': return 'Combined forces, concentrated attacks';
    default: return null;
  }
}

function getUnitWeaknesses(type: string): string | null {
  switch (type) {
    case 'melee': return 'Cavalry units';
    case 'ranged': return 'Melee units';
    case 'cavalry': return 'Ranged units';
    case 'worker': return 'Any combat unit';
    default: return null;
  }
}

// Component for camera controls panel
const CameraControls: React.FC<{ onViewChange: (view: string) => void }> = ({ onViewChange }) => {
  return (
    <div className="bg-black/60 backdrop-blur-sm p-2 rounded-md text-white shadow-lg">
      <h4 className="text-xs font-bold mb-2 flex items-center">
        <Camera size={12} className="mr-1" /> Camera Controls
      </h4>
      <div className="grid grid-cols-2 gap-1">
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs"
          onClick={() => onViewChange('strategic')}
        >
          Strategic View
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs"
          onClick={() => onViewChange('overhead')}
        >
          Overhead View
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs col-span-2"
          onClick={() => onViewChange('toggle')}
        >
          Toggle Perspective/Orthographic
        </Button>
      </div>
    </div>
  );
};

// Component for quick keyboard shortcuts help
const ShortcutsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <Card className="absolute right-4 top-20 z-50 w-64 shadow-xl bg-black/80 backdrop-blur-md text-white">
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Keyboard Shortcuts</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            ✕
          </Button>
        </div>
        <Separator className="my-2 opacity-30" />
        <div className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <span>Select Units:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Click & Drag</kbd>
          </div>
          <div className="flex justify-between">
            <span>Move Units:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Right Click</kbd>
          </div>
          <div className="flex justify-between">
            <span>Tech Tree:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">T</kbd>
          </div>
          <div className="flex justify-between">
            <span>Camera Rotate:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">R</kbd>
          </div>
          <div className="flex justify-between">
            <span>Strategic View:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">V</kbd>
          </div>
          <div className="flex justify-between">
            <span>Group Selection:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+1-5</kbd>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Notification message component
const NotificationMessage: React.FC<{ message: string; type: 'info' | 'warning' | 'success' | 'error', onClose: () => void }> = ({ 
  message, 
  type,
  onClose
}) => {
  useEffect(() => {
    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <Alert className={`
      w-full max-w-md mx-auto shadow-lg
      ${type === 'info' ? 'bg-blue-900/80' : ''}
      ${type === 'warning' ? 'bg-yellow-900/80' : ''}
      ${type === 'success' ? 'bg-green-900/80' : ''}
      ${type === 'error' ? 'bg-red-900/80' : ''}
      backdrop-blur-md text-white
    `}>
      <AlertDescription className="flex justify-between items-center">
        <span>{message}</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0 -mr-2">
          ✕
        </Button>
      </AlertDescription>
    </Alert>
  );
};

// Category type for technology organization
type CategoryType = "military" | "economy" | "defense" | "special";

// Determine the category of a technology based on its effects and ID
function getTechCategory(tech: any): CategoryType {
  // Check faction-specific special techs first
  if (tech.faction && (tech.id.includes("Title") || tech.id.includes("Record") || 
      tech.id.includes("Alliance") || tech.id.includes("Prophecy"))) {
    return "special";
  }
  
  // Check defense technologies
  if (tech.id.includes("fortification") || 
      tech.id.includes("defense") || 
      tech.id.includes("wall") ||
      (tech.effects && (tech.effects.defense || tech.effects.buildingDefense))) {
    return "defense";
  }
  
  // Check economy technologies
  if (tech.id.includes("agriculture") || 
      tech.id.includes("mining") || 
      tech.id.includes("economy") || 
      tech.id.includes("resources") ||
      (tech.effects && (tech.effects.foodGatherRate || tech.effects.oreGatherRate))) {
    return "economy";
  }
  
  // Default to military
  return "military";
}

// Enhanced Tech Tree Component
interface EnhancedTechTreeProps {
  techs: any[];
  onResearch: (techId: string) => void;
  playerFaction: string;
  notifyUser: (message: string, type: string) => void;
  color: string;
}

const EnhancedTechTree: React.FC<EnhancedTechTreeProps> = ({ 
  techs, 
  onResearch, 
  playerFaction, 
  notifyUser,
  color 
}) => {
  // Calculate tech tiers based on prerequisites
  const techTiers: Record<string, number> = {};
  
  // First pass: set initial tiers
  techs.forEach(tech => {
    if (!tech.prerequisites || tech.prerequisites.length === 0) {
      techTiers[tech.id] = 0; // Base tier (no prerequisites)
    } else {
      techTiers[tech.id] = -1; // Not yet calculated
    }
  });
  
  // Additional passes to resolve dependencies
  let changed = true;
  while (changed) {
    changed = false;
    techs.forEach(tech => {
      if (techTiers[tech.id] === -1) {
        // Check if all prerequisites have been assigned a tier
        const prereqTiers = tech.prerequisites
          .map((prereqId: string) => techTiers[prereqId])
          .filter((tier: number) => tier !== undefined && tier >= 0);
        
        if (prereqTiers.length === tech.prerequisites.length) {
          // All prerequisites have tiers, set this tech's tier
          const maxPrereqTier = Math.max(...prereqTiers);
          techTiers[tech.id] = maxPrereqTier + 1;
          changed = true;
        }
      }
    });
  }
  
  // Group techs by tier
  const techsByTier: Record<number, any[]> = {};
  techs.forEach(tech => {
    const tier = techTiers[tech.id] !== undefined ? techTiers[tech.id] : 0;
    if (!techsByTier[tier]) {
      techsByTier[tier] = [];
    }
    techsByTier[tier].push(tech);
  });
  
  return (
    <div className="flex flex-col gap-4 p-2">
      {Object.entries(techsByTier).map(([tier, tierTechs]) => (
        <div key={tier} className="relative">
          {/* Tech tier label */}
          <div 
            className="absolute -left-2 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-gray-400 origin-center"
            style={{ width: 'auto', whiteSpace: 'nowrap' }}
          >
            Tier {parseInt(tier) + 1}
          </div>
          
          {/* Tech nodes for this tier */}
          <div className="flex gap-3 ml-5">
            {tierTechs.map(tech => (
              <TechCard 
                key={tech.id} 
                tech={tech} 
                onResearch={onResearch} 
                playerFaction={playerFaction} 
                notifyUser={notifyUser}
                color={color}
                tier={parseInt(tier)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Tech Card Component
interface TechCardProps {
  tech: any;
  onResearch: (techId: string) => void;
  playerFaction: string;
  notifyUser: (message: string, type: string) => void;
  color: string;
  tier: number;
}

const TechCard: React.FC<TechCardProps> = ({ 
  tech, 
  onResearch, 
  playerFaction, 
  notifyUser,
  color,
  tier
}) => {
  const available = tech.faction === playerFaction || !tech.faction;
  const prereqsMet = !tech.prerequisites || tech.prerequisites.length === 0 || 
                     tech.prerequisites.every((prereqId: string) => {
                       // In a real implementation, check if the prerequisite is researched
                       return true; // For now, assume all prerequisites are met
                     });
  
  // Determine background and border colors based on research status
  const getBgColor = () => {
    if (tech.researched) return 'bg-gray-700/50';
    if (!available) return 'bg-gray-800/30';
    if (!prereqsMet) return 'bg-gray-800/50';
    return `bg-${color.replace('#', '')}/10`;
  };
  
  const getBorderColor = () => {
    if (tech.researched) return 'border-gray-600';
    if (!available) return 'border-gray-700';
    if (!prereqsMet) return 'border-gray-700';
    return `border-${color.replace('#', '')}/50`;
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="cursor-pointer relative"
          >
            <Card 
              className={`p-3 w-36 min-h-[7rem] border ${getBorderColor()} ${getBgColor()} transition-colors
                          ${!available ? 'opacity-50' : ''}`}
              onClick={() => {
                if (available && !tech.researched && prereqsMet) {
                  onResearch(tech.id);
                  notifyUser(`Researching ${tech.name}`, "success");
                } else if (!prereqsMet) {
                  notifyUser("Prerequisites not met", "warning");
                } else if (tech.researched) {
                  notifyUser("Already researched", "info");
                }
              }}
            >
              <div className="text-center relative">
                {/* Research status indicator */}
                {tech.researched && (
                  <div className="absolute -top-2 -right-2 bg-green-600 text-white rounded-full p-0.5">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                )}
                
                {/* Faction-specific indicator */}
                {tech.faction && (
                  <div className="absolute -top-1 -left-1 rounded-sm px-1 text-[0.6rem]" style={{
                    backgroundColor: tech.faction === 'Nephites' ? '#4287f5' : '#f54242',
                    color: 'white'
                  }}>
                    {tech.faction.substring(0, 3)}
                  </div>
                )}
                
                <h3 className="font-semibold text-sm line-clamp-1">{tech.name}</h3>
                <p className="text-xs my-1 line-clamp-2 h-8">{tech.description}</p>
                
                {/* Resource cost */}
                <div className="flex justify-between text-xs opacity-75 mt-1">
                  <span className="flex items-center">
                    <TreePine className="w-3 h-3 mr-1" />
                    {tech.cost.food}
                  </span>
                  <span className="flex items-center">
                    <Mountain className="w-3 h-3 mr-1" />
                    {tech.cost.ore}
                  </span>
                </div>
                
                {/* Unlocks indicator */}
                {tech.unlocks && (
                  (tech.unlocks.units?.length > 0 || tech.unlocks.buildings?.length > 0) && (
                    <div className="mt-1 text-xs bg-blue-900/30 rounded px-1 py-0.5 line-clamp-1">
                      Unlocks {tech.unlocks.units?.length || 0 + tech.unlocks.buildings?.length || 0} items
                    </div>
                  )
                )}
              </div>
            </Card>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-gray-900 text-white w-64">
          <div className="p-2">
            <h4 className="font-bold">{tech.name}</h4>
            <p className="text-xs my-1">{tech.description}</p>
            
            {tech.effects && Object.keys(tech.effects).length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold">Effects:</p>
                <ul className="text-xs list-disc pl-4">
                  {Object.entries(tech.effects).map(([key, value]) => (
                    <li key={key}>{key}: {String(value)}</li>
                  )) as React.ReactNode}
                </ul>
              </div>
            )}
            
            {tech.unlocks && (
              <div className="mt-2">
                <p className="text-xs font-semibold">Unlocks:</p>
                <ul className="text-xs list-disc pl-4">
                  {tech.unlocks.units && tech.unlocks.units.map((unit: any) => (
                    <li key={unit}>Unit: {unit}</li>
                  ))}
                  {tech.unlocks.buildings && tech.unlocks.buildings.map((building: any) => (
                    <li key={building}>Building: {building}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {tech.prerequisites && tech.prerequisites.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold">Requires:</p>
                <p className="text-xs">{tech.prerequisites.join(', ')}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Main game HUD component
export const GameHUD: React.FC<{
  resources: ResourceData;
  selectedUnits: any[];
  selectedBuildings: any[];
  availableTechs: any[];
  mapData: any[][];
  units: any[];
  buildings: any[];
  mapSize: number;
  localPlayerId: string;
  playerFaction: string;
  cameraPosition: { x: number; y: number; width: number; height: number };
  onBuildUnit: (type: string) => void;
  onBuildBuilding: (type: string) => void;
  onResearchTech: (techId: string) => void;
  onCameraViewChange: (view: string) => void;
  onMinimapClick: (x: number, y: number) => void;
}> = ({
  resources,
  selectedUnits,
  selectedBuildings,
  availableTechs,
  mapData,
  units,
  buildings,
  mapSize,
  localPlayerId,
  playerFaction,
  cameraPosition,
  onBuildUnit,
  onBuildBuilding,
  onResearchTech,
  onCameraViewChange,
  onMinimapClick
}) => {
  const gameState = useGame();
  const { isMuted, toggleMute } = useAudio();
  const [activeTab, setActiveTab] = useState("units");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id: number, message: string, type: 'info' | 'warning' | 'success' | 'error'}>>([]);
  const [notificationCounter, setNotificationCounter] = useState(0);
  
  // Add notification
  const addNotification = (message: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
    const id = notificationCounter;
    setNotifications(prev => [...prev, { id, message, type }]);
    setNotificationCounter(prev => prev + 1);
  };
  
  // Remove notification
  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(note => note.id !== id));
  };
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setShowShortcuts(prev => !prev);
      }
      
      // We could add more keyboard shortcut handlers here
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  return (
    <>
      {/* Top Bar - Fixed Resource Display */}
      <motion.div 
        className="fixed top-0 left-0 right-0 bg-black/70 backdrop-blur-md text-white px-4 py-2 z-50 flex justify-between items-center"
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ResourceDisplay resources={resources} />
        
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-75">Playing as:</span>
          <Badge 
            className={`font-bold px-2 py-1 rounded-md ${
              playerFaction === 'Nephites' 
                ? 'bg-blue-700 hover:bg-blue-600' 
                : 'bg-red-700 hover:bg-red-600'
            }`}
          >
            {playerFaction}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowShortcuts(prev => !prev)}
                  aria-label="Show keyboard shortcuts"
                >
                  <HelpCircle size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Keyboard shortcuts (H)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{isMuted ? "Unmute" : "Mute"} (M)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onCameraViewChange('rotate')}
                  aria-label="Toggle camera rotation"
                >
                  <Camera size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Camera controls</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>
      
      {/* Left Side - Camera Controls */}
      <motion.div
        className="fixed left-4 top-20 z-50"
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <CameraControls onViewChange={onCameraViewChange} />
      </motion.div>
      
      {/* Right Side - MiniMap */}
      <motion.div
        className="fixed right-4 top-20 z-50"
        initial={{ x: 100 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <MiniMap
          mapData={mapData}
          mapSize={mapSize}
          units={units}
          buildings={buildings}
          playerFaction={playerFaction}
          localPlayerId={localPlayerId}
          cameraPosition={cameraPosition}
          onClick={onMinimapClick}
        />
      </motion.div>
      
      {/* Keyboard Shortcuts Panel */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <ShortcutsPanel onClose={() => setShowShortcuts(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Notifications Area */}
      <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 space-y-2 w-full max-w-md">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationMessage
                message={notification.message}
                type={notification.type}
                onClose={() => removeNotification(notification.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Bottom Bar - Main Game Interface */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed bottom-0 left-0 right-0 bg-black/75 backdrop-blur-md text-white p-4 rounded-t-lg z-50"
        style={{ maxHeight: "35vh" }}
      >
        <Tabs defaultValue="units" onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-gray-800/50 mb-4">
            <TabsTrigger value="units" className="data-[state=active]:bg-primary/20">
              <Users className="mr-2" />
              Units
            </TabsTrigger>
            <TabsTrigger value="buildings" className="data-[state=active]:bg-primary/20">
              <Building2 className="mr-2" />
              Buildings
            </TabsTrigger>
            <TabsTrigger value="tech" className="data-[state=active]:bg-primary/20">
              <AreaChart className="mr-2" />
              Technology
            </TabsTrigger>
            <TabsTrigger value="selected" className="data-[state=active]:bg-primary/20">
              <Cpu className="mr-2" />
              Selected ({selectedUnits.length + selectedBuildings.length})
            </TabsTrigger>
          </TabsList>

          {/* Units Tab */}
          <TabsContent value="units" className="mt-0">
            <ScrollArea className="h-40">
              <div className="grid grid-cols-4 gap-3 p-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => {
                          onBuildUnit("worker");
                          addNotification("Training worker unit", "info");
                        }}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <Combine className="mx-auto mb-2" />
                            <h3 className="font-semibold">Worker</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 50</span>
                              <span>Ore: 0</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2">
                        <h4 className="font-bold">Worker</h4>
                        <p className="text-xs mt-1">Gathers resources and builds structures</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 50</div>
                          <div>Attack: 2</div>
                          <div>Defense: 0</div>
                          <div>Speed: 2.5</div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => {
                          onBuildUnit("melee");
                          addNotification("Training melee warrior", "info");
                        }}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <Sword className="mx-auto mb-2" />
                            <h3 className="font-semibold">Warrior</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 50</span>
                              <span>Ore: 30</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2">
                        <h4 className="font-bold">Melee Warrior</h4>
                        <p className="text-xs mt-1">Strong frontline fighter with heavy armor</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 100</div>
                          <div>Attack: 12</div>
                          <div>Defense: 8</div>
                          <div>Speed: 1.8</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p className="font-semibold">Strong against: <span className="text-green-400">Ranged</span></p>
                          <p className="font-semibold">Weak against: <span className="text-red-400">Cavalry</span></p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => {
                          onBuildUnit("ranged");
                          addNotification("Training ranged archer", "info");
                        }}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <svg className="mx-auto mb-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M7 20L4 4l16 3-9 3-4 10z" />
                            </svg>
                            <h3 className="font-semibold">Archer</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 40</span>
                              <span>Ore: 40</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2">
                        <h4 className="font-bold">Ranged Archer</h4>
                        <p className="text-xs mt-1">Attacks from distance with powerful bows</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 60</div>
                          <div>Attack: 15</div>
                          <div>Defense: 3</div>
                          <div>Speed: 2.0</div>
                          <div>Range: 4</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p className="font-semibold">Strong against: <span className="text-green-400">Cavalry</span></p>
                          <p className="font-semibold">Weak against: <span className="text-red-400">Melee</span></p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => {
                          onBuildUnit("hero");
                          addNotification("Training hero unit", "success");
                        }}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <svg className="mx-auto mb-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2L9.5 8.5H3l5.5 4.5L6 20l6-5 6 5-2.5-7 5.5-4.5h-6.5L12 2z" />
                            </svg>
                            <h3 className="font-semibold">Hero</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 100</span>
                              <span>Ore: 100</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2">
                        <h4 className="font-bold">Hero Unit</h4>
                        <p className="text-xs mt-1">Powerful leader with special abilities</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 200</div>
                          <div>Attack: 25</div>
                          <div>Defense: 15</div>
                          <div>Speed: 2.2</div>
                          <div>Range: 2</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p className="font-semibold text-yellow-400">Special: Inspires nearby units (+15% attack)</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Building Tab Content */}
          <TabsContent value="buildings" className="mt-0">
            <ScrollArea className="h-40">
              <div className="grid grid-cols-4 gap-3 p-2">
                {/* Buildings cards with tooltips - similar to units */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => onBuildBuilding("cityCenter")}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <Building2 className="mx-auto mb-2" />
                            <h3 className="font-semibold">City Center</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 200</span>
                              <span>Ore: 100</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2 max-w-xs">
                        <h4 className="font-bold">City Center</h4>
                        <p className="text-xs mt-1">Main building for training workers and researching technology</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 500</div>
                          <div>Defense: 10</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p>Allows resource drop-off and creates workers</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => onBuildBuilding("barracks")}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <Sword className="mx-auto mb-2" />
                            <h3 className="font-semibold">Barracks</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 100</span>
                              <span>Ore: 150</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2 max-w-xs">
                        <h4 className="font-bold">Barracks</h4>
                        <p className="text-xs mt-1">Trains melee combat units</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 300</div>
                          <div>Defense: 8</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p>Produces: Melee Warriors, Cavalry (with research)</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => onBuildBuilding("archeryRange")}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <svg className="mx-auto mb-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M7 20L4 4l16 3-9 3-4 10z" />
                            </svg>
                            <h3 className="font-semibold">Archery Range</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 100</span>
                              <span>Ore: 150</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2 max-w-xs">
                        <h4 className="font-bold">Archery Range</h4>
                        <p className="text-xs mt-1">Trains ranged combat units</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 250</div>
                          <div>Defense: 5</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p>Produces: Archers, Advanced Archers (with research)</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-pointer"
                        onClick={() => onBuildBuilding("wall")}
                      >
                        <Card className="p-3 bg-gray-700/50 hover:bg-gray-600/50">
                          <div className="text-center">
                            <Shield className="mx-auto mb-2" />
                            <h3 className="font-semibold">Wall</h3>
                            <div className="flex justify-between text-xs mt-1">
                              <span>Food: 50</span>
                              <span>Ore: 150</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white">
                      <div className="p-2 max-w-xs">
                        <h4 className="font-bold">Wall</h4>
                        <p className="text-xs mt-1">Defensive structure to block enemy movement</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>Health: 400</div>
                          <div>Defense: 20</div>
                        </div>
                        <div className="mt-2 text-xs">
                          <p>Blocks enemy movement and provides defensive bonus to nearby units</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Technology Tab Content */}
          <TabsContent value="tech" className="mt-0">
            <div className="h-40 flex flex-col">
              {/* Tech Tree Category Tabs */}
              <Tabs defaultValue="military" className="w-full mb-1">
                <div className="border-b border-gray-700">
                  <TabsList className="bg-transparent h-8 mb-0">
                    <TabsTrigger 
                      value="military" 
                      className="h-8 px-3 text-xs data-[state=active]:bg-red-900/40 data-[state=active]:border-b-2 data-[state=active]:border-red-500"
                    >
                      <Sword className="w-3 h-3 mr-1" />
                      Military
                    </TabsTrigger>
                    <TabsTrigger 
                      value="economy" 
                      className="h-8 px-3 text-xs data-[state=active]:bg-green-900/40 data-[state=active]:border-b-2 data-[state=active]:border-green-500"
                    >
                      <Wheat className="w-3 h-3 mr-1" />
                      Economy
                    </TabsTrigger>
                    <TabsTrigger 
                      value="defense" 
                      className="h-8 px-3 text-xs data-[state=active]:bg-blue-900/40 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Defense
                    </TabsTrigger>
                    <TabsTrigger 
                      value="special" 
                      className="h-8 px-3 text-xs data-[state=active]:bg-purple-900/40 data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      Special
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                {/* Military Tech Tree */}
                <TabsContent value="military" className="p-0 m-0 border-none">
                  <div className="text-xs px-2 py-1 italic text-gray-400 bg-red-950/30 rounded mb-1">
                    Military technologies enhance your offensive capabilities. Focusing here allows for a more aggressive playstyle.
                  </div>
                  <ScrollArea className="h-[6.5rem]">
                    <EnhancedTechTree 
                      techs={availableTechs.filter((tech: any) => getTechCategory(tech) === 'military')}
                      onResearch={onResearchTech}
                      playerFaction={playerFaction}
                      notifyUser={addNotification}
                      color="#b92d2d"
                    />
                  </ScrollArea>
                </TabsContent>
                
                {/* Economy Tech Tree */}
                <TabsContent value="economy" className="p-0 m-0 border-none">
                  <div className="text-xs px-2 py-1 italic text-gray-400 bg-green-950/30 rounded mb-1">
                    Economic technologies improve resource gathering and efficiency. Critical for sustained warfare and expansion.
                  </div>
                  <ScrollArea className="h-[6.5rem]">
                    <EnhancedTechTree 
                      techs={availableTechs.filter((tech: any) => getTechCategory(tech) === 'economy')}
                      onResearch={onResearchTech}
                      playerFaction={playerFaction} 
                      notifyUser={addNotification}
                      color="#2d8a36"
                    />
                  </ScrollArea>
                </TabsContent>
                
                {/* Defense Tech Tree */}
                <TabsContent value="defense" className="p-0 m-0 border-none">
                  <div className="text-xs px-2 py-1 italic text-gray-400 bg-blue-950/30 rounded mb-1">
                    Defensive technologies strengthen your buildings and fortifications. Essential for holding territory.
                  </div>
                  <ScrollArea className="h-[6.5rem]">
                    <EnhancedTechTree 
                      techs={availableTechs.filter((tech: any) => getTechCategory(tech) === 'defense')}
                      onResearch={onResearchTech}
                      playerFaction={playerFaction}
                      notifyUser={addNotification}
                      color="#3d6fa3"
                    />
                  </ScrollArea>
                </TabsContent>
                
                {/* Special Tech Tree */}
                <TabsContent value="special" className="p-0 m-0 border-none">
                  <div className="text-xs px-2 py-1 italic text-gray-400 bg-purple-950/30 rounded mb-1">
                    Faction-specific technologies that provide unique advantages based on your civilization's strengths.
                  </div>
                  <ScrollArea className="h-[6.5rem]">
                    <EnhancedTechTree 
                      techs={availableTechs.filter((tech: any) => getTechCategory(tech) === 'special')}
                      onResearch={onResearchTech}
                      playerFaction={playerFaction}
                      notifyUser={addNotification}
                      color="#8a2d8a"
                    />
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* Selected Units/Buildings Tab Content - Enhanced with more contextual details */}
          <TabsContent value="selected" className="mt-0">
            <ScrollArea className="h-40">
              <div className="p-2">
                {selectedUnits.length > 0 && (
                  <div>
                    {/* Unit selection summary with unit type counts */}
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold">Selected Units ({selectedUnits.length})</h3>
                      <div className="flex gap-2">
                        {/* Count units by type */}
                        {(() => {
                          const unitCounts: Record<string, number> = {};
                          selectedUnits.forEach((unit: any) => {
                            unitCounts[unit.type] = (unitCounts[unit.type] || 0) + 1;
                          });
                          
                          return Object.entries(unitCounts).map(([type, count]) => (
                            <Badge key={type} className="bg-gray-700 text-white text-xs">
                              {count}× {type}
                            </Badge>
                          ));
                        })() as React.ReactNode}
                      </div>
                    </div>
                    
                    {/* Unit stance controls - only show when units are selected */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3 bg-gray-800/50 p-2 rounded-md"
                    >
                      <p className="text-xs mb-1 font-semibold">Unit Stance:</p>
                      <ToggleGroup type="single" size="sm" className="justify-start">
                        <ToggleGroupItem value="aggressive" aria-label="Aggressive stance" className="h-7 px-2 py-1 data-[state=on]:bg-red-600/70">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <Sword className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Aggressive</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p className="text-xs">Units will chase enemies and attack on sight</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="defensive" aria-label="Defensive stance" className="h-7 px-2 py-1 data-[state=on]:bg-blue-600/70">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <Shield className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Defensive</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p className="text-xs">Units will attack enemies in range but won't chase far</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="hold" aria-label="Hold position stance" className="h-7 px-2 py-1 data-[state=on]:bg-yellow-600/70">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <span className="text-xs">Hold Position</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p className="text-xs">Units will not move but will attack enemies in range</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </motion.div>
                    
                    {/* Unit cards with more details */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {selectedUnits.map((unit: any) => (
                        <TooltipProvider key={unit.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <Card className="p-2 bg-gray-700/50 border-l-2" style={{
                                  borderLeftColor: unit.stance === 'aggressive' ? '#dc2626' : 
                                                   unit.stance === 'defensive' ? '#2563eb' : 
                                                   unit.stance === 'hold-position' ? '#ca8a04' : '#6b7280'
                                }}>
                                  <div className="text-center">
                                    <h4 className="font-semibold capitalize">{unit.type}</h4>
                                    <div className="w-full bg-gray-800 h-2 mt-1 rounded-full">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          (unit.health / unit.maxHealth) > 0.6 ? 'bg-green-500' :
                                          (unit.health / unit.maxHealth) > 0.3 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ 
                                          width: `${(unit.health / unit.maxHealth) * 100}%` 
                                        }}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                                      <div>{Math.floor(unit.health)}/{unit.maxHealth}</div>
                                      <div>ATK: {unit.attack}</div>
                                    </div>
                                    
                                    {/* Show current activity indicator (if available) */}
                                    {unit.isMoving && (
                                      <div className="mt-1 text-xs bg-blue-900/50 rounded px-1 py-0.5">
                                        Moving
                                      </div>
                                    )}
                                    {unit.isGathering && (
                                      <div className="mt-1 text-xs bg-green-900/50 rounded px-1 py-0.5">
                                        Gathering
                                      </div>
                                    )}
                                    {unit.isAttacking && (
                                      <div className="mt-1 text-xs bg-red-900/50 rounded px-1 py-0.5">
                                        Attacking
                                      </div>
                                    )}
                                    {unit.isPatrolling && (
                                      <div className="mt-1 text-xs bg-purple-900/50 rounded px-1 py-0.5">
                                        Patrolling
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-gray-900 text-white">
                              <UnitTooltip unit={unit} />
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBuildings.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">Selected Buildings ({selectedBuildings.length})</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedBuildings.map((building: any) => (
                        <TooltipProvider key={building.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <Card className="p-2 bg-gray-700/50 hover:bg-gray-600/50">
                                  <div className="text-center">
                                    <h4 className="font-semibold capitalize">{building.type}</h4>
                                    <div className="w-full bg-gray-800 h-2 mt-1 rounded-full">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          (building.health / building.maxHealth) > 0.6 ? 'bg-green-500' :
                                          (building.health / building.maxHealth) > 0.3 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ 
                                          width: `${(building.health / building.maxHealth) * 100}%` 
                                        }}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                                      <div>HP: {Math.floor(building.health)}/{building.maxHealth}</div>
                                      <div>DEF: {building.defense}</div>
                                    </div>
                                    
                                    {/* Enhanced production queue visualization */}
                                    {building.productionQueue && building.productionQueue.length > 0 && (
                                      <div className="mt-2 text-xs">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-semibold">Production:</span>
                                          <Badge variant="outline" className="h-4 text-xs px-1">
                                            {building.productionQueue.length} in queue
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="capitalize">{building.productionQueue[0].type}</span>
                                          <Progress 
                                            value={(1 - building.productionQueue[0].remainingTime / 
                                              building.getProductionTime(building.productionQueue[0].type)) * 100}
                                            className="h-1 flex-grow"
                                          />
                                          <span className="text-xs opacity-80">
                                            {Math.ceil(building.productionQueue[0].remainingTime / 1000)}s
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-gray-900 text-white">
                              <div className="p-2 max-w-xs">
                                <h4 className="font-bold capitalize">{building.type}</h4>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                  <div>Health: {Math.floor(building.health)}/{building.maxHealth}</div>
                                  <div>Defense: {building.defense}</div>
                                </div>
                                {building.productionQueue && building.productionQueue.length > 0 && (
                                  <div className="mt-2 text-xs">
                                    <p className="font-semibold">Production Queue:</p>
                                    <ol className="pl-4 list-decimal">
                                      {building.productionQueue.map((item: any, idx: number) => (
                                        <li key={idx}>
                                          {item.type}: {Math.round(item.remainingTime / 1000)}s remaining
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUnits.length === 0 && selectedBuildings.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                    <Users className="mb-2 h-8 w-8 opacity-30" />
                    <p>No units or buildings selected</p>
                    <p className="text-xs mt-1">Click on units or buildings to select them</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
};

export default GameHUD;