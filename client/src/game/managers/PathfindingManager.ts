import Phaser from "phaser";
import { MapTile } from "../types";
import { MAP_SIZE } from "../config";

export class PathfindingManager {
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  findPath(startX: number, startY: number, targetX: number, targetY: number): { x: number; y: number }[] {
    // Get map from scene registry
    const map: MapTile[][] = this.scene.game.registry.get("map") || [];
    
    // Check if start or target are invalid
    if (
      startX < 0 || startY < 0 || startX >= MAP_SIZE || startY >= MAP_SIZE ||
      targetX < 0 || targetY < 0 || targetX >= MAP_SIZE || targetY >= MAP_SIZE
    ) {
      return [];
    }
    
    // If start and target are the same, return empty path
    if (startX === targetX && startY === targetY) {
      return [];
    }
    
    // Check if the map and target position are valid
    if (!map || !map[targetY] || !map[targetY][targetX]) {
      console.error("Invalid map or target position in findPath");
      return [];
    }

    // If target is not walkable, find nearest walkable tile
    if (!map[targetY][targetX].walkable) {
      const nearestWalkable = this.findNearestWalkableTile(targetX, targetY, map);
      if (nearestWalkable) {
        targetX = nearestWalkable.x;
        targetY = nearestWalkable.y;
      } else {
        return []; // No walkable tile found near target
      }
    }
    
    // A* pathfinding
    const openSet: Node[] = [];
    const closedSet: Map<string, Node> = new Map();
    const nodeMap: Map<string, Node> = new Map();
    
    // Create start node
    const startNode: Node = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, targetX, targetY),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    
    // Add start node to open set
    openSet.push(startNode);
    nodeMap.set(`${startX},${startY}`, startNode);
    
