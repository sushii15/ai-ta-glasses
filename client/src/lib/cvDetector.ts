import type { BoundingBox } from "@shared/schema";

// Simulated CV detection engine
// In production this would use TensorFlow.js / YOLO / OpenCV.js
// Here we create realistic-feeling detections with pseudo-randomness
// seeded from frame data to give stable bounding boxes

const COMPONENT_CONFIGS = [
  {
    type: 'breadboard' as const,
    label: 'Breadboard',
    color: 'rgba(0, 200, 255, 0.85)',
    minConfidence: 0.88,
    maxConfidence: 0.97,
    // Large, stays roughly centered
    baseX: 0.12, baseY: 0.15, baseW: 0.76, baseH: 0.65,
    drift: 0.008,
  },
  {
    type: 'resistor' as const,
    label: 'Resistor (1kΩ)',
    color: 'rgba(255, 200, 0, 0.85)',
    minConfidence: 0.79,
    maxConfidence: 0.93,
    baseX: 0.28, baseY: 0.32, baseW: 0.12, baseH: 0.06,
    drift: 0.015,
  },
  {
    type: 'led' as const,
    label: 'LED (Red)',
    color: 'rgba(255, 80, 80, 0.85)',
    minConfidence: 0.84,
    maxConfidence: 0.95,
    baseX: 0.52, baseY: 0.38, baseW: 0.06, baseH: 0.08,
    drift: 0.012,
  },
  {
    type: 'wire' as const,
    label: 'Wire (Red/VCC)',
    color: 'rgba(255, 120, 0, 0.85)',
    minConfidence: 0.71,
    maxConfidence: 0.88,
    baseX: 0.18, baseY: 0.22, baseW: 0.20, baseH: 0.04,
    drift: 0.02,
  },
  {
    type: 'wire' as const,
    label: 'Wire (Black/GND)',
    color: 'rgba(100, 200, 140, 0.85)',
    minConfidence: 0.72,
    maxConfidence: 0.87,
    baseX: 0.18, baseY: 0.55, baseW: 0.20, baseH: 0.04,
    drift: 0.02,
  },
];

// Pseudo-random seeded by time to simulate stable detection
function seededRandom(seed: number, offset = 0): number {
  const x = Math.sin(seed * 9301 + offset * 49297 + 233) * 1000;
  return x - Math.floor(x);
}

let frameCount = 0;
let errorState = false;
let errorTimeout: ReturnType<typeof setTimeout> | null = null;

export function triggerErrorState(duration = 5000) {
  errorState = true;
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    errorState = false;
  }, duration);
}

export function detectComponents(timestamp: number): BoundingBox[] {
  frameCount++;
  const seed = Math.floor(timestamp / 200); // Update every 200ms for stable detection

  const boxes: BoundingBox[] = [];

  COMPONENT_CONFIGS.forEach((config, i) => {
    // Simulate detection confidence oscillation
    const conf = config.minConfidence + (config.maxConfidence - config.minConfidence) *
      seededRandom(seed, i * 10);

    // Only show if confidence high enough (simulate occlusion / out of frame)
    if (conf < 0.70) return;

    // Add drift for realistic bounding box movement
    const dx = (seededRandom(seed + 1, i * 7) - 0.5) * config.drift;
    const dy = (seededRandom(seed + 2, i * 11) - 0.5) * config.drift;

    const box: BoundingBox = {
      id: `component-${i}`,
      x: Math.max(0, Math.min(0.9, config.baseX + dx)),
      y: Math.max(0, Math.min(0.9, config.baseY + dy)),
      w: config.baseW,
      h: config.baseH,
      label: config.label,
      confidence: Math.round(conf * 100) / 100,
      type: config.type,
      color: config.color,
    };

    // Error state: mark resistor as misplaced, wire as wrong
    if (errorState) {
      if (config.type === 'resistor') {
        box.hasError = true;
        box.errorMessage = 'Resistor misplaced!';
        box.color = 'rgba(255, 80, 80, 0.85)';
        box.arrowTarget = { x: config.baseX + 0.18, y: config.baseY + 0.02 };
      }
      if (config.label.includes('VCC') && seededRandom(seed + 5, 99) > 0.5) {
        box.hasError = true;
        box.errorMessage = 'Missing ground!';
        box.color = 'rgba(255, 60, 60, 0.85)';
      }
    }

    boxes.push(box);
  });

  return boxes;
}

export function getDetectedComponents(boxes: BoundingBox[]): string[] {
  return boxes.map(b => b.label);
}

