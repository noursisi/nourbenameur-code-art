/**
 * Blob Track — TouchDesigner-style blob detection overlay.
 * Detects bright/interesting regions, draws animated tracking boxes,
 * connection lines, and text annotations. Alive and scanning.
 * Re-detects every frame for video. Animates for photos.
 */

import { Algorithm } from '../base.js';

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xFFFFFFFF; };
}

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
  'Data streams through empty veins,',
  'Phantom motion, no one came.',
  'Every pixel holds a ghost,',
  'Of the thing I needed most.',
  'Contour map of what went wrong,',
  'Binary hearts don\'t beat for long.',
  'Rendered out, then thrown away,',
  'Just another empty frame.',
  'The algorithm remembers you,',
  'Even when I tell it not to.',
];

// ── Blob detection ───────────────────────────────────────────────────────────

function detectBlobs(ctx, W, H, threshold, maxBlobs) {
  const dpr = window.devicePixelRatio || 1;
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, Math.round(W * dpr), Math.round(H * dpr));
  } catch (e) {
    return [];
  }

  const data = imageData.data;
  const imgW = imageData.width;
  const imgH = imageData.height;

  // Downsample to grid
  const gridW = Math.min(60, Math.floor(imgW / 8));
  const gridH = Math.min(45, Math.floor(imgH / 8));

  const grid = [];
  for (let gy = 0; gy < gridH; gy++) {
    grid[gy] = [];
    for (let gx = 0; gx < gridW; gx++) {
      const sx = Math.floor((gx + 0.5) / gridW * imgW);
      const sy = Math.floor((gy + 0.5) / gridH * imgH);
      const idx = (sy * imgW + sx) * 4;
      grid[gy][gx] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    }
  }

  // Also compute edge strength (gradient magnitude)
  const edges = [];
  for (let gy = 1; gy < gridH - 1; gy++) {
    edges[gy] = [];
    for (let gx = 1; gx < gridW - 1; gx++) {
      const gxVal = grid[gy][gx + 1] - grid[gy][gx - 1];
      const gyVal = grid[gy + 1][gx] - grid[gy - 1][gx];
      edges[gy][gx] = Math.sqrt(gxVal * gxVal + gyVal * gyVal);
    }
  }

  // Find interesting points: bright OR high edge contrast
  const peaks = [];
  const cellW = W / gridW;
  const cellH = H / gridH;

  for (let gy = 2; gy < gridH - 2; gy++) {
    for (let gx = 2; gx < gridW - 2; gx++) {
      const brightness = grid[gy][gx];
      const edge = edges[gy]?.[gx] || 0;
      const interest = brightness * 0.6 + edge * 2.5; // combine brightness + edges

      if (interest < threshold) continue;

      // Local maximum check (5x5 area)
      let isMax = true;
      for (let dy = -2; dy <= 2 && isMax; dy++) {
        for (let dx = -2; dx <= 2 && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = gy + dy, nx = gx + dx;
          if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
          const nEdge = edges[ny]?.[nx] || 0;
          const nInterest = grid[ny][nx] * 0.6 + nEdge * 2.5;
          if (nInterest >= interest) isMax = false;
        }
      }

      if (isMax) {
        peaks.push({
          x: (gx + 0.5) * cellW,
          y: (gy + 0.5) * cellH,
          brightness,
          edge,
          interest,
        });
      }
    }
  }

  // Merge nearby peaks
  const merged = [];
  const used = new Set();
  const mergeRadius = Math.min(W, H) * 0.06;

  for (let i = 0; i < peaks.length; i++) {
    if (used.has(i)) continue;
    let cx = peaks[i].x, cy = peaks[i].y;
    let best = peaks[i].interest;
    let count = 1;

    for (let j = i + 1; j < peaks.length; j++) {
      if (used.has(j)) continue;
      const dx = peaks[i].x - peaks[j].x;
      const dy = peaks[i].y - peaks[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < mergeRadius) {
        cx += peaks[j].x;
        cy += peaks[j].y;
        best = Math.max(best, peaks[j].interest);
        count++;
        used.add(j);
      }
    }
    merged.push({ x: cx / count, y: cy / count, interest: best, size: count });
    used.add(i);
  }

  merged.sort((a, b) => b.interest - a.interest);
  return merged.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    // Persistent blob state for smooth animation
    this._trackedBlobs = [];
    this._blobIdCounter = 900;
    this._lastDetectTime = 0;
  }

  get metadata() {
    return {
      name: 'Blob Track',
      eq: 'detect × annotate',
      cat: 'Data Art',
      desc: 'TouchDesigner-style blob tracking — detects bright regions, draws animated tracking boxes with IDs, connection lines, and text annotations.',
    };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.05, max: 0.95, step: 0.02 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 3,    max: 40,   step: 1    },
      { id: 'bt_boxSize',   label: 'Box Size',  min: 10,   max: 80,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text Size', min: 6,    max: 18,   step: 1    },
      { id: 'bt_jitter',    label: 'Jitter',    min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_seed',      label: 'Seed',      min: 0,    max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.05, max: 0.95, step: 0.02 }; }

  animate(world) {
    // Continuously re-detect for video sources, periodically for photos
    const t = world.state.time ?? 0;
    // Animation drives jitter — no need to mutate state here
  }

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.15 + Math.random() * 0.5).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 25));
    set('bt_boxSize',   Math.floor(15 + Math.random() * 50));
    set('bt_lines',     parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)));
    set('bt_text',      parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)));
    set('bt_jitter',    parseFloat((Math.random() * 0.6 + 0.1).toFixed(2)));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;

    const threshold = s.bt_threshold ?? 0.3;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const boxSize   = s.bt_boxSize ?? 30;
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const jitter    = s.bt_jitter ?? 0.3;
    const seed      = Math.round(s.bt_seed ?? 42);
    const t         = s.time ?? 0;
    // Use the foreground color from the Style panel
    const fg        = s.fgColor || '#ffffff';

    const rng = makeLCG(seed * 7919 + 31337);

    // ── Re-detect blobs (every frame for video, periodically for photos) ─────
    const now = performance.now();
    const detectInterval = 50; // ms between re-detections (faster for video)

    if (now - this._lastDetectTime > detectInterval) {
      const rawBlobs = detectBlobs(ctx, W, H, threshold, maxBlobs);
      this._lastDetectTime = now;

      // Match detected blobs to existing tracked blobs (simple nearest-neighbor)
      const newTracked = [];
      const usedOld = new Set();

      for (const raw of rawBlobs) {
        let bestDist = Infinity;
        let bestIdx = -1;

        for (let i = 0; i < this._trackedBlobs.length; i++) {
          if (usedOld.has(i)) continue;
          const dx = raw.x - this._trackedBlobs[i].x;
          const dy = raw.y - this._trackedBlobs[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist && dist < W * 0.15) {
            bestDist = dist;
            bestIdx = i;
          }
        }

        if (bestIdx >= 0) {
          // Smooth toward new position
          const old = this._trackedBlobs[bestIdx];
          usedOld.add(bestIdx);
          newTracked.push({
            x: old.x + (raw.x - old.x) * 0.6,
            y: old.y + (raw.y - old.y) * 0.6,
            interest: raw.interest,
            size: raw.size,
            id: old.id,
            textIdx: old.textIdx,
            age: old.age + 1,
            alpha: Math.min(1, old.alpha + 0.05),
          });
        } else {
          // New blob
          newTracked.push({
            x: raw.x,
            y: raw.y,
            interest: raw.interest,
            size: raw.size,
            id: this._blobIdCounter++,
            textIdx: Math.floor(rng() * TEXT_POOL.length),
            age: 0,
            alpha: 0.1, // fade in
          });
        }
      }

      // Keep dying blobs briefly (fade out)
      for (let i = 0; i < this._trackedBlobs.length; i++) {
        if (!usedOld.has(i) && this._trackedBlobs[i].alpha > 0.05) {
          const dying = { ...this._trackedBlobs[i] };
          dying.alpha *= 0.85; // fade out
          dying.age++;
          newTracked.push(dying);
        }
      }

      this._trackedBlobs = newTracked;
    }

    if (this._trackedBlobs.length === 0) return;

    const blobs = this._trackedBlobs;

    ctx.save();

    // Clip everything to canvas bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // ── Connection lines (always between ALL blobs, chain nearest) ─────────
    if (lineAmt > 0 && blobs.length > 1) {
      ctx.strokeStyle = fg;
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = lineAmt * 0.6;

      // Connect each blob to its nearest neighbor
      for (let i = 0; i < blobs.length; i++) {
        const a = blobs[i];
        if (a.alpha < 0.15) continue;
        let bestDist = Infinity, bestJ = -1;
        for (let j = 0; j < blobs.length; j++) {
          if (i === j || blobs[j].alpha < 0.15) continue;
          const d = Math.sqrt((a.x - blobs[j].x) ** 2 + (a.y - blobs[j].y) ** 2);
          if (d < bestDist) { bestDist = d; bestJ = j; }
        }
        if (bestJ >= 0) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(blobs[bestJ].x, blobs[bestJ].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ── Tracking boxes ───────────────────────────────────────────────────────
    for (const blob of blobs) {
      if (blob.alpha < 0.03) continue;

      // Animated jitter
      const jx = Math.sin(t * 3.7 + blob.id * 0.37) * jitter * 4;
      const jy = Math.cos(t * 2.9 + blob.id * 0.53) * jitter * 4;
      const bx = blob.x + jx;
      const by = blob.y + jy;

      const bw = boxSize * (0.5 + (blob.interest || 0.5) * 0.8 + (blob.size || 1) * 0.08);
      const bh = bw * (0.5 + Math.abs(Math.sin(blob.id * 1.7)) * 0.7);
      const dw = bw / 2, dh = bh / 2;

      const alpha = blob.alpha;

      // Box outline
      ctx.strokeStyle = fg;
      ctx.globalAlpha = alpha * 0.6;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx - dw, by - dh, dw * 2, dh * 2);

      // Corner ticks
      const tickLen = Math.min(8, dw * 0.3);
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineWidth = 1.2;
      const corners = [
        [bx - dw, by - dh, 1, 1],
        [bx + dw, by - dh, -1, 1],
        [bx - dw, by + dh, 1, -1],
        [bx + dw, by + dh, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - tickLen * sy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + tickLen * sx, cy);
        ctx.stroke();
      }

      // ID number (no blinking — always visible)
      ctx.font = `${textSize}px monospace`;
      ctx.fillStyle = fg;
      ctx.globalAlpha = alpha * 0.8;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(blob.id), bx, by);

      // Text annotation (bigger, readable, no randomization per frame)
      if (blob.age > 3) {
        const text = TEXT_POOL[blob.textIdx % TEXT_POOL.length];
        ctx.font = `italic ${textSize}px serif`;
        ctx.fillStyle = fg;
        ctx.globalAlpha = alpha * 0.7;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, bx - dw, by + dh + 4);
      }
    }

    ctx.globalAlpha = 1;

    ctx.restore(); // end clip
    ctx.restore(); // end save
  }

  collectSVG() { return null; }
}