    // Start pathfinding
    while (openSet.length > 0) {
      // Sort open set by f value (lowest first)
      openSet.sort((a, b) => a.f - b.f);
      
      // Get node with lowest f value
      const current = openSet.shift()!;
      
      // Check if we reached the target
      if (current.x === targetX && current.y === targetY) {
        return this.reconstructPath(current);
      }
      
      // Add current node to closed set
      closedSet.set(`${current.x},${current.y}`, current);
      
      // Check neighbors
      const neighbors = this.getNeighbors(current.x, current.y, map);
      
      for (const neighbor of neighbors) {
        // Skip if in closed set
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) {
          continue;
        }
        
        // Calculate g score
        const tentativeG = current.g + this.movementCost(current.x, current.y, neighbor.x, neighbor.y, map);
        
        // Get existing node or create new one
        let neighborNode = nodeMap.get(`${neighbor.x},${neighbor.y}`);
        
        if (!neighborNode) {
          // Create new node
          neighborNode = {
            x: neighbor.x,
            y: neighbor.y,
            g: Infinity,
            h: this.heuristic(neighbor.x, neighbor.y, targetX, targetY),
            f: Infinity,
            parent: null
          };
          nodeMap.set(`${neighbor.x},${neighbor.y}`, neighborNode);
        }
        
        // Check if this path is better
        if (tentativeG < neighborNode.g) {
          // Update node
          neighborNode.parent = current;
          neighborNode.g = tentativeG;
          neighborNode.f = neighborNode.g + neighborNode.h;
          
          // Add to open set if not already there
          if (!openSet.some(node => node.x === neighborNode!.x && node.y === neighborNode!.y)) {
            openSet.push(neighborNode);
          }
        }
      }
    }
    
    // No path found
    return [];
  }
  
  private reconstructPath(endNode: Node): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: Node | null = endNode;
    
    // Trace back from end to start
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    
    // Remove the first node (starting position)
    if (path.length > 0) {
      path.shift();
    }
    
    return path;
  }
  
  private getNeighbors(x: number, y: number, map: MapTile[][]): { x: number; y: number }[] {
    const neighbors: { x: number; y: number }[] = [];
    
    // Check 8 surrounding tiles
    const directions = [
      { x: 0, y: -1 }, // North
      { x: 1, y: -1 }, // Northeast
      { x: 1, y: 0 },  // East
      { x: 1, y: 1 },  // Southeast
      { x: 0, y: 1 },  // South
      { x: -1, y: 1 }, // Southwest
      { x: -1, y: 0 }, // West
      { x: -1, y: -1 } // Northwest
    ];
    
    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      
      // Check if in bounds
      if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
        // Check if walkable
        if (map[ny][nx].walkable) {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }
    
    return neighbors;
  }
  
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    // Manhattan distance
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  
  private movementCost(x1: number, y1: number, x2: number, y2: number, map: MapTile[][]): number {
    // Base cost (1 for orthogonal, 1.4 for diagonal)
    const isDiagonal = x1 !== x2 && y1 !== y2;
    let cost = isDiagonal ? 1.4 : 1;
    
    // Safety check
    if (!map || !map[y2] || !map[y2][x2]) {
      console.error(`Invalid map access at (${x2},${y2}) in movementCost`);
      return cost;
    }
    
    // Additional cost based on terrain
    const terrain = map[y2][x2].type;
    
    if (terrain === 'forest') {
      cost += 0.5; // Forests are harder to move through
    } else if (terrain === 'hills') {
      cost += 1; // Hills are even harder
    }
    
    return cost;
  }
  
  private findNearestWalkableTile(x: number, y: number, map: MapTile[][]): { x: number; y: number } | null {
    // Check in spiraling pattern around the target
    const maxRadius = 5; // Maximum search radius
    
    for (let radius = 1; radius <= maxRadius; radius++) {
      // Check tiles in a square around the target
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Skip tiles that aren't on the perimeter of the square
          if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
            continue;
          }
          
          const nx = x + dx;
          const ny = y + dy;
          
          // Check if in bounds
          if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
            // Check if walkable
            if (map[ny][nx].walkable) {
              return { x: nx, y: ny };
            }
          }
        }
      }
    }
    
    // No walkable tile found within range
    return null;
  }
  
  /**
   * Find all tiles reachable within a certain movement range from a starting position
   * @param startX Starting X position in grid coordinates
   * @param startY Starting Y position in grid coordinates
   * @param movementRange Maximum movement range in tiles
   * @returns Array of reachable positions {x, y}
   */
  findReachableTiles(startX: number, startY: number, movementRange: number): { x: number; y: number }[] {
    // Get the map from the scene
    let map;
    
    // First try to use GameScene's getMap method if available
    if (typeof (this.scene as any).getMap === 'function') {
      map = (this.scene as any).getMap();
    } else {
      // Fallback to registry
      map = this.scene.game.registry.get("map") || [];
    }
    
    // Safety check
    if (!map || !Array.isArray(map) || map.length === 0) {
      console.error("Invalid map data in findReachableTiles");
      return [];
    }
    
    // Keep track of visited tiles to avoid duplicates
    const visited = new Set<string>();
    const reachableTiles: { x: number; y: number }[] = [];
    
    // Queue for breadth-first search (BFS)
    const queue: { x: number; y: number; distance: number }[] = [
      { x: startX, y: startY, distance: 0 }
    ];
    
    // BFS to find all reachable tiles within the movement range
    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;
      
      // Skip if we've already visited this tile
      if (visited.has(key)) continue;
      
      // Mark as visited
      visited.add(key);
      
      // Add to reachable tiles (except the starting position)
      if (current.x !== startX || current.y !== startY) {
        reachableTiles.push({ x: current.x, y: current.y });
      }
      
      // Stop exploring from this tile if we've reached the movement limit
      if (current.distance >= movementRange) continue;
      
      // Check all four adjacent tiles
      const directions = [
        { dx: 0, dy: -1 }, // North
        { dx: 1, dy: 0 },  // East
        { dx: 0, dy: 1 },  // South
        { dx: -1, dy: 0 }  // West
      ];
      
      for (const dir of directions) {
        const nextX = current.x + dir.dx;
        const nextY = current.y + dir.dy;
        
        // Check if the position is valid and walkable
        if (
          nextX >= 0 && nextX < map[0].length &&
          nextY >= 0 && nextY < map.length &&
          map[nextY] && map[nextY][nextX] && 
          map[nextY][nextX].walkable
        ) {
          // Calculate movement cost to this tile
          const movementCost = this.movementCost(current.x, current.y, nextX, nextY, map);
          const newDistance = current.distance + movementCost;
          
          // Only add to queue if it's within movement range
          if (newDistance <= movementRange) {
            queue.push({ x: nextX, y: nextY, distance: newDistance });
          }
        }
      }
    }
    
    return reachableTiles;
  }
}

// Node interface for A* pathfinding
interface Node {
  x: number;
  y: number;
  g: number; // Cost from start to current node
  h: number; // Heuristic cost from current to target
  f: number; // Total cost (g + h)
  parent: Node | null;
}
