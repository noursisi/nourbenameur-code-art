/**
 * Blob Track — TouchDesigner-style blob tracking.
 * Boxes show CROPPED IMAGE CONTENT inside them.
 * Plain integer IDs. Full mesh lines. No blinking.
 */

import { Algorithm } from '../base.js';

const TEXT_POOL = [
  'Heartbeat lost in frames per second,',
  'Glitched out like we never happened.',
  'You saw the light bend,',
  'I was never really here.',
  'Not touch, just detection,',
  'Your silence in projection.',
  'Luma fades like memory,',
  'Tracking what we\'ll never be.',
  'All that moves isn\'t alive,',
  'Flicker through the static noise,',
  'But I still follow like it\'s mine.',
  'I trace the places I escape.',
  'Blurry outlines, ghosted shapes,',
  'I saw the break.',
  'Signal lost between the frames,',
  'Every pixel holds a ghost,',
  'The algorithm remembers you,',
];

const MULTI_COLORS = ['#00ddff','#ff3344','#00ff88','#ffdd00','#ff69b4','#ff8800','#aa55ff','#55ffaa','#ffffff'];

// ── Detection: find individual bright spots on a fine grid ───────────────────

function detect(canvas, W, H, threshold, maxBlobs) {
  const sW = 48, sH = 36;
  const off = document.createElement('canvas');
  off.width = sW; off.height = sH;
  const c = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(canvas, 0, 0, sW, sH);
  const d = c.getImageData(0, 0, sW, sH).data;
  const cellW = W / sW, cellH = H / sH;

  // Brightness grid
  const g = new Float32Array(sW * sH);
  for (let i = 0; i < sW * sH; i++) {
    const j = i * 4;
    g[i] = (d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114) / 255;
  }

  // Find local maxima (3x3 neighborhood) above threshold
  const peaks = [];
  for (let y = 1; y < sH - 1; y++) {
    for (let x = 1; x < sW - 1; x++) {
      const v = g[y * sW + x];
      if (v < threshold) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++)
        for (let dx = -1; dx <= 1 && isMax; dx++) {
          if (!dx && !dy) continue;
          if (g[(y+dy) * sW + (x+dx)] >= v) isMax = false;
        }
      if (isMax) peaks.push({ x: (x + 0.5) * cellW, y: (y + 0.5) * cellH, v });
    }
  }

  // Sort by brightness, return top N
  peaks.sort((a, b) => b.v - a.v);
  return peaks.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    this._blobs = [];
    this._nextId = 900;
    this._capturedCanvas = null; // store a captured frame for box content
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Blob tracking with image crops inside boxes, integer IDs, full mesh connections.' };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.1,  max: 0.95, step: 0.02 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 2,    max: 50,   step: 1    },
      { id: 'bt_boxSize',   label: 'Box Size',  min: 15,   max: 80,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text Size', min: 6,    max: 18,   step: 1    },
      { id: 'bt_color',     label: 'Color',     min: 0,    max: 1,    step: 1    },
      { id: 'bt_seed',      label: 'Seed',      min: 0,    max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.1, max: 0.95, step: 0.02 }; }
  animate() {}

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.2 + Math.random() * 0.4).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 30));
    set('bt_boxSize',   Math.floor(20 + Math.random() * 50));
    set('bt_lines',     parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_color',     Math.round(Math.random()));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const threshold = s.bt_threshold ?? 0.4;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const boxSize   = s.bt_boxSize ?? 35;
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const multiColor = Math.round(s.bt_color ?? 0) === 1;
    const seed      = Math.round(s.bt_seed ?? 42);
    const fg        = s.fgColor || '#ffffff';

    // ── Capture canvas for drawing image crops inside boxes ──────────────────
    const dpr = window.devicePixelRatio || 1;
    if (!this._capturedCanvas) {
      this._capturedCanvas = document.createElement('canvas');
    }
    this._capturedCanvas.width = Math.round(W);
    this._capturedCanvas.height = Math.round(H);
    const capCtx = this._capturedCanvas.getContext('2d');
    // Draw at 1:1 CSS resolution (no DPR) for easy cropping later
    capCtx.drawImage(ctx.canvas, 0, 0, Math.round(W), Math.round(H));

    // ── Detect ───────────────────────────────────────────────────────────────
    const peaks = detect(ctx.canvas, W, H, threshold, maxBlobs + 10);

    // ── Match to existing blobs ──────────────────────────────────────────────
    const matchR = Math.min(W, H) * 0.12;
    const usedP = new Set();

    for (const blob of this._blobs) {
      let bestD = Infinity, bestPi = -1;
      for (let pi = 0; pi < peaks.length; pi++) {
        if (usedP.has(pi)) continue;
        const d = Math.hypot(peaks[pi].x - blob.x, peaks[pi].y - blob.y);
        if (d < bestD && d < matchR) { bestD = d; bestPi = pi; }
      }
      if (bestPi >= 0) {
        const p = peaks[bestPi];
        usedP.add(bestPi);
        blob.x += (p.x - blob.x) * 0.4;
        blob.y += (p.y - blob.y) * 0.4;
        blob.missing = 0;
        blob.confirmed = Math.min(blob.confirmed + 1, 100);
      } else {
        blob.missing++;
      }
      blob.age++;
    }

    // New blobs
    for (let pi = 0; pi < peaks.length; pi++) {
      if (usedP.has(pi)) continue;
      if (this._blobs.length >= maxBlobs) break;
      const p = peaks[pi];
      this._blobs.push({
        x: p.x, y: p.y,
        id: this._nextId++,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        colorIdx: Math.floor(Math.random() * MULTI_COLORS.length),
        age: 0, missing: 0, confirmed: 1,
        bw: boxSize * (0.6 + Math.random() * 0.8),
        bh: boxSize * (0.4 + Math.random() * 0.6),
      });
    }

    // Kill long-missing
    this._blobs = this._blobs.filter(b => b.missing < 80);

    // Clamp
    for (const b of this._blobs) {
      b.x = Math.max(5, Math.min(W - 5, b.x));
      b.y = Math.max(5, Math.min(H - 5, b.y));
    }

    // Only show confirmed blobs (seen 4+ frames)
    const visible = this._blobs.filter(b => b.confirmed >= 4 && b.missing < 40);
    if (visible.length === 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // ── Full mesh connection lines ───────────────────────────────────────────
    if (lineAmt > 0 && visible.length > 1) {
      ctx.lineWidth = 0.7;
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          const fadeA = Math.max(0, 1 - a.missing / 40);
          const fadeB = Math.max(0, 1 - b.missing / 40);
          const alpha = lineAmt * 0.3 * fadeA * fadeB;
          if (alpha < 0.01) continue;
          ctx.strokeStyle = multiColor ? MULTI_COLORS[a.colorIdx] : fg;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // ── Boxes with image crops inside ────────────────────────────────────────
    for (const blob of visible) {
      const fade = Math.max(0, 1 - blob.missing / 40);
      if (fade < 0.02) continue;

      const color = multiColor ? MULTI_COLORS[blob.colorIdx] : fg;
      const bw = blob.bw;
      const bh = blob.bh;
      const bx = blob.x - bw / 2;
      const by = blob.y - bh / 2;

      // ── Image crop inside the box ──────────────────────────────────────────
      ctx.globalAlpha = fade * 0.7;
      try {
        // Crop from the captured canvas at this blob's position
        const srcX = Math.max(0, Math.floor(blob.x - bw * 0.7));
        const srcY = Math.max(0, Math.floor(blob.y - bh * 0.7));
        const srcW = Math.floor(bw * 1.4);
        const srcH = Math.floor(bh * 1.4);
        ctx.drawImage(this._capturedCanvas, srcX, srcY, srcW, srcH, bx, by, bw, bh);
      } catch (e) {}

      // ── Box outline ────────────────────────────────────────────────────────
      ctx.strokeStyle = color;
      ctx.globalAlpha = fade * 0.8;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      // ── Corner ticks ───────────────────────────────────────────────────────
      const tick = Math.min(7, Math.min(bw, bh) * 0.15);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      ctx.moveTo(bx, by + tick); ctx.lineTo(bx, by); ctx.lineTo(bx + tick, by);
      ctx.moveTo(bx + bw - tick, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + tick);
      ctx.moveTo(bx, by + bh - tick); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + tick, by + bh);
      ctx.moveTo(bx + bw - tick, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - tick);
      ctx.stroke();

      // ── ID number (plain integer, below box) ──────────────────────────────
      ctx.font = `${textSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.globalAlpha = fade * 0.85;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(blob.id), bx, by + bh + 2);

      // ── Text annotation (every 3rd blob) ───────────────────────────────────
      if (blob.age > 10 && (blob.id + seed) % 3 === 0) {
        ctx.font = `italic ${textSize - 1}px Helvetica, Arial, sans-serif`;
        ctx.globalAlpha = fade * 0.5;
        ctx.fillText(TEXT_POOL[blob.textIdx % TEXT_POOL.length], bx, by + bh + textSize + 4);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
