/**
 * Asset Generator for How Far App
 * Run: node scripts/generate-assets.js
 * 
 * Requires: npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Brand colors
const PRIMARY = '#E85A24';
const PRIMARY_DARK = '#C44A1C';
const WHITE = '#FFFFFF';
const BACKGROUND = '#FFFBF7';

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

/**
 * Draw the How Far logo - a stylized road/path with location pin
 */
function drawLogo(ctx, centerX, centerY, size, color = WHITE) {
  const scale = size / 200;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  
  // Draw a stylized car/road icon
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Location pin (simplified)
  ctx.beginPath();
  ctx.arc(0, -30, 35, 0, Math.PI * 2);
  ctx.fill();
  
  // Pin point
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.lineTo(0, 40);
  ctx.lineTo(20, -10);
  ctx.closePath();
  ctx.fill();
  
  // Inner circle (cut out effect with background)
  ctx.fillStyle = PRIMARY;
  ctx.beginPath();
  ctx.arc(0, -30, 18, 0, Math.PI * 2);
  ctx.fill();
  
  // Car silhouette in the pin
  ctx.fillStyle = color;
  ctx.beginPath();
  // Simple car shape
  ctx.roundRect(-12, -38, 24, 12, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-10, -28, 20, 8, 2);
  ctx.fill();
  
  // Road lines below
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(0, 55);
  ctx.lineTo(0, 90);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.restore();
}

/**
 * Draw text with custom styling
 */
function drawText(ctx, text, x, y, fontSize, color = WHITE, bold = true) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/**
 * Generate main app icon (1024x1024)
 */
function generateIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background with gradient
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/1.5);
  gradient.addColorStop(0, PRIMARY);
  gradient.addColorStop(1, PRIMARY_DARK);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Draw logo
  drawLogo(ctx, size/2, size/2 - 80, 350, WHITE);
  
  // Draw app name
  drawText(ctx, 'HOW FAR', size/2, size/2 + 220, 120, WHITE, true);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), buffer);
  console.log('✅ Generated icon.png (1024x1024)');
}

/**
 * Generate adaptive icon foreground (1024x1024 with safe zone)
 * Android adaptive icons need content in the center 66% area
 */
function generateAdaptiveIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Transparent background (the app.json sets backgroundColor)
  ctx.clearRect(0, 0, size, size);
  
  // Draw logo (smaller to fit in safe zone - center 66%)
  drawLogo(ctx, size/2, size/2 - 40, 280, WHITE);
  
  // Draw app name (optional, can be removed for cleaner look)
  drawText(ctx, 'HOW FAR', size/2, size/2 + 180, 80, WHITE, true);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), buffer);
  console.log('✅ Generated adaptive-icon.png (1024x1024)');
}

/**
 * Generate splash screen icon
 */
function generateSplashIcon() {
  const size = 400;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Transparent background (splash backgroundColor is set in app.json)
  ctx.clearRect(0, 0, size, size);
  
  // Draw logo
  drawLogo(ctx, size/2, size/2 - 30, 200, WHITE);
  
  // Draw app name below
  drawText(ctx, 'HOW FAR', size/2, size/2 + 120, 48, WHITE, true);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), buffer);
  console.log('✅ Generated splash-icon.png (400x400)');
}

/**
 * Generate favicon for web
 */
function generateFavicon() {
  const size = 64;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/1.5);
  gradient.addColorStop(0, PRIMARY);
  gradient.addColorStop(1, PRIMARY_DARK);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Simple pin icon for favicon
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(size/2, size/2 - 5, 15, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(size/2 - 8, size/2 + 5);
  ctx.lineTo(size/2, size/2 + 25);
  ctx.lineTo(size/2 + 8, size/2 + 5);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = PRIMARY;
  ctx.beginPath();
  ctx.arc(size/2, size/2 - 5, 7, 0, Math.PI * 2);
  ctx.fill();
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(assetsDir, 'favicon.png'), buffer);
  console.log('✅ Generated favicon.png (64x64)');
}

// Run all generators
console.log('🎨 Generating How Far app assets...\n');
try {
  generateIcon();
  generateAdaptiveIcon();
  generateSplashIcon();
  generateFavicon();
  console.log('\n✅ All assets generated successfully!');
  console.log(`📁 Location: ${assetsDir}`);
} catch (error) {
  console.error('❌ Error generating assets:', error.message);
  console.log('\n💡 Make sure to install canvas: npm install canvas');
}

