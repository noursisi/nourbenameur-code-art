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

// ── Motion detection (frame differencing) ──────────────────────────────────
// Find local peaks of pixel change between current and previous frame.
// Catches any moving subject regardless of class — works on crowds,
// murmurations, and anything COCO doesn't have a label for.

function detectMotion(curCanvas, prevCanvas, W, H, threshold, maxBlobs) {
  if (!prevCanvas || prevCanvas.width === 0) return [];

  const sW = 64, sH = 40;
  const off = document.createElement('canvas');
  off.width = sW * 2; off.height = sH;
  const c = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(curCanvas, 0, 0, sW, sH);
  c.drawImage(prevCanvas, sW, 0, sW, sH);

  const cur = c.getImageData(0, 0, sW, sH).data;
  const prev = c.getImageData(sW, 0, sW, sH).data;

  // Per-cell motion = mean abs RGB delta, normalized to 0..1
  const m = new Float32Array(sW * sH);
  for (let i = 0; i < sW * sH; i++) {
    const j = i * 4;
    const dr = Math.abs(cur[j]   - prev[j]);
    const dg = Math.abs(cur[j+1] - prev[j+1]);
    const db = Math.abs(cur[j+2] - prev[j+2]);
    m[i] = (dr + dg + db) / 765; // /3/255
  }

  const cellW = W / sW, cellH = H / sH;
  const peaks = [];
  // Local-max search in a 3-cell radius — gives broader peaks for moving groups
  for (let y = 2; y < sH - 2; y++) {
    for (let x = 2; x < sW - 2; x++) {
      const v = m[y * sW + x];
      if (v < threshold) continue;
      let isMax = true;
      for (let dy = -2; dy <= 2 && isMax; dy++)
        for (let dx = -2; dx <= 2 && isMax; dx++) {
          if (!dx && !dy) continue;
          if (m[(y+dy) * sW + (x+dx)] > v) isMax = false;
        }
      if (isMax) peaks.push({
        x: (x + 0.5) * cellW, y: (y + 0.5) * cellH,
        w: cellW * 3, h: cellH * 3,
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
    this._prevFrame = null;
    this._cocoDetections = [];
    this._lastCocoTime = 0;
    this._cocoPending = false;
    loadCoco();
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Object detection overlay. AI Only = clean COCO-SSD boxes (people/animals/vehicles). Gallery mode adds motion blobs, mesh, and poetry.' };
  }

  get params() {
    return [
      { id: 'bt_aiOnly',    label: 'AI Only',   min: 0,    max: 1,    step: 1    },
      { id: 'bt_threshold', label: 'Threshold', min: 0.02, max: 0.5,  step: 0.01 },
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
    // AI Only randomizes only model-relevant params; gallery mode also randomizes mesh + colors
    const ai = Math.round(state.bt_aiOnly ?? 1) === 1;
    set('bt_threshold', parseFloat((0.04 + Math.random() * 0.2).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 30));
    set('bt_boxSize',   Math.floor(20 + Math.random() * 50));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_seed',      Math.floor(Math.random() * 100));
    if (!ai) {
      set('bt_lines',   parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
      set('bt_color',   Math.round(Math.random()));
    }
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const aiOnly   = Math.round(s.bt_aiOnly ?? 1) === 1;
    const threshold = s.bt_threshold ?? 0.08;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const boxSize   = s.bt_boxSize ?? 35;
    const lineAmt   = s.bt_lines ?? 0;
    const textSize  = Math.round(s.bt_text ?? 11);
    const multiColor = Math.round(s.bt_color ?? 0) === 1;
    const seed      = Math.round(s.bt_seed ?? 42);
    const fg        = s.fgColor || '#ffffff';
    const maxBoxDim = Math.min(W, H) * 0.35;
    const minDim    = Math.min(W, H);
    const canvasArea = W * H;

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
          .filter(p => {
            if (p.score < 0.5) return false;
            // Reject giant boxes — usually false positives covering most of the frame
            if ((p.bbox[2] * p.bbox[3]) / canvasArea > 0.5) return false;
            return true;
          })
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

    // ── Motion fallback (frame diff) — only when AI Only mode is off ─────────
    let motionBlobs = [];
    if (!aiOnly) {
      motionBlobs = detectMotion(this._cap, this._prevFrame, W, H, threshold, maxBlobs);
    }

    // ── Combine: COCO detections + motion blobs (motion is fallback) ─────────
    const allDetections = [...this._cocoDetections];
    for (const mb of motionBlobs) {
      let overlaps = false;
      for (const cd of this._cocoDetections) {
        if (Math.hypot(mb.x - cd.x, mb.y - cd.y) < Math.max(cd.w, cd.h) * 0.5) {
          overlaps = true; break;
        }
      }
      if (!overlaps) allDetections.push(mb);
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

    // Save current frame as prev for next-frame motion diff
    if (!aiOnly) {
      if (!this._prevFrame) this._prevFrame = document.createElement('canvas');
      this._prevFrame.width = Math.round(W);
      this._prevFrame.height = Math.round(H);
      this._prevFrame.getContext('2d').drawImage(this._cap, 0, 0);
    }

    // Show confirmed blobs (3+ frames). In AI-only mode, hide unlabeled blobs.
    const visible = this._blobs.filter(b => {
      if (b.confirmed < 3 || b.missing >= 40) return false;
      if (aiOnly && !b.label) return false;
      return true;
    });
    if (visible.length === 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // ── Full mesh lines (gallery mode only — 2018-style demos have no mesh) ──
    if (!aiOnly && lineAmt > 0 && visible.length > 1) {
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
      // Cap rendered box size — even if blob.w grew huge, never paint beyond ~35% of min dim
      const bw = Math.min(maxBoxDim, Math.max(20, blob.w));
      const bh = Math.min(maxBoxDim, Math.max(15, blob.h));
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

      // Label: 2018-style minimal in AI-only mode (just class name above box).
      // Gallery mode keeps the labeled-box-with-confidence + integer IDs + poetry.
      ctx.font = `${textSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.globalAlpha = fade * 0.95;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      if (aiOnly) {
        if (blob.label) {
          ctx.fillText(blob.label, bx, by - textSize - 2);
        }
      } else {
        if (blob.label) {
          ctx.fillText(`${blob.label} ${Math.round((blob.score || 0) * 100)}%`, bx, by + bh + 2);
        } else {
          ctx.fillText(String(blob.id), bx, by + bh + 2);
        }
        if (blob.age > 10 && (blob.id + seed) % 3 === 0) {
          ctx.font = `italic ${textSize - 1}px Helvetica, Arial, sans-serif`;
          ctx.globalAlpha = fade * 0.45;
          ctx.fillText(TEXT_POOL[blob.textIdx % TEXT_POOL.length], bx, by + bh + textSize + 5);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
