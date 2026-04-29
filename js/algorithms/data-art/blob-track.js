/**
 * Blob Track — Object detection + brightness blob tracking.
 * Uses TensorFlow.js COCO-SSD for real object detection (people, animals, cars, etc.)
 * Falls back to brightness peaks when model unavailable.
 * Boxes show image crops. Full mesh lines. Plain integer IDs.
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

// ── COCO-SSD model management ────────────────────────────────────────────────

let cocoModel = null;
let cocoLoading = false;
let cocoFailed = false;

async function loadCoco() {
  if (cocoModel || cocoLoading || cocoFailed) return;
  cocoLoading = true;
  try {
    if (typeof cocoSsd !== 'undefined') {
      cocoModel = await cocoSsd.load({ base: 'mobilenet_v2' });
      console.log('[BlobTrack] COCO-SSD model loaded (mobilenet_v2)');
    } else {
      cocoFailed = true;
    }
  } catch (e) {
    console.error('[BlobTrack] COCO-SSD failed:', e);
    cocoFailed = true;
  }
  cocoLoading = false;
}

// ── Brightness peak detection (fallback) ─────────────────────────────────────

function detectBrightness(canvas, W, H, threshold, maxBlobs) {
  const sW = 48, sH = 36;
  const off = document.createElement('canvas');
  off.width = sW; off.height = sH;
  const c = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(canvas, 0, 0, sW, sH);
  const d = c.getImageData(0, 0, sW, sH).data;
  const cellW = W / sW, cellH = H / sH;

  const g = new Float32Array(sW * sH);
  for (let i = 0; i < sW * sH; i++) {
    const j = i * 4;
    g[i] = (d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114) / 255;
  }

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
      if (isMax) peaks.push({
        x: (x + 0.5) * cellW, y: (y + 0.5) * cellH,
        w: cellW * 2, h: cellH * 2,
        label: null, score: v
      });
    }
  }

  peaks.sort((a, b) => b.score - a.score);
  return peaks.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    this._blobs = [];
    this._nextId = 900;
    this._cap = null;
    this._cocoDetections = [];
    this._lastCocoTime = 0;
    this._cocoPending = false;
    loadCoco();
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Object + blob tracking. Uses AI to detect people, animals, cars. Image crops in boxes. Full mesh lines.' };
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
    set('bt_threshold', parseFloat((0.15 + Math.random() * 0.4).toFixed(2)));
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

    // ── Capture canvas ───────────────────────────────────────────────────────
    if (!this._cap) this._cap = document.createElement('canvas');
    this._cap.width = Math.round(W);
    this._cap.height = Math.round(H);
    this._cap.getContext('2d').drawImage(ctx.canvas, 0, 0, Math.round(W), Math.round(H));

    // ── COCO-SSD detection (async, every 150ms) ─────────────────────────────
    const now = performance.now();
    if (cocoModel && !this._cocoPending && now - this._lastCocoTime > 150) {
      this._cocoPending = true;
      this._lastCocoTime = now;
      cocoModel.detect(this._cap, maxBlobs).then(preds => {
        this._cocoDetections = preds
          .filter(p => p.score >= 0.5)
          .map(p => ({
            x: p.bbox[0] + p.bbox[2] / 2,
            y: p.bbox[1] + p.bbox[3] / 2,
            w: p.bbox[2],
            h: p.bbox[3],
            label: p.class,
            score: p.score,
          }));
        this._cocoPending = false;
      }).catch(() => { this._cocoPending = false; });
    }

    // ── Brightness fallback detection ────────────────────────────────────────
    const brightBlobs = detectBrightness(ctx.canvas, W, H, threshold, maxBlobs);

    // ── Combine: COCO detections + brightness blobs ──────────────────────────
    // COCO detections take priority (they're real objects)
    const allDetections = [...this._cocoDetections];
    // Add brightness blobs that don't overlap with COCO detections
    for (const bb of brightBlobs) {
      let overlaps = false;
      for (const cd of this._cocoDetections) {
        if (Math.hypot(bb.x - cd.x, bb.y - cd.y) < Math.max(cd.w, cd.h) * 0.5) {
          overlaps = true; break;
        }
      }
      if (!overlaps) allDetections.push(bb);
    }

    // ── Match to existing blobs (with velocity prediction) ───────────────────
    const matchR = Math.min(W, H) * 0.25;
    const usedD = new Set();

    for (const blob of this._blobs) {
      // Predict where the blob should be this frame, based on past velocity
      const predX = blob.x + (blob.vx || 0);
      const predY = blob.y + (blob.vy || 0);

      let bestD = Infinity, bestDi = -1;
      for (let di = 0; di < allDetections.length; di++) {
        if (usedD.has(di)) continue;
        const d = Math.hypot(allDetections[di].x - predX, allDetections[di].y - predY);
        if (d < bestD && d < matchR) { bestD = d; bestDi = di; }
      }
      if (bestDi >= 0) {
        const det = allDetections[bestDi];
        usedD.add(bestDi);
        const dx = det.x - blob.x;
        const dy = det.y - blob.y;
        // Velocity EMA — prediction tracks bulk motion
        blob.vx = (blob.vx || 0) * 0.7 + dx * 0.3;
        blob.vy = (blob.vy || 0) * 0.7 + dy * 0.3;
        // Position smoothing — low value, residual correction only
        blob.x += dx * 0.15;
        blob.y += dy * 0.15;
        blob.w += (det.w - blob.w) * 0.1;
        blob.h += (det.h - blob.h) * 0.1;
        // Sticky label — require new class to win 2 consecutive calls before overwriting
        if (det.label && det.score >= 0.6) {
          if (!blob.label || det.label === blob.label) {
            blob.label = det.label;
            blob.score = det.score;
            blob.candidateLabel = null;
            blob.candidateStreak = 0;
          } else if (det.label === blob.candidateLabel) {
            blob.candidateStreak = (blob.candidateStreak || 0) + 1;
            if (blob.candidateStreak >= 2) {
              blob.label = det.label;
              blob.score = det.score;
              blob.candidateLabel = null;
              blob.candidateStreak = 0;
            }
          } else {
            blob.candidateLabel = det.label;
            blob.candidateStreak = 1;
          }
        }
        blob.missing = 0;
        blob.confirmed = Math.min(blob.confirmed + 1, 200);
      } else {
        // No match — decay velocity so a lost blob coasts to a stop
        blob.vx = (blob.vx || 0) * 0.85;
        blob.vy = (blob.vy || 0) * 0.85;
        blob.missing++;
      }
      blob.age++;
    }

    // New blobs
    for (let di = 0; di < allDetections.length; di++) {
      if (usedD.has(di)) continue;
      if (this._blobs.length >= maxBlobs) break;
      const det = allDetections[di];
      this._blobs.push({
        x: det.x, y: det.y,
        w: det.w || boxSize, h: det.h || boxSize * 0.7,
        vx: 0, vy: 0,
        id: this._nextId++,
        label: det.label || null,
        score: det.score || 0,
        candidateLabel: null,
        candidateStreak: 0,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        colorIdx: Math.floor(Math.random() * MULTI_COLORS.length),
        age: 0, missing: 0, confirmed: 1,
      });
    }

    // Kill long-missing
    this._blobs = this._blobs.filter(b => b.missing < 80);

    // Clamp
    for (const b of this._blobs) {
      b.x = Math.max(5, Math.min(W - 5, b.x));
      b.y = Math.max(5, Math.min(H - 5, b.y));
    }

    // Show confirmed blobs (3+ frames)
    const visible = this._blobs.filter(b => b.confirmed >= 3 && b.missing < 40);
    if (visible.length === 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // ── Full mesh lines ──────────────────────────────────────────────────────
    if (lineAmt > 0 && visible.length > 1) {
      ctx.lineWidth = 0.7;
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          const alpha = lineAmt * 0.3 * Math.max(0, 1 - a.missing/40) * Math.max(0, 1 - b.missing/40);
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

    // ── Boxes ────────────────────────────────────────────────────────────────
    for (const blob of visible) {
      const fade = Math.max(0, 1 - blob.missing / 40);
      if (fade < 0.02) continue;

      const color = multiColor ? MULTI_COLORS[blob.colorIdx] : fg;
      const bw = Math.max(20, blob.w);
      const bh = Math.max(15, blob.h);
      const bx = blob.x - bw / 2;
      const by = blob.y - bh / 2;

      // Box outline
      ctx.strokeStyle = color;
      ctx.globalAlpha = fade * 0.8;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner ticks
      const tick = Math.min(7, Math.min(bw, bh) * 0.15);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      ctx.moveTo(bx, by+tick); ctx.lineTo(bx, by); ctx.lineTo(bx+tick, by);
      ctx.moveTo(bx+bw-tick, by); ctx.lineTo(bx+bw, by); ctx.lineTo(bx+bw, by+tick);
      ctx.moveTo(bx, by+bh-tick); ctx.lineTo(bx, by+bh); ctx.lineTo(bx+tick, by+bh);
      ctx.moveTo(bx+bw-tick, by+bh); ctx.lineTo(bx+bw, by+bh); ctx.lineTo(bx+bw, by+bh-tick);
      ctx.stroke();

      // Label: object name if detected, otherwise integer ID
      ctx.font = `${textSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.globalAlpha = fade * 0.9;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      if (blob.label) {
        // Real object: show class name + confidence
        ctx.fillText(`${blob.label} ${Math.round((blob.score || 0) * 100)}%`, bx, by + bh + 2);
      } else {
        // Brightness blob: show integer ID
        ctx.fillText(String(blob.id), bx, by + bh + 2);
      }

      // Text annotation
      if (blob.age > 10 && (blob.id + seed) % 3 === 0) {
        ctx.font = `italic ${textSize - 1}px Helvetica, Arial, sans-serif`;
        ctx.globalAlpha = fade * 0.45;
        ctx.fillText(TEXT_POOL[blob.textIdx % TEXT_POOL.length], bx, by + bh + textSize + 5);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
