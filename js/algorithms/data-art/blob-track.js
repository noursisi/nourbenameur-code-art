/**
 * Blob Track — TouchDesigner-style blob detection overlay.
 * Detects bright regions in the image, draws tracking boxes with IDs,
 * connecting lines, and text annotations.
 */

import { Algorithm } from '../base.js';

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xFFFFFFFF; };
}

// ── Default text pool (poetic + technical mix) ───────────────────────────────

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

function detectBlobs(ctx, W, H, threshold, minSize, maxBlobs) {
  // Downsample for analysis
  const gridW = Math.min(80, Math.floor(W / 6));
  const gridH = Math.min(60, Math.floor(H / 6));
  const cellW = W / gridW;
  const cellH = H / gridH;

  // Sample brightness at grid points
  let imageData;
  try {
    const dpr = window.devicePixelRatio || 1;
    imageData = ctx.getImageData(0, 0, Math.round(W * dpr), Math.round(H * dpr));
  } catch (e) {
    return [];
  }

  const data = imageData.data;
  const imgW = imageData.width;
  const imgH = imageData.height;

  const grid = [];
  for (let gy = 0; gy < gridH; gy++) {
    grid[gy] = [];
    for (let gx = 0; gx < gridW; gx++) {
      // Sample center of cell
      const sx = Math.floor((gx + 0.5) / gridW * imgW);
      const sy = Math.floor((gy + 0.5) / gridH * imgH);
      const idx = (sy * imgW + sx) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      grid[gy][gx] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }
  }

  // Find local maxima (brighter than neighbors and above threshold)
  const peaks = [];
  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      const v = grid[gy][gx];
      if (v < threshold) continue;
      // Check if local max in 3x3
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1 && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (grid[gy + dy][gx + dx] >= v) isMax = false;
        }
      }
      if (isMax) {
        peaks.push({ x: (gx + 0.5) * cellW, y: (gy + 0.5) * cellH, brightness: v });
      }
    }
  }

  // Merge nearby peaks
  const merged = [];
  const used = new Set();
  for (let i = 0; i < peaks.length; i++) {
    if (used.has(i)) continue;
    let cx = peaks[i].x, cy = peaks[i].y, cb = peaks[i].brightness, count = 1;
    for (let j = i + 1; j < peaks.length; j++) {
      if (used.has(j)) continue;
      const dx = peaks[i].x - peaks[j].x;
      const dy = peaks[i].y - peaks[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < minSize * 2) {
        cx += peaks[j].x;
        cy += peaks[j].y;
        cb = Math.max(cb, peaks[j].brightness);
        count++;
        used.add(j);
      }
    }
    merged.push({ x: cx / count, y: cy / count, brightness: cb, size: count });
    used.add(i);
  }

  // Sort by brightness, take top N
  merged.sort((a, b) => b.brightness - a.brightness);
  return merged.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  get metadata() {
    return {
      name: 'Blob Track',
      eq: 'detect × annotate',
      cat: 'Data Art',
      desc: 'TouchDesigner-style blob tracking — detects bright regions, draws bounding boxes with IDs, connection lines, and text annotations.',
    };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.1, max: 0.95, step: 0.05 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 3,   max: 40,   step: 1    },
      { id: 'bt_boxSize',   label: 'Box Size',  min: 10,  max: 80,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,   max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text',      min: 0,   max: 1,    step: 0.05 },
      { id: 'bt_id',        label: 'ID Number', min: 0,   max: 999,  step: 1    },
      { id: 'bt_seed',      label: 'Seed',      min: 0,   max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.1, max: 0.95, step: 0.05 }; }

  animate() {}

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.2 + Math.random() * 0.5).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 25));
    set('bt_boxSize',   Math.floor(15 + Math.random() * 50));
    set('bt_lines',     parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)));
    set('bt_text',      parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)));
    set('bt_id',        Math.floor(Math.random() * 999));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;

    const threshold = s.bt_threshold ?? 0.4;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const boxSize   = s.bt_boxSize ?? 30;
    const lineAmt   = s.bt_lines ?? 0.5;
    const textAmt   = s.bt_text ?? 0.5;
    const idNum     = Math.round(s.bt_id ?? 909);
    const seed      = Math.round(s.bt_seed ?? 42);

    const rng = makeLCG(seed * 7919 + 31337);

    // Detect blobs from current canvas content
    const blobs = detectBlobs(ctx, W, H, threshold, boxSize * 0.5, maxBlobs);

    if (blobs.length === 0) return;

    // Assign each blob a box size based on its brightness/size
    const blobData = blobs.map((b, i) => {
      const bw = boxSize * (0.4 + b.brightness * 0.8 + (b.size || 1) * 0.1);
      const bh = bw * (0.6 + rng() * 0.8);
      return {
        ...b,
        bw: Math.max(12, Math.min(bw, W * 0.3)),
        bh: Math.max(10, Math.min(bh, H * 0.3)),
        id: idNum + Math.floor(rng() * 3),
        textIdx: Math.floor(rng() * TEXT_POOL.length),
        hasText: rng() < textAmt,
        hasId: rng() < 0.7,
      };
    });

    ctx.save();

    // ── Connection lines between nearby blobs ────────────────────────────────
    if (lineAmt > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < blobData.length; i++) {
        const a = blobData[i];
        // Connect to nearest 1-2 blobs
        let connections = 0;
        const maxConn = rng() < 0.3 ? 2 : 1;
        for (let j = 0; j < blobData.length && connections < maxConn; j++) {
          if (i === j) continue;
          const b = blobData[j];
          const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (dist < W * lineAmt * 0.8 && rng() < lineAmt) {
            ctx.beginPath();
            // Line from box edge to box edge
            ctx.moveTo(a.x + a.bw * 0.5 * (b.x > a.x ? 1 : -1), a.y + a.bh * 0.3);
            ctx.lineTo(b.x - b.bw * 0.5 * (b.x > a.x ? 1 : -1), b.y - b.bh * 0.3);
            ctx.stroke();
            connections++;
          }
        }
      }
    }

    // ── Bounding boxes ───────────────────────────────────────────────────────
    for (const blob of blobData) {
      const bx = blob.x - blob.bw / 2;
      const by = blob.y - blob.bh / 2;

      // Box outline
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx, by, blob.bw, blob.bh);

      // Corner ticks (small L-shapes at corners for that tracking look)
      const tickLen = Math.min(6, blob.bw * 0.15);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(bx, by + tickLen); ctx.lineTo(bx, by); ctx.lineTo(bx + tickLen, by);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(bx + blob.bw - tickLen, by); ctx.lineTo(bx + blob.bw, by); ctx.lineTo(bx + blob.bw, by + tickLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(bx, by + blob.bh - tickLen); ctx.lineTo(bx, by + blob.bh); ctx.lineTo(bx + tickLen, by + blob.bh);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(bx + blob.bw - tickLen, by + blob.bh); ctx.lineTo(bx + blob.bw, by + blob.bh); ctx.lineTo(bx + blob.bw, by + blob.bh - tickLen);
      ctx.stroke();

      // ID number
      if (blob.hasId) {
        const idStr = String(blob.id);
        ctx.font = `${Math.max(8, Math.min(14, blob.bw * 0.3))}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(idStr, blob.x, blob.y);
      }

      // Text annotation
      if (blob.hasText) {
        const text = TEXT_POOL[blob.textIdx];
        const fontSize = Math.max(7, Math.min(12, blob.bw * 0.18));
        ctx.font = `italic ${fontSize}px serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Place text below or beside the box
        const textX = bx + (rng() < 0.5 ? blob.bw + 4 : -2);
        const textY = by + blob.bh + 3;
        ctx.fillText(text, rng() < 0.5 ? textX : bx, textY);
      }
    }

    ctx.restore();
  }

  collectSVG() { return null; }
}
