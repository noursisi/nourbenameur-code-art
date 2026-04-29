/**
 * Blob Track — proper blob tracking with velocity prediction.
 * Blobs persist, move smoothly, and only die after being missing for many frames.
 * No blinking, no re-appearing. Actual tracking.
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

// ── Detection (fast, downsampled) ────────────────────────────────────────────

function findCandidates(canvas, W, H, threshold, maxCount) {
  const sW = 64, sH = 48;
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

  const pts = [];
  for (let y = 2; y < sH - 2; y++) {
    for (let x = 2; x < sW - 2; x++) {
      const b = g[y * sW + x];
      const gx = g[y * sW + x+1] - g[y * sW + x-1];
      const gy = g[(y+1) * sW + x] - g[(y-1) * sW + x];
      const score = b * 0.5 + Math.sqrt(gx*gx + gy*gy) * 3;
      if (score < threshold) continue;

      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++)
        for (let dx = -1; dx <= 1 && isMax; dx++) {
          if (!dx && !dy) continue;
          const ni = (y+dy) * sW + (x+dx);
          const nb = g[ni] * 0.5;
          const ngx = g[(y+dy)*sW+(x+dx+1)] - g[(y+dy)*sW+(x+dx-1)];
          const ngy = g[(y+dy+1)*sW+(x+dx)] - g[(y+dy-1)*sW+(x+dx)];
          if (nb + Math.sqrt(ngx*ngx + ngy*ngy) * 3 >= score) isMax = false;
        }
      if (isMax) pts.push({ x: (x+.5)*cellW, y: (y+.5)*cellH, score });
    }
  }

  // Merge nearby
  const merged = [];
  const used = new Set();
  const mr = Math.min(W,H) * 0.05;
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    let cx = pts[i].x, cy = pts[i].y, best = pts[i].score, n = 1;
    for (let j = i+1; j < pts.length; j++) {
      if (used.has(j)) continue;
      if (Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y) < mr) {
        cx += pts[j].x; cy += pts[j].y;
        best = Math.max(best, pts[j].score); n++; used.add(j);
      }
    }
    merged.push({ x: cx/n, y: cy/n, score: best });
    used.add(i);
  }
  merged.sort((a,b) => b.score - a.score);
  return merged.slice(0, maxCount);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    this._blobs = []; // persistent tracked blobs
    this._nextId = 0;
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Blob tracking with velocity prediction — boxes follow movement, persist, connect.' };
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
    set('bt_jitter',    parseFloat((Math.random() * 0.4).toFixed(2)));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const threshold = s.bt_threshold ?? 0.3;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const boxSize   = s.bt_boxSize ?? 25;
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const jitter    = s.bt_jitter ?? 0.15;
    const seed      = Math.round(s.bt_seed ?? 42);
    const t         = s.time ?? 0;
    const fg        = s.fgColor || '#ffffff';

    // ── 1. Detect candidates ─────────────────────────────────────────────────
    const candidates = findCandidates(ctx.canvas, W, H, threshold, maxBlobs + 10);

    // ── 2. Match candidates to existing blobs (using predicted position) ─────
    const matchRadius = Math.min(W, H) * 0.12;
    const usedCandidates = new Set();
    const usedBlobs = new Set();

    // Sort existing blobs by age (older get priority in matching)
    const sortedBlobs = this._blobs.map((b, i) => ({ b, i })).sort((a, b) => b.b.age - a.b.age);

    for (const { b: blob, i: bi } of sortedBlobs) {
      // Predicted position based on velocity
      const px = blob.x + blob.vx;
      const py = blob.y + blob.vy;

      let bestDist = Infinity, bestCi = -1;
      for (let ci = 0; ci < candidates.length; ci++) {
        if (usedCandidates.has(ci)) continue;
        const d = Math.hypot(candidates[ci].x - px, candidates[ci].y - py);
        if (d < bestDist && d < matchRadius) { bestDist = d; bestCi = ci; }
      }

      if (bestCi >= 0) {
        // Matched — update position and velocity
        const c = candidates[bestCi];
        usedCandidates.add(bestCi);
        usedBlobs.add(bi);
        const newVx = (c.x - blob.x) * 0.5 + blob.vx * 0.5; // smooth velocity
        const newVy = (c.y - blob.y) * 0.5 + blob.vy * 0.5;
        blob.x += (c.x - blob.x) * 0.6; // smooth position
        blob.y += (c.y - blob.y) * 0.6;
        blob.vx = newVx;
        blob.vy = newVy;
        blob.missing = 0;
        blob.age++;
        blob.score = c.score;
      } else {
        // Not matched — keep moving along velocity, increment missing counter
        usedBlobs.add(bi);
        blob.x += blob.vx * 0.8;
        blob.y += blob.vy * 0.8;
        blob.vx *= 0.9; // decelerate
        blob.vy *= 0.9;
        blob.missing++;
        blob.age++;
      }
    }

    // ── 3. Create new blobs from unmatched candidates ────────────────────────
    for (let ci = 0; ci < candidates.length; ci++) {
      if (usedCandidates.has(ci)) continue;
      if (this._blobs.length >= maxBlobs) break;
      const c = candidates[ci];
      this._blobs.push({
        x: c.x, y: c.y, vx: 0, vy: 0,
        score: c.score,
        id: this._nextId++,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        age: 0, missing: 0,
      });
    }

    // ── 4. Kill blobs that have been missing too long ────────────────────────
    this._blobs = this._blobs.filter(b => {
      if (b.missing > 40) return false; // dead after 40 frames missing
      if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50) return false; // out of bounds
      return true;
    });

    // ── 5. Draw ──────────────────────────────────────────────────────────────
    const alive = this._blobs.filter(b => b.missing < 20);
    const fading = this._blobs.filter(b => b.missing >= 20);

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // Full mesh connection lines
    if (lineAmt > 0 && alive.length > 1) {
      ctx.lineWidth = 0.6;
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i], b = alive[j];
          const fadeA = a.missing > 0 ? Math.max(0, 1 - a.missing / 20) : 1;
          const fadeB = b.missing > 0 ? Math.max(0, 1 - b.missing / 20) : 1;
          ctx.strokeStyle = fg;
          ctx.globalAlpha = lineAmt * 0.4 * fadeA * fadeB;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Draw all blobs (alive + fading)
    for (const blob of this._blobs) {
      const fade = blob.missing > 0 ? Math.max(0, 1 - blob.missing / 30) : 1;
      if (fade < 0.02) continue;

      const jx = jitter > 0 ? Math.sin(t * 4.1 + blob.id * 0.37) * jitter * 2 : 0;
      const jy = jitter > 0 ? Math.cos(t * 3.3 + blob.id * 0.53) * jitter * 2 : 0;
      const bx = blob.x + jx;
      const by = blob.y + jy;

      const bw = boxSize * (0.6 + (blob.score || 0.5) * 0.5);
      const bh = bw * (0.5 + Math.abs(Math.sin(blob.id * 1.7)) * 0.8);
      const hw = bw / 2, hh = bh / 2;

      // Box
      ctx.strokeStyle = fg;
      ctx.globalAlpha = fade * 0.7;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - hw, by - hh, bw, bh);

      // Corner ticks
      const tick = Math.min(6, hw * 0.3);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx-hw, by-hh+tick); ctx.lineTo(bx-hw, by-hh); ctx.lineTo(bx-hw+tick, by-hh);
      ctx.moveTo(bx+hw-tick, by-hh); ctx.lineTo(bx+hw, by-hh); ctx.lineTo(bx+hw, by-hh+tick);
      ctx.moveTo(bx-hw, by+hh-tick); ctx.lineTo(bx-hw, by+hh); ctx.lineTo(bx-hw+tick, by+hh);
      ctx.moveTo(bx+hw-tick, by+hh); ctx.lineTo(bx+hw, by+hh); ctx.lineTo(bx+hw, by+hh-tick);
      ctx.stroke();

      // Hex ID
      const hexId = '0x' + (blob.id & 0xFF).toString(16).toUpperCase().padStart(2, '0');
      ctx.font = `${textSize}px monospace`;
      ctx.fillStyle = fg;
      ctx.globalAlpha = fade * 0.85;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(hexId, bx - hw + 1, by - hh - 2);

      // Text annotation
      if (blob.age > 5 && (blob.id + seed) % 3 === 0) {
        const text = TEXT_POOL[blob.textIdx % TEXT_POOL.length];
        ctx.font = `italic ${textSize - 1}px serif`;
        ctx.globalAlpha = fade * 0.6;
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
