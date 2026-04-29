/**
 * Blob Track — grid-based blob detection with size limiting.
 * Splits large bright areas into multiple boxes instead of one giant blob.
 * Blobs must be confirmed for 3 frames before appearing (no blinking).
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
  'Nothing here was ever saved.',
  'Every pixel holds a ghost,',
  'The algorithm remembers you,',
];

// ── Grid-based detection with max blob size ──────────────────────────────────

function detectBlobs(canvas, W, H, threshold, maxBlobs, maxBlobCells) {
  const gW = 24, gH = 18; // grid resolution
  const off = document.createElement('canvas');
  off.width = gW; off.height = gH;
  const c = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(canvas, 0, 0, gW, gH);
  const d = c.getImageData(0, 0, gW, gH).data;

  const cellW = W / gW, cellH = H / gH;

  // Brightness per cell
  const bright = new Float32Array(gW * gH);
  for (let i = 0; i < gW * gH; i++) {
    const j = i * 4;
    bright[i] = (d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114) / 255;
  }

  // Mark cells above threshold
  const on = new Uint8Array(gW * gH);
  for (let i = 0; i < gW * gH; i++) on[i] = bright[i] >= threshold ? 1 : 0;

  // Connected components with MAX SIZE — split large components
  const labels = new Int16Array(gW * gH).fill(-1);
  let nextLabel = 0;
  const components = [];

  for (let y = 0; y < gH; y++) {
    for (let x = 0; x < gW; x++) {
      const idx = y * gW + x;
      if (!on[idx] || labels[idx] >= 0) continue;

      // BFS flood fill but stop at maxBlobCells
      const label = nextLabel++;
      const queue = [idx];
      labels[idx] = label;
      const cells = [];

      while (queue.length > 0 && cells.length < maxBlobCells) {
        const ci = queue.shift();
        cells.push(ci);
        const cx = ci % gW, cy = (ci - cx) / gW;
        const nb = [
          cy > 0 ? ci - gW : -1,
          cy < gH-1 ? ci + gW : -1,
          cx > 0 ? ci - 1 : -1,
          cx < gW-1 ? ci + 1 : -1,
        ];
        for (const ni of nb) {
          if (ni >= 0 && on[ni] && labels[ni] < 0) {
            labels[ni] = label;
            queue.push(ni);
          }
        }
      }

      // If queue still has items, they become seeds for NEW components
      // (this splits large regions)
      for (const leftover of queue) {
        labels[leftover] = -1; // reset so they get picked up as new components
      }

      if (cells.length >= 2) {
        let minX = gW, maxX = 0, minY = gH, maxY = 0, sumX = 0, sumY = 0;
        for (const ci of cells) {
          const cx = ci % gW, cy = (ci - cx) / gW;
          if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
          sumX += cx; sumY += cy;
        }
        components.push({
          x: (sumX / cells.length + 0.5) * cellW,
          y: (sumY / cells.length + 0.5) * cellH,
          w: (maxX - minX + 1) * cellW,
          h: (maxY - minY + 1) * cellH,
          area: cells.length,
        });
      }
    }
  }

  components.sort((a, b) => b.area - a.area);
  return components.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    this._blobs = [];
    this._nextId = 0;
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Blob tracking — finds bright regions, tracks with persistent IDs, draws connection mesh.' };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.1, max: 0.95, step: 0.02 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 2,   max: 30,   step: 1    },
      { id: 'bt_boxSize',   label: 'Max Size',  min: 3,   max: 12,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,   max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text Size', min: 6,   max: 18,   step: 1    },
      { id: 'bt_jitter',    label: 'Jitter',    min: 0,   max: 0.3,  step: 0.02 },
      { id: 'bt_seed',      label: 'Seed',      min: 0,   max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.1, max: 0.95, step: 0.02 }; }
  animate() {}

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.2 + Math.random() * 0.4).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 20));
    set('bt_boxSize',   Math.floor(4 + Math.random() * 6));
    set('bt_lines',     parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_jitter',    parseFloat((Math.random() * 0.15).toFixed(2)));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const threshold = s.bt_threshold ?? 0.4;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 12);
    const maxSize   = Math.round(s.bt_boxSize ?? 6);
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const jitter    = s.bt_jitter ?? 0.08;
    const seed      = Math.round(s.bt_seed ?? 42);
    const t         = s.time ?? 0;
    const fg        = s.fgColor || '#ffffff';

    // Detect
    const regions = detectBlobs(ctx.canvas, W, H, threshold, maxBlobs + 5, maxSize);

    // Match to existing
    const matchR = Math.min(W, H) * 0.15;
    const usedR = new Set();

    for (const blob of this._blobs) {
      let bestD = Infinity, bestRi = -1;
      for (let ri = 0; ri < regions.length; ri++) {
        if (usedR.has(ri)) continue;
        const d = Math.hypot(regions[ri].x - blob.x, regions[ri].y - blob.y);
        if (d < bestD && d < matchR) { bestD = d; bestRi = ri; }
      }
      if (bestRi >= 0) {
        const r = regions[bestRi];
        usedR.add(bestRi);
        blob.x += (r.x - blob.x) * 0.5;
        blob.y += (r.y - blob.y) * 0.5;
        blob.w += (r.w - blob.w) * 0.3;
        blob.h += (r.h - blob.h) * 0.3;
        blob.missing = 0;
        blob.confirmed++;
      } else {
        blob.missing++;
      }
      blob.age++;
    }

    // New blobs
    for (let ri = 0; ri < regions.length; ri++) {
      if (usedR.has(ri)) continue;
      if (this._blobs.length >= maxBlobs) break;
      const r = regions[ri];
      this._blobs.push({
        x: r.x, y: r.y, w: r.w, h: r.h,
        id: this._nextId++,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        age: 0, missing: 0, confirmed: 1,
      });
    }

    // Kill old missing blobs
    this._blobs = this._blobs.filter(b => b.missing < 60);

    // Clamp inside canvas
    for (const b of this._blobs) {
      b.x = Math.max(b.w / 2, Math.min(W - b.w / 2, b.x));
      b.y = Math.max(b.h / 2, Math.min(H - b.h / 2, b.y));
    }

    // Only draw blobs confirmed for 3+ frames (no blinking)
    const visible = this._blobs.filter(b => b.confirmed >= 3 && b.missing < 30);
    if (visible.length === 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // Mesh lines
    if (lineAmt > 0 && visible.length > 1) {
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = fg;
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          const fa = Math.max(0, 1 - a.missing / 30);
          const fb = Math.max(0, 1 - b.missing / 30);
          ctx.globalAlpha = lineAmt * 0.35 * fa * fb;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Boxes
    for (const blob of visible) {
      const fade = Math.max(0, 1 - blob.missing / 30);
      if (fade < 0.02) continue;

      const jx = jitter > 0 ? Math.sin(t * 4 + blob.id * 0.4) * jitter * W * 0.01 : 0;
      const jy = jitter > 0 ? Math.cos(t * 3 + blob.id * 0.6) * jitter * H * 0.01 : 0;

      const bw = Math.max(14, blob.w);
      const bh = Math.max(10, blob.h);
      const bx = blob.x + jx - bw / 2;
      const by = blob.y + jy - bh / 2;

      // Box
      ctx.strokeStyle = fg;
      ctx.globalAlpha = fade * 0.65;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner ticks
      const tick = Math.min(6, Math.min(bw, bh) * 0.2);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx, by + tick); ctx.lineTo(bx, by); ctx.lineTo(bx + tick, by);
      ctx.moveTo(bx + bw - tick, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + tick);
      ctx.moveTo(bx, by + bh - tick); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + tick, by + bh);
      ctx.moveTo(bx + bw - tick, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - tick);
      ctx.stroke();

      // Hex ID — Helvetica
      ctx.font = `${textSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = fg;
      ctx.globalAlpha = fade * 0.85;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('0x' + (blob.id & 0xFF).toString(16).toUpperCase().padStart(2, '0'), bx + 1, by - 2);

      // Text — Helvetica italic
      if (blob.age > 8 && (blob.id + seed) % 3 === 0) {
        ctx.font = `italic ${textSize - 1}px Helvetica, Arial, sans-serif`;
        ctx.globalAlpha = fade * 0.55;
        ctx.textBaseline = 'top';
        ctx.fillText(TEXT_POOL[blob.textIdx % TEXT_POOL.length], bx, by + bh + 3);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
