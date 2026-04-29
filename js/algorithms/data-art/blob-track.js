/**
 * Blob Track — connected-component blob tracking.
 * Thresholds image → finds connected bright regions → tracks with persistent IDs.
 * No edge detection tricks, no local maxima. Just actual blob regions.
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

// ── Connected-component blob detection ───────────────────────────────────────
// Downsamples, thresholds to binary, flood-fills to find connected regions,
// returns bounding boxes for each region.

function detectRegions(canvas, W, H, threshold, minArea, maxBlobs) {
  const sW = 96, sH = 72;
  const off = document.createElement('canvas');
  off.width = sW; off.height = sH;
  const c = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(canvas, 0, 0, sW, sH);
  const imgData = c.getImageData(0, 0, sW, sH);
  const d = imgData.data;

  // Build binary mask (1 = bright, 0 = dark)
  const mask = new Uint8Array(sW * sH);
  for (let i = 0; i < sW * sH; i++) {
    const j = i * 4;
    const brightness = (d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114) / 255;
    mask[i] = brightness >= threshold ? 1 : 0;
  }

  // Connected component labeling (flood fill)
  const labels = new Int16Array(sW * sH);
  labels.fill(-1);
  let nextLabel = 0;
  const regions = []; // { minX, minY, maxX, maxY, area, cx, cy }

  for (let y = 0; y < sH; y++) {
    for (let x = 0; x < sW; x++) {
      const idx = y * sW + x;
      if (mask[idx] === 0 || labels[idx] >= 0) continue;

      // BFS flood fill
      const label = nextLabel++;
      const queue = [idx];
      labels[idx] = label;
      let minX = x, maxX = x, minY = y, maxY = y, sumX = 0, sumY = 0, area = 0;

      while (queue.length > 0) {
        const ci = queue.pop();
        const cx = ci % sW;
        const cy = (ci - cx) / sW;
        sumX += cx; sumY += cy; area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // 4-connected neighbors
        const neighbors = [
          cy > 0 ? ci - sW : -1,
          cy < sH-1 ? ci + sW : -1,
          cx > 0 ? ci - 1 : -1,
          cx < sW-1 ? ci + 1 : -1,
        ];
        for (const ni of neighbors) {
          if (ni >= 0 && mask[ni] === 1 && labels[ni] < 0) {
            labels[ni] = label;
            queue.push(ni);
          }
        }
      }

      if (area >= minArea) {
        const scaleX = W / sW;
        const scaleY = H / sH;
        regions.push({
          x: (sumX / area) * scaleX,
          y: (sumY / area) * scaleY,
          w: (maxX - minX + 1) * scaleX,
          h: (maxY - minY + 1) * scaleY,
          area,
        });
      }
    }
  }

  regions.sort((a, b) => b.area - a.area);
  return regions.slice(0, maxBlobs);
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
      desc: 'Connected-component blob tracking — finds bright regions, wraps them in boxes, tracks with persistent IDs.' };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.1, max: 0.95, step: 0.02 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 2,   max: 30,   step: 1    },
      { id: 'bt_boxSize',   label: 'Min Size',  min: 2,   max: 20,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,   max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text Size', min: 6,   max: 18,   step: 1    },
      { id: 'bt_jitter',    label: 'Jitter',    min: 0,   max: 0.5,  step: 0.02 },
      { id: 'bt_seed',      label: 'Seed',      min: 0,   max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.1, max: 0.95, step: 0.02 }; }
  animate() {}

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.2 + Math.random() * 0.5).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(4 + Math.random() * 20));
    set('bt_boxSize',   Math.floor(3 + Math.random() * 12));
    set('bt_lines',     parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_jitter',    parseFloat((Math.random() * 0.3).toFixed(2)));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const threshold = s.bt_threshold ?? 0.4;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 12);
    const minSize   = Math.round(s.bt_boxSize ?? 4);
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const jitter    = s.bt_jitter ?? 0.1;
    const seed      = Math.round(s.bt_seed ?? 42);
    const t         = s.time ?? 0;
    const fg        = s.fgColor || '#ffffff';

    // ── Detect connected bright regions ──────────────────────────────────────
    const regions = detectRegions(ctx.canvas, W, H, threshold, minSize, maxBlobs + 5);

    // ── Match to existing blobs ──────────────────────────────────────────────
    const matchR = Math.min(W, H) * 0.15;
    const usedRegions = new Set();
    const usedBlobs = new Set();

    for (let bi = 0; bi < this._blobs.length; bi++) {
      const blob = this._blobs[bi];
      let bestD = Infinity, bestRi = -1;
      for (let ri = 0; ri < regions.length; ri++) {
        if (usedRegions.has(ri)) continue;
        const d = Math.hypot(regions[ri].x - blob.x, regions[ri].y - blob.y);
        if (d < bestD && d < matchR) { bestD = d; bestRi = ri; }
      }
      if (bestRi >= 0) {
        const r = regions[bestRi];
        usedRegions.add(bestRi);
        usedBlobs.add(bi);
        blob.x += (r.x - blob.x) * 0.5;
        blob.y += (r.y - blob.y) * 0.5;
        blob.w += (r.w - blob.w) * 0.4;
        blob.h += (r.h - blob.h) * 0.4;
        blob.missing = 0;
        blob.age++;
      } else {
        usedBlobs.add(bi);
        blob.missing++;
        blob.age++;
      }
    }

    // New blobs from unmatched regions
    for (let ri = 0; ri < regions.length; ri++) {
      if (usedRegions.has(ri)) continue;
      if (this._blobs.length >= maxBlobs) break;
      const r = regions[ri];
      this._blobs.push({
        x: r.x, y: r.y, w: r.w, h: r.h,
        id: this._nextId++,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        age: 0, missing: 0,
      });
    }

    // Kill blobs missing too long
    this._blobs = this._blobs.filter(b => b.missing < 60);

    // Clamp all positions inside canvas
    for (const b of this._blobs) {
      b.x = Math.max(0, Math.min(W, b.x));
      b.y = Math.max(0, Math.min(H, b.y));
    }

    if (this._blobs.length === 0) return;

    // ── Draw ─────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    const visible = this._blobs.filter(b => b.missing < 30);

    // Full mesh lines
    if (lineAmt > 0 && visible.length > 1) {
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = fg;
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          const fadeA = Math.max(0, 1 - a.missing / 30);
          const fadeB = Math.max(0, 1 - b.missing / 30);
          ctx.globalAlpha = lineAmt * 0.35 * fadeA * fadeB;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Boxes
    for (const blob of this._blobs) {
      const fade = Math.max(0, 1 - blob.missing / 30);
      if (fade < 0.02) continue;

      const jx = jitter > 0 ? Math.sin(t * 4 + blob.id * 0.4) * jitter * W * 0.01 : 0;
      const jy = jitter > 0 ? Math.cos(t * 3 + blob.id * 0.6) * jitter * H * 0.01 : 0;

      // Use actual region dimensions for the box
      const bw = Math.max(15, blob.w);
      const bh = Math.max(12, blob.h);
      const bx = blob.x + jx - bw / 2;
      const by = blob.y + jy - bh / 2;

      // Box
      ctx.strokeStyle = fg;
      ctx.globalAlpha = fade * 0.65;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner ticks
      const tick = Math.min(7, Math.min(bw, bh) * 0.2);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx, by + tick); ctx.lineTo(bx, by); ctx.lineTo(bx + tick, by);
      ctx.moveTo(bx + bw - tick, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + tick);
      ctx.moveTo(bx, by + bh - tick); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + tick, by + bh);
      ctx.moveTo(bx + bw - tick, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - tick);
      ctx.stroke();

      // Hex ID
      ctx.font = `${textSize}px monospace`;
      ctx.fillStyle = fg;
      ctx.globalAlpha = fade * 0.85;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('0x' + (blob.id & 0xFF).toString(16).toUpperCase().padStart(2, '0'), bx + 1, by - 2);

      // Text annotation (every 3rd blob)
      if (blob.age > 5 && (blob.id + seed) % 3 === 0) {
        ctx.font = `italic ${textSize - 1}px serif`;
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
