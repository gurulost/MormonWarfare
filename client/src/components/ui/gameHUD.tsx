import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../lib/stores/useGame";
import { useAudio } from "../../lib/stores/useAudio";
import { Button } from "./button";
import { Card } from "./card";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Alert, AlertDescription } from "./alert";

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
  BookOpen
} from "lucide-react";

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
    
  }, [mapData, mapSize, units, buildings, playerFaction, localPlayerId, cameraPosition]);
  
  // Handle minimap clicks to move camera
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    
    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to map coordinates
    const mapX = Math.floor((x / canvas.width) * mapSize);
    const mapY = Math.floor((y / canvas.height) * mapSize);
    
    // Trigger click handler
    onClick(mapX, mapY);
  };
  
  return (
    <div className="bg-black/60 backdrop-blur-sm p-1 rounded-md shadow-lg overflow-hidden">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="text-xs font-bold text-white/80 flex items-center">
          <MapIcon size={12} className="mr-1" /> Minimap
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Grid3x3 size={10} className="text-white/80" />
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
        aria-label="Game minimap - click to navigate"
      />
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
            <ScrollArea className="h-40">
              <div className="grid grid-cols-3 gap-3 p-2">
                {availableTechs.map((tech, index) => (
                  <TooltipProvider key={tech.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="cursor-pointer"
                        >
                          <Card 
                            className={`p-3 hover:bg-gray-600/50 ${
                              tech.faction === playerFaction || !tech.faction
                                ? 'bg-gray-700/50'
                                : 'bg-gray-800/30 opacity-50'
                            }`}
                            onClick={() => {
                              if (tech.faction === playerFaction || !tech.faction) {
                                onResearchTech(tech.id);
                                addNotification(`Researching ${tech.name}`, "success");
                              }
                            }}
                          >
                            <div className="text-center">
                              <h3 className="font-semibold">{tech.name}</h3>
                              <p className="text-xs my-1 line-clamp-2">{tech.description}</p>
                              <div className="flex justify-between text-xs opacity-75 mt-2">
                                <span>Food: {tech.cost.food}</span>
                                <span>Ore: {tech.cost.ore}</span>
                              </div>
                              {tech.faction && (
                                <span className="text-xs inline-block mt-1 px-2 py-0.5 rounded" style={{
                                  backgroundColor: tech.faction === 'Nephites' ? '#4287f5' : '#f54242',
                                  color: 'white'
                                }}>
                                  {tech.faction}
                                </span>
                              )}
                            </div>
                          </Card>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-gray-900 text-white">
                        <div className="p-2 max-w-md">
                          <h4 className="font-bold">{tech.name}</h4>
                          <p className="text-xs my-1">{tech.description}</p>
                          
                          {tech.effects && Object.keys(tech.effects).length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold">Effects:</p>
                              <ul className="text-xs list-disc pl-4">
                                {Object.entries(tech.effects).map(([key, value]) => (
                                  <li key={key}>{key}: {value}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {tech.unlocks && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold">Unlocks:</p>
                              <ul className="text-xs list-disc pl-4">
                                {tech.unlocks.units && tech.unlocks.units.map(unit => (
                                  <li key={unit}>Unit: {unit}</li>
                                ))}
                                {tech.unlocks.buildings && tech.unlocks.buildings.map(building => (
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
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Selected Units/Buildings Tab Content */}
          <TabsContent value="selected" className="mt-0">
            <ScrollArea className="h-40">
              <div className="p-2">
                {selectedUnits.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">Selected Units ({selectedUnits.length})</h3>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {selectedUnits.map((unit) => (
                        <TooltipProvider key={unit.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                              >
                                <Card className="p-2 bg-gray-700/50">
                                  <div className="text-center">
                                    <h4 className="font-semibold capitalize">{unit.type}</h4>
                                    <div className="w-full bg-gray-800 h-2 mt-1 rounded-full">
                                      <div 
                                        className="bg-green-500 h-2 rounded-full" 
                                        style={{ 
                                          width: `${(unit.health / unit.maxHealth) * 100}%` 
                                        }}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                                      <div>{Math.floor(unit.health)}/{unit.maxHealth}</div>
                                      <div>ATK: {unit.attack}</div>
                                    </div>
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
                      {selectedBuildings.map((building) => (
                        <TooltipProvider key={building.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                              >
                                <Card className="p-2 bg-gray-700/50">
                                  <div className="text-center">
                                    <h4 className="font-semibold capitalize">{building.type}</h4>
                                    <div className="w-full bg-gray-800 h-2 mt-1 rounded-full">
                                      <div 
                                        className="bg-green-500 h-2 rounded-full" 
                                        style={{ 
                                          width: `${(building.health / building.maxHealth) * 100}%` 
                                        }}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                                      <div>HP: {Math.floor(building.health)}/{building.maxHealth}</div>
                                      <div>DEF: {building.defense}</div>
                                    </div>
                                    {building.productionQueue && building.productionQueue.length > 0 && (
                                      <div className="mt-2 text-xs">
                                        <p>Building: {building.productionQueue[0].type}</p>
                                        <Progress 
                                          value={(1 - building.productionQueue[0].remainingTime / 
                                            building.getProductionTime(building.productionQueue[0].type)) * 100}
                                          className="h-1 mt-1"
                                        />
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
                                      {building.productionQueue.map((item, idx) => (
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