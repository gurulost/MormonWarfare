import Phaser from "phaser";

// This function loads all game assets during the BootScene
export function loadAssets(scene: Phaser.Scene) {
  // Load UI elements
  scene.load.setPath('/');

  // Menu assets
  scene.load.image('menu-background', 'textures/sand.jpg');

  // Terrain textures
  scene.load.image('grass', 'textures/grass.png');
  scene.load.image('forest', 'textures/wood.jpg');
  scene.load.image('hills', 'textures/asphalt.png');
  scene.load.image('water', 'textures/sky.png');

  // Faction colors
  const colors = [
    { name: 'nephite', color: 0x0000ff },
    { name: 'lamanite', color: 0xff0000 }
  ];

  // Generate colored sprites dynamically
  colors.forEach(color => {
    // Generate worker unit
    createCircleTexture(scene, `${color.name}-worker`, color.color, 10);
    
    // Generate melee unit
    createRectangleTexture(scene, `${color.name}-melee`, color.color, 20, 20);
    
    // Generate ranged unit
    createTriangleTexture(scene, `${color.name}-ranged`, color.color, 20);
    
    // Generate city center
    createRectangleTexture(scene, `${color.name}-cityCenter`, color.color, 60, 60);
    
    // Generate barracks
    createRectangleTexture(scene, `${color.name}-barracks`, color.color, 40, 30);
    
    // Generate archery range
    createPolygonTexture(scene, `${color.name}-archeryRange`, color.color, 20);
    
    // Generate wall
    createRectangleTexture(scene, `${color.name}-wall`, color.color, 20, 20);
  });

  // Load sound effects
  scene.load.audio('background-music', 'sounds/background.mp3');
  scene.load.audio('hit-sound', 'sounds/hit.mp3');
  scene.load.audio('success-sound', 'sounds/success.mp3');
  scene.load.audio('gatherFood', 'sounds/hit.mp3');  // Reuse hit sound temporarily
  scene.load.audio('gatherOre', 'sounds/hit.mp3');   // Reuse hit sound temporarily
  scene.load.audio('deposit', 'sounds/success.mp3'); // Reuse success sound temporarily

  // Icons for resources
  createCircleTexture(scene, 'food-icon', 0x22aa22, 8);
  createCircleTexture(scene, 'ore-icon', 0x884422, 8);

  // UI elements
  createRectangleTexture(scene, 'ui-panel', 0x333333, 800, 150);
  createRectangleTexture(scene, 'button', 0x4a6c6f, 100, 30);
  createRectangleTexture(scene, 'button-hover', 0x5d8a8d, 100, 30);
  createRectangleTexture(scene, 'selection', 0x00ff00, 24, 24, 0.3, 2);
  createRectangleTexture(scene, 'minimap-bg', 0x000000, 150, 150, 0.7);
  createRectangleTexture(scene, 'health-bar-bg', 0x000000, 30, 5);
  createRectangleTexture(scene, 'health-bar', 0x00ff00, 30, 5);
  
  // Particle effects
  createCircleTexture(scene, 'particle', 0xffff00, 8);
  createCircleTexture(scene, 'particle-blue', 0x00aaff, 8);
  createCircleTexture(scene, 'particle-red', 0xff5555, 8);
}

// Helper function to create a colored circle texture
function createCircleTexture(
  scene: Phaser.Scene, 
  key: string, 
  color: number, 
  radius: number,
  alpha: number = 1,
  strokeWidth: number = 0,
  strokeColor: number = 0x000000
) {
  const graphics = scene.make.graphics({});
  
  graphics.fillStyle(color, alpha);
  if (strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, strokeColor, 1);
  }
  graphics.fillCircle(radius, radius, radius);
  if (strokeWidth > 0) {
    graphics.strokeCircle(radius, radius, radius);
  }
  
  graphics.generateTexture(key, radius * 2, radius * 2);
  graphics.destroy();
}

// Helper function to create a colored rectangle texture
function createRectangleTexture(
  scene: Phaser.Scene, 
  key: string, 
  color: number, 
  width: number, 
  height: number,
  alpha: number = 1,
  strokeWidth: number = 0,
  strokeColor: number = 0x000000
) {
  const graphics = scene.make.graphics({});
  
  graphics.fillStyle(color, alpha);
  if (strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, strokeColor, 1);
  }
  graphics.fillRect(0, 0, width, height);
  if (strokeWidth > 0) {
    graphics.strokeRect(0, 0, width, height);
  }
  
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

// Helper function to create a colored triangle texture
function createTriangleTexture(
  scene: Phaser.Scene, 
  key: string, 
  color: number, 
  size: number,
  alpha: number = 1,
  strokeWidth: number = 0,
  strokeColor: number = 0x000000
) {
  const graphics = scene.make.graphics({});
  
  graphics.fillStyle(color, alpha);
  if (strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, strokeColor, 1);
  }
  
  // Draw triangle
  graphics.beginPath();
  graphics.moveTo(size / 2, 0);
  graphics.lineTo(size, size);
  graphics.lineTo(0, size);
  graphics.closePath();
  graphics.fillPath();
  
  if (strokeWidth > 0) {
    graphics.strokePath();
  }
  
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

// Helper function to create a colored polygon texture
function createPolygonTexture(
  scene: Phaser.Scene, 
  key: string, 
  color: number, 
  radius: number,
  alpha: number = 1,
  strokeWidth: number = 0,
  strokeColor: number = 0x000000
) {
  const graphics = scene.make.graphics({});
  
  graphics.fillStyle(color, alpha);
  if (strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, strokeColor, 1);
  }
  
  // Draw pentagon (for archery range)
  const points = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2 / 5) - Math.PI / 2; // Start at top
    points.push({
      x: radius + Math.cos(angle) * radius,
      y: radius + Math.sin(angle) * radius
    });
  }
  
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i].x, points[i].y);
  }
  graphics.closePath();
  graphics.fillPath();
  
  if (strokeWidth > 0) {
    graphics.strokePath();
  }
  
  graphics.generateTexture(key, radius * 2, radius * 2);
  graphics.destroy();
}
