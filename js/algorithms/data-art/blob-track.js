/**
 * Blob Track — TouchDesigner-style blob detection overlay.
 * Detects bright/contrasty regions, draws cyan tracking boxes with hex IDs,
 * full-mesh connection lines between all blobs, optional text annotations.
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

// ── Fast blob detection (tiny downsampled canvas) ────────────────────────────

function detectBlobs(sourceCanvas, W, H, threshold, maxBlobs) {
  // Downsample to tiny resolution for speed
  const sW = 80, sH = 60;
  const off = document.createElement('canvas');
  off.width = sW;
  off.height = sH;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(sourceCanvas, 0, 0, sW, sH);
  const data = offCtx.getImageData(0, 0, sW, sH).data;

  const cellW = W / sW;
  const cellH = H / sH;

  // Compute brightness + edge strength
  const grid = new Float32Array(sW * sH);
  for (let i = 0; i < sW * sH; i++) {
    const idx = i * 4;
    grid[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
  }

  // Find interest points (brightness + edges)
  const peaks = [];
  for (let y = 2; y < sH - 2; y++) {
    for (let x = 2; x < sW - 2; x++) {
      const b = grid[y * sW + x];
      const gx = grid[y * sW + x + 1] - grid[y * sW + x - 1];
      const gy = grid[(y + 1) * sW + x] - grid[(y - 1) * sW + x];
      const edge = Math.sqrt(gx * gx + gy * gy);
      const interest = b * 0.5 + edge * 3.0;

      if (interest < threshold) continue;

      // Local max (3x3)
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1 && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = (y + dy) * sW + (x + dx);
          const nb = grid[ni];
          const ngx = grid[(y + dy) * sW + (x + dx + 1)] - grid[(y + dy) * sW + (x + dx - 1)];
          const ngy = grid[((y + dy) + 1) * sW + (x + dx)] - grid[((y + dy) - 1) * sW + (x + dx)];
          const ne = Math.sqrt(ngx * ngx + ngy * ngy);
          if (nb * 0.5 + ne * 3.0 >= interest) isMax = false;
        }
      }
      if (isMax) peaks.push({ x: (x + 0.5) * cellW, y: (y + 0.5) * cellH, interest });
    }
  }

  // Merge nearby
  const merged = [];
  const used = new Set();
  const mergeR = Math.min(W, H) * 0.05;
  for (let i = 0; i < peaks.length; i++) {
    if (used.has(i)) continue;
    let cx = peaks[i].x, cy = peaks[i].y, best = peaks[i].interest, n = 1;
    for (let j = i + 1; j < peaks.length; j++) {
      if (used.has(j)) continue;
      if (Math.hypot(peaks[i].x - peaks[j].x, peaks[i].y - peaks[j].y) < mergeR) {
        cx += peaks[j].x; cy += peaks[j].y;
        best = Math.max(best, peaks[j].interest);
        n++; used.add(j);
      }
    }
    merged.push({ x: cx / n, y: cy / n, interest: best });
    used.add(i);
  }

  merged.sort((a, b) => b.interest - a.interest);
  return merged.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    this._tracked = [];
    this._idCounter = 0;
  }

  get metadata() {
    return {
      name: 'Blob Track',
      eq: 'detect × annotate',
      cat: 'Data Art',
      desc: 'TouchDesigner blob tracking — cyan boxes, hex IDs, full-mesh connection lines, text annotations.',
    };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.05, max: 0.95, step: 0.02 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 3,    max: 40,   step: 1    },
      { id: 'bt_boxSize',   label: 'Box Size',  min: 8,    max: 60,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text Size', min: 6,    max: 18,   step: 1    },
      { id: 'bt_jitter',    label: 'Jitter',    min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_seed',      label: 'Seed',      min: 0,    max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.05, max: 0.95, step: 0.02 }; }
  animate() {}

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.1 + Math.random() * 0.5).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 25));
    set('bt_boxSize',   Math.floor(12 + Math.random() * 35));
    set('bt_lines',     parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_jitter',    parseFloat((Math.random() * 0.5).toFixed(2)));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const threshold = s.bt_threshold ?? 0.3;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const boxSize   = s.bt_boxSize ?? 25;
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const jitter    = s.bt_jitter ?? 0.2;
    const seed      = Math.round(s.bt_seed ?? 42);
    const t         = s.time ?? 0;
    const fg        = s.fgColor || '#ffffff';

    // ── Detect every frame ───────────────────────────────────────────────────
    const rawBlobs = detectBlobs(ctx.canvas, W, H, threshold, maxBlobs);

    // ── Track: match to existing, smooth positions ───────────────────────────
    const newTracked = [];
    const usedOld = new Set();

    for (const raw of rawBlobs) {
      let bestDist = Infinity, bestIdx = -1;
      for (let i = 0; i < this._tracked.length; i++) {
        if (usedOld.has(i)) continue;
        const d = Math.hypot(raw.x - this._tracked[i].x, raw.y - this._tracked[i].y);
        if (d < bestDist && d < W * 0.12) { bestDist = d; bestIdx = i; }
      }
      if (bestIdx >= 0) {
        const old = this._tracked[bestIdx];
        usedOld.add(bestIdx);
        newTracked.push({
          x: old.x + (raw.x - old.x) * 0.7,
          y: old.y + (raw.y - old.y) * 0.7,
          interest: raw.interest,
          id: old.id,
          textIdx: old.textIdx,
          age: old.age + 1,
          alpha: Math.min(1, old.alpha + 0.1),
        });
      } else {
        newTracked.push({
          x: raw.x, y: raw.y,
          interest: raw.interest,
          id: this._idCounter++,
          textIdx: Math.floor(Math.random() * TEXT_POOL.length),
          age: 0, alpha: 0.3,
        });
      }
    }
    // Fade dying blobs
    for (let i = 0; i < this._tracked.length; i++) {
      if (!usedOld.has(i) && this._tracked[i].alpha > 0.05) {
        const d = { ...this._tracked[i], alpha: this._tracked[i].alpha * 0.8, age: this._tracked[i].age + 1 };
        newTracked.push(d);
      }
    }
    this._tracked = newTracked;

    if (this._tracked.length === 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    const blobs = this._tracked.filter(b => b.alpha > 0.05);

    // ── FULL MESH connection lines (every blob to every other blob) ──────────
    if (lineAmt > 0 && blobs.length > 1) {
      ctx.lineWidth = 0.6;
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i], b = blobs[j];
          const alpha = Math.min(a.alpha, b.alpha) * lineAmt * 0.5;
          if (alpha < 0.02) continue;
          ctx.strokeStyle = fg;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ── Tracking boxes ───────────────────────────────────────────────────────
    for (const blob of blobs) {
      const jx = jitter > 0 ? Math.sin(t * 4.1 + blob.id * 0.37) * jitter * 3 : 0;
      const jy = jitter > 0 ? Math.cos(t * 3.3 + blob.id * 0.53) * jitter * 3 : 0;
      const bx = blob.x + jx;
      const by = blob.y + jy;

      const bw = boxSize * (0.6 + (blob.interest || 0.5) * 0.6);
      const bh = bw * (0.5 + Math.abs(Math.sin(blob.id * 1.7)) * 0.8);
      const hw = bw / 2, hh = bh / 2;

      // Box outline (cyan like the reference)
      ctx.strokeStyle = fg;
      ctx.globalAlpha = blob.alpha * 0.7;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - hw, by - hh, bw, bh);

      // Corner ticks
      const tick = Math.min(6, hw * 0.3);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = blob.alpha * 0.9;
      // TL
      ctx.beginPath(); ctx.moveTo(bx - hw, by - hh + tick); ctx.lineTo(bx - hw, by - hh); ctx.lineTo(bx - hw + tick, by - hh); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(bx + hw - tick, by - hh); ctx.lineTo(bx + hw, by - hh); ctx.lineTo(bx + hw, by - hh + tick); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(bx - hw, by + hh - tick); ctx.lineTo(bx - hw, by + hh); ctx.lineTo(bx - hw + tick, by + hh); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(bx + hw - tick, by + hh); ctx.lineTo(bx + hw, by + hh); ctx.lineTo(bx + hw, by + hh - tick); ctx.stroke();

      // Hex ID (like "0xA3")
      const hexId = '0x' + (blob.id & 0xFF).toString(16).toUpperCase().padStart(2, '0');
      ctx.font = `${textSize}px monospace`;
      ctx.fillStyle = fg;
      ctx.globalAlpha = blob.alpha * 0.85;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(hexId, bx - hw, by - hh - 2);

      // Text annotation (only some blobs, based on seed)
      if (blob.age > 2 && (blob.id + seed) % 3 === 0) {
        const text = TEXT_POOL[blob.textIdx % TEXT_POOL.length];
        ctx.font = `italic ${textSize - 1}px serif`;
        ctx.globalAlpha = blob.alpha * 0.6;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, bx - hw, by + hh + 3);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
