import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../lib/stores/useGame";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

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
  Combine 
} from "lucide-react";

interface GameInterfaceProps {
  resources: {
    food: number;
    ore: number;
  };
  selectedUnits: any[];
  selectedBuildings: any[];
  onBuildUnit: (type: string) => void;
  onBuildBuilding: (type: string) => void;
  onResearchTech: (techId: string) => void;
  availableTechs: any[];
  localPlayerId: string;
  playerFaction: string;
}

export const GameInterface: React.FC<GameInterfaceProps> = ({
  resources,
  selectedUnits,
  selectedBuildings,
  onBuildUnit,
  onBuildBuilding,
  onResearchTech,
  availableTechs,
  localPlayerId,
  playerFaction
}) => {
  const gameState = useGame();
  const [activeTab, setActiveTab] = useState("units");

  // Card variants for animation
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }
    }
  };

  // Button hover animation
  const buttonVariants = {
    idle: { scale: 1 },
    hover: { 
      scale: 1.05,
      boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.1)",
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-md text-white p-4 rounded-t-lg z-50"
      style={{ maxHeight: "35vh" }}
    >
      {/* Top Bar - Resources */}
      <motion.div 
        className="flex justify-between items-center mb-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex gap-4">
          <div className="flex items-center">
            <TreePine className="mr-2 text-green-400" size={20} />
            <span className="font-bold">Food: {resources.food}</span>
          </div>
          <div className="flex items-center">
            <Mountain className="mr-2 text-gray-400" size={20} />
            <span className="font-bold">Ore: {resources.ore}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-75">Playing as:</span>
          <span className="font-bold px-2 py-1 rounded-md" 
            style={{ 
              backgroundColor: playerFaction === 'Nephites' ? '#4287f5' : '#f54242',
              color: 'white'
            }}>
            {playerFaction}
          </span>
        </div>
      </motion.div>

      <Separator className="my-2 bg-white/20" />

      {/* Main Content */}
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
            Selected
          </TabsTrigger>
        </TabsList>

        {/* Units Tab */}
        <TabsContent value="units" className="mt-0">
          <ScrollArea className="h-40">
            <div className="grid grid-cols-4 gap-3 p-2">
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildUnit("worker")}>
                  <div className="text-center">
                    <Combine className="mx-auto mb-2" />
                    <h3 className="font-semibold">Worker</h3>
                    <p className="text-xs opacity-75">50 food, 0 ore</p>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.1 }}
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildUnit("melee")}>
                  <div className="text-center">
                    <Sword className="mx-auto mb-2" />
                    <h3 className="font-semibold">Warrior</h3>
                    <p className="text-xs opacity-75">50 food, 30 ore</p>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 }}
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildUnit("ranged")}>
                  <div className="text-center">
                    <svg className="mx-auto mb-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 20L4 4l16 3-9 3-4 10z" />
                    </svg>
                    <h3 className="font-semibold">Archer</h3>
                    <p className="text-xs opacity-75">40 food, 40 ore</p>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.3 }}
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildUnit("hero")}>
                  <div className="text-center">
                    <svg className="mx-auto mb-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L9.5 8.5H3l5.5 4.5L6 20l6-5 6 5-2.5-7 5.5-4.5h-6.5L12 2z" />
                    </svg>
                    <h3 className="font-semibold">Hero</h3>
                    <p className="text-xs opacity-75">100 food, 100 ore</p>
                  </div>
                </Card>
              </motion.div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="mt-0">
          <ScrollArea className="h-40">
            <div className="grid grid-cols-4 gap-3 p-2">
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildBuilding("cityCenter")}>
                  <div className="text-center">
                    <Building2 className="mx-auto mb-2" />
                    <h3 className="font-semibold">City Center</h3>
                    <p className="text-xs opacity-75">200 food, 100 ore</p>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.1 }}
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildBuilding("barracks")}>
                  <div className="text-center">
                    <Sword className="mx-auto mb-2" />
                    <h3 className="font-semibold">Barracks</h3>
                    <p className="text-xs opacity-75">100 food, 150 ore</p>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 }}
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildBuilding("archeryRange")}>
                  <div className="text-center">
                    <svg className="mx-auto mb-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 20L4 4l16 3-9 3-4 10z" />
                    </svg>
                    <h3 className="font-semibold">Archery Range</h3>
                    <p className="text-xs opacity-75">100 food, 150 ore</p>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.3 }}
                whileHover="hover"
              >
                <Card className="p-3 bg-gray-700/50 cursor-pointer hover:bg-gray-600/50" onClick={() => onBuildBuilding("wall")}>
                  <div className="text-center">
                    <Shield className="mx-auto mb-2" />
                    <h3 className="font-semibold">Wall</h3>
                    <p className="text-xs opacity-75">50 food, 150 ore</p>
                  </div>
                </Card>
              </motion.div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Technology Tab */}
        <TabsContent value="tech" className="mt-0">
          <ScrollArea className="h-40">
            <div className="grid grid-cols-3 gap-3 p-2">
              {availableTechs.map((tech, index) => (
                <motion.div
                  key={tech.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: index * 0.1 }}
                  whileHover="hover"
                >
                  <Card 
                    className={`p-3 cursor-pointer hover:bg-gray-600/50 ${
                      tech.faction === playerFaction || !tech.faction
                        ? 'bg-gray-700/50'
                        : 'bg-gray-800/30 opacity-50'
                    }`}
                    onClick={() => {
                      if (tech.faction === playerFaction || !tech.faction) {
                        onResearchTech(tech.id);
                      }
                    }}
                  >
                    <div className="text-center">
                      <h3 className="font-semibold">{tech.name}</h3>
                      <p className="text-xs my-1">{tech.description}</p>
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
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Selected Tab */}
        <TabsContent value="selected" className="mt-0">
          <ScrollArea className="h-40">
            <div className="p-2">
              {selectedUnits.length > 0 && (
                <div>
                  <h3 className="font-bold mb-2">Selected Units ({selectedUnits.length})</h3>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {selectedUnits.map((unit) => (
                      <motion.div
                        key={unit.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ scale: 1.02 }}
                      >
                        <Card className="p-2 bg-gray-700/50">
                          <div className="text-center">
                            <h4 className="font-semibold capitalize">{unit.type}</h4>
                            <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                              <div>HP: {Math.floor(unit.health)}/{unit.maxHealth}</div>
                              <div>ATK: {unit.attack}</div>
                              <div>DEF: {unit.defense}</div>
                              <div>SPD: {unit.speed.toFixed(1)}</div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBuildings.length > 0 && (
                <div>
                  <h3 className="font-bold mb-2">Selected Buildings ({selectedBuildings.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedBuildings.map((building) => (
                      <motion.div
                        key={building.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ scale: 1.02 }}
                      >
                        <Card className="p-2 bg-gray-700/50">
                          <div className="text-center">
                            <h4 className="font-semibold capitalize">{building.type}</h4>
                            <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                              <div>HP: {Math.floor(building.health)}/{building.maxHealth}</div>
                              <div>DEF: {building.defense}</div>
                            </div>
                            {building.productionQueue.length > 0 && (
                              <div className="mt-2 text-xs">
                                <p>Building: {building.productionQueue[0].type}</p>
                                <div className="w-full bg-gray-800 h-1 mt-1 rounded-full">
                                  <div 
                                    className="bg-blue-500 h-1 rounded-full" 
                                    style={{ 
                                      width: `${(1 - building.productionQueue[0].remainingTime / 
                                        building.getProductionTime(building.productionQueue[0].type)) * 100}%` 
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUnits.length === 0 && selectedBuildings.length === 0 && (
                <div className="text-center py-8 opacity-50">
                  <Cpu className="mx-auto mb-2" size={32} />
                  <p>No units or buildings selected</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default GameInterface;