// Draw all bounding boxes + overlays onto a canvas
export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  boxes: BoundingBox[],
  width: number,
  height: number,
  scanLineY: number
) {
  ctx.clearRect(0, 0, width, height);

  // --- Scan line ---
  const gradient = ctx.createLinearGradient(0, scanLineY - 20, 0, scanLineY + 20);
  gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
  gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, scanLineY - 20, width, 40);

  // Thin bright scan line
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, scanLineY);
  ctx.lineTo(width, scanLineY);
  ctx.stroke();

  // --- Corner HUD decorations ---
  drawHudCorner(ctx, 0, 0, 30, 'rgba(0, 255, 255, 0.6)', 'tl');
  drawHudCorner(ctx, width, 0, 30, 'rgba(0, 255, 255, 0.6)', 'tr');
  drawHudCorner(ctx, 0, height, 30, 'rgba(0, 255, 255, 0.6)', 'bl');
  drawHudCorner(ctx, width, height, 30, 'rgba(0, 255, 255, 0.6)', 'br');

  // --- Grid overlay ---
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
  ctx.lineWidth = 0.5;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // --- Bounding boxes ---
  boxes.forEach((box) => {
    const px = box.x * width;
    const py = box.y * height;
    const pw = box.w * width;
    const ph = box.h * height;

    // Fill with translucent color
    ctx.fillStyle = box.color.replace('0.85', '0.08');
    ctx.fillRect(px, py, pw, ph);

    // Border
    ctx.strokeStyle = box.hasError ? 'rgba(255, 60, 60, 0.9)' : box.color;
    ctx.lineWidth = box.hasError ? 2.5 : 1.5;
    ctx.strokeRect(px, py, pw, ph);

    // Corner ticks
    drawBoxCorners(ctx, px, py, pw, ph, box.hasError ? 'rgba(255, 60, 60, 0.9)' : box.color);

    // Label background
    const labelText = `${box.label}  ${Math.round(box.confidence * 100)}%`;
    ctx.font = '11px "JetBrains Mono", monospace';
    const textW = ctx.measureText(labelText).width + 10;
    const labelY = py - 2;
    const labelBgY = labelY - 16;

    ctx.fillStyle = box.hasError ? 'rgba(180, 0, 0, 0.85)' : 'rgba(0, 20, 30, 0.85)';
    ctx.fillRect(px, labelBgY, textW, 18);

    // Label border
    ctx.strokeStyle = box.hasError ? 'rgba(255, 60, 60, 0.9)' : box.color;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px, labelBgY, textW, 18);

    // Label text
    ctx.fillStyle = box.hasError ? 'rgba(255, 150, 150, 1)' : box.color;
    ctx.fillText(labelText, px + 5, labelBgY + 13);

    // Error badge
    if (box.hasError && box.errorMessage) {
      const errText = `⚠ ${box.errorMessage}`;
      const errW = ctx.measureText(errText).width + 12;
      ctx.fillStyle = 'rgba(200, 0, 0, 0.9)';
      ctx.fillRect(px, py + ph + 2, errW, 18);
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.9)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(px, py + ph + 2, errW, 18);
      ctx.fillStyle = 'rgba(255, 200, 200, 1)';
      ctx.fillText(errText, px + 6, py + ph + 15);

      // Arrow pointing to correction position
      if (box.arrowTarget) {
        const tx = box.arrowTarget.x * width;
        const ty = box.arrowTarget.y * height;
        drawArrow(ctx, px + pw / 2, py + ph / 2, tx, ty, 'rgba(255, 200, 0, 0.9)');
      }
    }

    // Confidence bar (tiny)
    const barW = pw;
    const barH = 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(px, py + ph + (box.hasError ? 22 : 2), barW, barH);
    ctx.fillStyle = box.hasError ? 'rgba(255, 80, 80, 0.9)' : box.color;
    ctx.fillRect(px, py + ph + (box.hasError ? 22 : 2), barW * box.confidence, barH);
  });

  // --- Detection count HUD ---
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  const countText = `DETECTED: ${boxes.length} COMPONENTS`;
  ctx.fillStyle = 'rgba(0, 20, 30, 0.7)';
  ctx.fillRect(8, 8, ctx.measureText(countText).width + 12, 20);
  ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
  ctx.fillText(countText, 14, 22);

  // FPS counter simulation
  const fpsText = `${Math.floor(28 + Math.random() * 4)} FPS`;
  ctx.fillStyle = 'rgba(0, 20, 30, 0.7)';
  ctx.fillRect(width - 70, 8, 62, 20);
  ctx.fillStyle = 'rgba(100, 255, 180, 0.9)';
  ctx.fillText(fpsText, width - 64, 22);
}

function drawBoxCorners(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string
) {
  const s = 8; // corner size
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // TL
  ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(x, y + h - s); ctx.lineTo(x, y + h); ctx.lineTo(x + s, y + h); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(x + w - s, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - s); ctx.stroke();
}

function drawHudCorner(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  color: string, position: 'tl' | 'tr' | 'bl' | 'br'
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const s = size;
  ctx.beginPath();
  if (position === 'tl') {
    ctx.moveTo(x + s, y); ctx.lineTo(x, y); ctx.lineTo(x, y + s);
  } else if (position === 'tr') {
    ctx.moveTo(x - s, y); ctx.lineTo(x, y); ctx.lineTo(x, y + s);
  } else if (position === 'bl') {
    ctx.moveTo(x + s, y); ctx.lineTo(x, y); ctx.lineTo(x, y - s);
  } else if (position === 'br') {
    ctx.moveTo(x - s, y); ctx.lineTo(x, y); ctx.lineTo(x, y - s);
  }
  ctx.stroke();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
  color: string
) {
  const headLen = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}
