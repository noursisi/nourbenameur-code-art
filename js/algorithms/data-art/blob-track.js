/**
 * Blob Track — Object detection overlay.
 * COCO-SSD for subjects, frame-diff for movement (gallery mode only).
 * BUILD: 2026-04-29-c
 */
console.log('[BlobTrack] build 2026-04-29-o loaded');

import { Algorithm } from '../base.js';
import { markDirty } from '../../state.js';

// Class buckets for the "Class Filter" preset slider — your manual override
// when COCO insists the sun is a cat or the sky is a person.
const CLASS_PEOPLE   = new Set(['person']);
const CLASS_VEHICLES = new Set(['car','truck','bus','motorcycle','bicycle','train','boat','airplane']);
const CLASS_ANIMALS  = new Set(['cat','dog','bird','horse','cow','sheep','elephant','bear','zebra','giraffe']);
function classAllowed(cls, mode) {
  if (mode === 0) return true;
  if (mode === 1) return CLASS_PEOPLE.has(cls) || CLASS_VEHICLES.has(cls);
  if (mode === 2) return CLASS_PEOPLE.has(cls);
  if (mode === 3) return CLASS_VEHICLES.has(cls);
  if (mode === 4) return CLASS_ANIMALS.has(cls);
  return true;
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
  'Every pixel holds a ghost,',
  'The algorithm remembers you,',
];

const MULTI_COLORS = ['#00ddff','#ff3344','#00ff88','#ffdd00','#ff69b4','#ff8800','#aa55ff','#55ffaa','#ffffff'];

// Per-class minimum confidence. COCO-SSD on hard scenes (sun glare, snow,
// fog) hallucinates animals from bokeh shapes. Animal classes are rare and
// pricey when wrong — require higher confidence. Persons + vehicles are
// common, lower floor.
const CLASS_MIN_CONF = {
  cat: 0.85, dog: 0.85, bird: 0.85, horse: 0.78, cow: 0.78, sheep: 0.78,
  elephant: 0.85, bear: 0.85, zebra: 0.85, giraffe: 0.85,
  person: 0.65,
  car: 0.55, truck: 0.55, bus: 0.55, motorcycle: 0.6, bicycle: 0.6,
};
const DEFAULT_MIN_CONF = 0.65;

// Compute the "light signature" of an image region: high luma + low
// saturation = sun glare / sky / snow / blown-out highlights. A real
// subject has either lower luma OR enough saturation to survive the test.
//
// Returns lightScore in [0, 1]. Higher = more light-like.
//   - meanLuma in [0, 1]
//   - meanSat in [0, 1]
//   - score = meanLuma * (1 - meanSat * 0.4)
// So a saturated red car (luma 0.5, sat 0.8) scores 0.34 — kept.
// A blown-out cloud (luma 0.85, sat 0.05) scores 0.83 — dropped.
function regionLightScore(canvas, bbox) {
  try {
    const off = document.createElement('canvas');
    const sw = 16, sh = 16;
    off.width = sw; off.height = sh;
    const c = off.getContext('2d', { willReadFrequently: true });
    c.drawImage(canvas, bbox[0], bbox[1], bbox[2], bbox[3], 0, 0, sw, sh);
    const d = c.getImageData(0, 0, sw, sh).data;
    let sumLuma = 0, sumSat = 0;
    const n = sw * sh;
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      const r = d[j], g = d[j+1], b = d[j+2];
      const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      sumLuma += luma;
      sumSat += sat;
    }
    const meanLuma = sumLuma / n;
    const meanSat = sumSat / n;
    return meanLuma * (1 - meanSat * 0.4);
  } catch { return 0; }
}

// ── COCO-SSD model management (pluggable bases) ──────────────────────────────
// Three COCO-SSD variants — speed/accuracy trade-off. Hot-swappable: when
// the user changes bt_model the active model is unloaded and the new one
// loads in the background; detection pauses briefly until ready.

// COCO-SSD ships two bases out of the box. YOLOv8 / DETR can be plugged
// in here later — same { detect(canvas) -> [{class,score,bbox}] } interface.
const MODEL_BASES = ['lite_mobilenet_v2', 'mobilenet_v2'];
const MODEL_NAMES = ['Fast (Lite)', 'Accurate (Mobile)'];

let cocoModel = null;
let cocoLoading = false;
let cocoLoadedBase = null;
let desiredBaseIdx = 1;

// Hot-swap model loader: keeps the existing model alive until the new
// one is ready (detection never blacks out). Handles concurrent slider
// changes by looping until the loaded base matches the latest desired.
async function loadCoco(baseIdx = 1) {
  desiredBaseIdx = baseIdx;
  if (cocoLoading) return;        // an existing loop will pick up the new desired
  if (typeof cocoSsd === 'undefined') return;
  cocoLoading = true;
  try {
    while (cocoLoadedBase !== MODEL_BASES[desiredBaseIdx]) {
      const targetIdx = desiredBaseIdx;
      const base = MODEL_BASES[targetIdx];
      try {
        const newModel = await cocoSsd.load({ base });
        // If the user slid again during this load, we'll just loop again
        // and load the new target. Otherwise commit this one.
        if (desiredBaseIdx === targetIdx) {
          cocoModel = newModel;
          cocoLoadedBase = base;
          console.log(`[BlobTrack] active model: ${MODEL_NAMES[targetIdx]} (${base})`);
          // Force a re-render so still-image users see detection start —
          // without this, the render loop is idle on a paused image and
          // COCO never gets a chance to fire its first detection.
          markDirty();
        }
      } catch (e) {
        console.error('[BlobTrack] model load failed:', e);
        break;
      }
    }
  } finally {
    cocoLoading = false;
  }
}

// ── Detect-then-track: low-res template tracker ─────────────────────────────
// Real-time tracking architecture:
//   1. COCO detector runs at ~4 Hz (every 250 ms) — slow, but gives labels
//      and authoritative bounding boxes.
//   2. Between detections, every frame, each tracked target updates its
//      position via template matching on a 320×180 low-resolution copy of
//      the canvas. Cheap (CPU SAD over a small search window) and smooth.
//   3. When a fresh detection arrives, we IoU-match new detections to
//      existing tracks, refresh templates on matched ones, spawn new
//      tracks for unmatched detections, and let unmatched tracks coast.
//
// Templates live at low res (4× smaller per axis) so the per-pixel cost
// per match candidate is ~64× cheaper than at native resolution. The work
// frame is captured ONCE per frame so all tracking shares the readback.

const WORK_W = 320;
const WORK_H = 180;
const TPL_MAX = 28; // template max edge in work-pixels — caps perf

class TemplateTracker {
  constructor() {
    this._work = document.createElement('canvas');
    this._work.width = WORK_W;
    this._work.height = WORK_H;
    this._workCtx = this._work.getContext('2d', { willReadFrequently: true });
    this._workData = null;
    this._scale = 1;
    this._offX = 0;
    this._offY = 0;
  }

  // Capture the source canvas once per frame into the low-res work buffer.
  captureFrame(srcCanvas, srcW, srcH) {
    const sx = WORK_W / srcW;
    const sy = WORK_H / srcH;
    const fitScale = Math.min(sx, sy);
    const drawW = srcW * fitScale;
    const drawH = srcH * fitScale;
    this._scale = fitScale;
    this._offX = (WORK_W - drawW) / 2;
    this._offY = (WORK_H - drawH) / 2;
    this._workCtx.fillStyle = '#000';
    this._workCtx.fillRect(0, 0, WORK_W, WORK_H);
    this._workCtx.drawImage(srcCanvas, this._offX, this._offY, drawW, drawH);
    this._workData = this._workCtx.getImageData(0, 0, WORK_W, WORK_H).data;
  }

  // Convert source → work coordinates
  toWork(x, y) {
    return { x: x * this._scale + this._offX, y: y * this._scale + this._offY };
  }

  // Extract a template patch from the current work frame, in work coords.
  // Returns { data, w, h } or null if patch is too small / off-canvas.
  extractTemplate(srcX, srcY, srcW, srcH) {
    const w = Math.min(TPL_MAX, Math.max(8, Math.round(srcW * this._scale)));
    const h = Math.min(TPL_MAX, Math.max(8, Math.round(srcH * this._scale)));
    const wp = this.toWork(srcX, srcY);
    const sx = Math.round(wp.x - w / 2);
    const sy = Math.round(wp.y - h / 2);
    return { data: this._readRegion(sx, sy, w, h), w, h };
  }

  // Sample the work buffer into a plain RGB array — boundary clamps to black.
  _readRegion(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 3);
    const data = this._workData;
    for (let py = 0; py < h; py++) {
      const srcY = y + py;
      const rowOK = srcY >= 0 && srcY < WORK_H;
      for (let px = 0; px < w; px++) {
        const srcX = x + px;
        const dst = (py * w + px) * 3;
        if (!rowOK || srcX < 0 || srcX >= WORK_W) continue;
        const sIdx = (srcY * WORK_W + srcX) * 4;
        out[dst]     = data[sIdx];
        out[dst + 1] = data[sIdx + 1];
        out[dst + 2] = data[sIdx + 2];
      }
    }
    return out;
  }

  // Find the best position near (workCenterX, workCenterY) for the template.
  // Returns { dx, dy, score, conf } where (dx, dy) are work-space offsets
  // from the supplied center, and conf is in [0, 1] (1 = perfect match).
  match(template, workCenterX, workCenterY, searchRadius) {
    const { data: tpl, w: tw, h: th } = template;
    const data = this._workData;
    const halfW = tw / 2, halfH = th / 2;
    const tplBytes = tw * th * 3;
    const maxSad = tplBytes * 96; // realistic worst-case for confidence

    // Coarse pass at stride 3
    let bestScore = Infinity, bestDx = 0, bestDy = 0;
    const stride = 3;
    for (let dy = -searchRadius; dy <= searchRadius; dy += stride) {
      const startY = Math.round(workCenterY + dy - halfH);
      for (let dx = -searchRadius; dx <= searchRadius; dx += stride) {
        const startX = Math.round(workCenterX + dx - halfW);
        const score = this._sad(tpl, tw, th, startX, startY, bestScore);
        if (score < bestScore) { bestScore = score; bestDx = dx; bestDy = dy; }
      }
    }
    // Fine pass at stride 1 in best window
    for (let dy = bestDy - stride; dy <= bestDy + stride; dy++) {
      const startY = Math.round(workCenterY + dy - halfH);
      for (let dx = bestDx - stride; dx <= bestDx + stride; dx++) {
        const startX = Math.round(workCenterX + dx - halfW);
        const score = this._sad(tpl, tw, th, startX, startY, bestScore);
        if (score < bestScore) { bestScore = score; bestDx = dx; bestDy = dy; }
      }
    }
    const conf = Math.max(0, Math.min(1, 1 - bestScore / maxSad));
    return { dx: bestDx, dy: bestDy, score: bestScore, conf };
  }

  // Sum of absolute differences with early-exit if we already exceed best.
  _sad(tpl, tw, th, x, y, bailOut) {
    const data = this._workData;
    let score = 0;
    for (let py = 0; py < th; py++) {
      const wy = y + py;
      const offRow = (wy < 0 || wy >= WORK_H);
      const rowBase = wy * WORK_W;
      const tBase = py * tw * 3;
      for (let px = 0; px < tw; px++) {
        const wx = x + px;
        const tIdx = tBase + px * 3;
        if (offRow || wx < 0 || wx >= WORK_W) {
          // Off-canvas pixel — penalize as if mid-gray distance
          score += Math.abs(tpl[tIdx]) + Math.abs(tpl[tIdx + 1]) + Math.abs(tpl[tIdx + 2]);
        } else {
          const wIdx = (rowBase + wx) * 4;
          score += Math.abs(data[wIdx]     - tpl[tIdx])
                +  Math.abs(data[wIdx + 1] - tpl[tIdx + 1])
                +  Math.abs(data[wIdx + 2] - tpl[tIdx + 2]);
        }
      }
      if (score >= bailOut) return score; // can't improve, bail
    }
    return score;
  }
}

// ── Motion detection (frame differencing) ──────────────────────────────────
// Find local peaks of pixel change between current and previous frame.
// Subtracts GLOBAL motion (camera pan / shake) so only subjects moving
// relative to the scene get picked up. Without this, a panning camera
// would light up the entire frame as "motion".

function detectMotion(curCanvas, prevCanvas, W, H, threshold, maxBlobs, lightCutoff) {
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
  let sum = 0;
  for (let i = 0; i < sW * sH; i++) {
    const j = i * 4;
    const dr = Math.abs(cur[j]   - prev[j]);
    const dg = Math.abs(cur[j+1] - prev[j+1]);
    const db = Math.abs(cur[j+2] - prev[j+2]);
    const v = (dr + dg + db) / 765; // /3/255
    m[i] = v;
    sum += v;
  }

  // Global motion baseline (camera pan / shake). Subtract 1.5x mean so only
  // cells moving meaningfully MORE than the camera background register.
  const meanMotion = sum / (sW * sH);
  const baseline = meanMotion * 1.5;
  for (let i = 0; i < sW * sH; i++) m[i] = Math.max(0, m[i] - baseline);

  // If global motion is very high (fast camera pan), suppress everything —
  // we can't distinguish subjects from camera motion in this frame.
  if (meanMotion > 0.18) return [];

  const cellW = W / sW, cellH = H / sH;
  const peaks = [];
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
      if (!isMax) continue;
      // Light filter on motion: skip peaks where the underlying pixel is
      // bright + desaturated (screens, sun shimmer, billboard flicker).
      const ci = (y * sW + x) * 4;
      const r = cur[ci], g = cur[ci+1], b = cur[ci+2];
      const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const lightScore = luma * (1 - sat * 0.4);
      if (lightScore > lightCutoff) continue;
      peaks.push({
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
    this._tracker = new TemplateTracker();
    // Always use lite_mobilenet_v2 (index 0). The larger mobilenet_v2 was
    // unreliable in practice; keep loader pluggable for future YOLOv8/DETR.
    this._currentModelIdx = 0;
    loadCoco(0);
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Object detection overlay. Mode 1 (Detect): clean COCO-SSD boxes only. Mode 0 (Gallery): adds motion blobs with IDs, mesh, italic poetry.' };
  }

  // Tells the engine to render the image behind cleanly — no distortion,
  // no mix-overlay screen-blend on top. Otherwise the boxes sit on a
  // doubled/ghosted image that looks blurry.
  get wantsCleanBackground() { return true; }

  get params() {
    return [
      { id: 'bt_aiOnly',     label: 'Mode',        min: 0,    max: 1,    step: 1    },
      { id: 'bt_classFilter',label: 'Class Filter',min: 0,    max: 4,    step: 1    },
      { id: 'bt_lightFilter',label: 'Light Filter',min: 0,    max: 1,    step: 0.02 },
      { id: 'bt_threshold',  label: 'Threshold',   min: 0.02, max: 0.5,  step: 0.01 },
      { id: 'bt_maxBlobs',   label: 'Max Blobs',   min: 2,    max: 50,   step: 1    },
      { id: 'bt_boxSize',    label: 'Box Scale',   min: 0.3,  max: 2.5,  step: 0.05 },
      { id: 'bt_lines',      label: 'Lines',       min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_text',       label: 'Text Size',   min: 6,    max: 18,   step: 1    },
      { id: 'bt_color',      label: 'Color',       min: 0,    max: 1,    step: 1    },
      { id: 'bt_seed',       label: 'Seed',        min: 0,    max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.1, max: 0.95, step: 0.02 }; }
  animate() {}

  randomize(state, set) {
    const ai = Math.round(state.bt_aiOnly ?? 1) === 1;
    set('bt_threshold', parseFloat((0.04 + Math.random() * 0.2).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 30));
    set('bt_boxSize',   parseFloat((0.6 + Math.random() * 1.4).toFixed(2)));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_seed',      Math.floor(Math.random() * 100));
    if (!ai) {
      set('bt_lines',   parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
      set('bt_color',   Math.round(Math.random()));
    }
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const aiOnly      = Math.round(s.bt_aiOnly ?? 1) === 1;
    const classFilter = Math.round(s.bt_classFilter ?? 0);
    const lightFilter = s.bt_lightFilter ?? 0.25;
    // Drop a region if its lightScore is above this. lightFilter goes 0..1;
    // threshold = 1 - lightFilter*0.6, so:
    //   0   -> threshold 1.0 (nothing dropped)
    //   0.5 -> threshold 0.7 (drops blown-out highlights)
    //   1   -> threshold 0.4 (very aggressive)
    const lightCutoff = 1 - lightFilter * 0.6;
    const threshold   = s.bt_threshold ?? 0.08;
    const maxBlobs    = Math.round(s.bt_maxBlobs ?? 15);
    const boxScale    = s.bt_boxSize ?? 1;
    const lineAmt     = s.bt_lines ?? 0;
    const textSize    = Math.round(s.bt_text ?? 11);
    const multiColor  = Math.round(s.bt_color ?? 0) === 1;
    const seed        = Math.round(s.bt_seed ?? 42);
    const fg          = s.fgColor || '#ffffff';
    // Hard cap on rendered box size. Two layers: 12% of min(W,H) AND a
    // 220px absolute floor for HiDPI safety. Whichever is smaller wins.
    const maxBoxDim   = Math.min(220, Math.min(W, H) * 0.12);
    const minDim      = Math.min(W, H);
    const canvasArea  = W * H;

    // ── Capture canvas ───────────────────────────────────────────────────────
    if (!this._cap) this._cap = document.createElement('canvas');
    this._cap.width = Math.round(W);
    this._cap.height = Math.round(H);
    this._cap.getContext('2d').drawImage(ctx.canvas, 0, 0, Math.round(W), Math.round(H));

    // ── Update tracker work-frame once per frame ────────────────────────────
    // Every blob's per-frame template match reads from this single buffer.
    this._tracker.captureFrame(this._cap, W, H);

    // ── Track every existing blob (between detections) ──────────────────────
    // Each tracked blob updates its position via SAD template matching on
    // the work frame. This is the "track" half of detect-then-track.
    for (const b of this._blobs) {
      if (!b.template) continue;
      const wp = this._tracker.toWork(b.x, b.y);
      const sr = Math.max(8, Math.min(b.template.w, b.template.h) * 0.7);
      const m = this._tracker.match(b.template, wp.x, wp.y, sr);
      // Only commit the move if confidence is decent — otherwise the box
      // would drift onto a similar-looking patch (sky, wall, etc.).
      if (m.conf > 0.55) {
        b.x += m.dx / this._tracker._scale;
        b.y += m.dy / this._tracker._scale;
        b.trackConf = m.conf;
        b.trackedAge++;
      } else {
        b.trackConf = m.conf;
      }
    }

    // ── COCO-SSD detection (async, every 250ms) ─────────────────────────────
    const now = performance.now();
    if (cocoModel && !this._cocoPending && now - this._lastCocoTime > 250) {
      this._cocoPending = true;
      this._lastCocoTime = now;
      const cap = this._cap;
      cocoModel.detect(cap, maxBlobs).then(preds => {
        this._cocoDetections = preds
          .filter(p => {
            // Class filter (user override — hides classes the user knows are wrong)
            if (!classAllowed(p.class, classFilter)) return false;
            // Per-class confidence floor — animals on hard scenes need very high confidence
            const minConf = CLASS_MIN_CONF[p.class] ?? DEFAULT_MIN_CONF;
            if (p.score < minConf) return false;
            // Reject giant boxes (>18% of canvas area = false positive on a crowd
            // or a misread scene element, never a real single subject)
            if ((p.bbox[2] * p.bbox[3]) / canvasArea > 0.18) return false;
            // Reject obviously-wrong landscape "person" boxes (a real person
            // standing/walking is taller than wide; allow some leniency for
            // crouched, sitting, or occluded subjects).
            if (p.class === 'person' && p.bbox[2] > p.bbox[3] * 1.6) return false;
            // Light filter — drops blown-out / desaturated regions (sun, sky,
            // snow, screens). Saturated subjects (red car, blue jacket) survive.
            if (regionLightScore(cap, p.bbox) > lightCutoff) return false;
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
        // Force a re-render so still-image users see the new detections —
        // without this, COCO results never appear on a paused/static source.
        markDirty();
      }).catch(() => { this._cocoPending = false; });
    }

    // ── Motion fallback (frame diff) — only when AI Only mode is off ─────────
    let motionBlobs = [];
    if (!aiOnly) {
      motionBlobs = detectMotion(this._cap, this._prevFrame, W, H, threshold, maxBlobs, lightCutoff);
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
        // Velocity deadzone — sub-3px discrepancies are jitter, not motion.
        // Without this, COCO bbox noise accumulates into apparent drift.
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          blob.vx = (blob.vx || 0) * 0.7 + dx * 0.25;
          blob.vy = (blob.vy || 0) * 0.7 + dy * 0.25;
          // Clamp velocity — no blob should move >20px/frame
          const vmag = Math.hypot(blob.vx, blob.vy);
          if (vmag > 20) { blob.vx *= 20 / vmag; blob.vy *= 20 / vmag; }
        } else {
          blob.vx = (blob.vx || 0) * 0.85;
          blob.vy = (blob.vy || 0) * 0.85;
        }
        // Position smoothing — low value, residual correction only
        blob.x += dx * 0.12;
        blob.y += dy * 0.12;
        // Hard cap at update time — runaway blobs from a transient bad detection
        // can no longer grow past maxBoxDim
        blob.w = Math.min(maxBoxDim, blob.w + (det.w - blob.w) * 0.08);
        blob.h = Math.min(maxBoxDim, blob.h + (det.h - blob.h) * 0.08);
        // Refresh template every COCO call so appearance drift is absorbed
        // (subject turns, lighting changes, etc.).
        blob.template = this._tracker.extractTemplate(blob.x, blob.y, blob.w, blob.h);
        blob.trackedAge = 0;
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
      const newW = Math.min(maxBoxDim, det.w || 50);
      const newH = Math.min(maxBoxDim, det.h || 35);
      this._blobs.push({
        x: det.x, y: det.y,
        w: newW, h: newH,
        vx: 0, vy: 0,
        id: this._nextId++,
        label: det.label || null,
        score: det.score || 0,
        candidateLabel: null,
        candidateStreak: 0,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        colorIdx: Math.floor(Math.random() * MULTI_COLORS.length),
        age: 0, missing: 0, confirmed: 1,
        template: this._tracker.extractTemplate(det.x, det.y, newW, newH),
        trackedAge: 0,
        trackConf: 1,
      });
    }

    // Kill long-missing — bump from 80 to 240 frames (~4s) so a paused subject
    // or a temporarily-occluded one keeps its identity instead of respawning.
    this._blobs = this._blobs.filter(b => b.missing < 240);

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

    // Persist a blob for ~2 seconds at 60fps even without re-detection. COCO
    // is noisy — a person doesn't actually blink in/out at 6Hz. Long
    // persistence + binary alpha = no flicker.
    const visible = this._blobs.filter(b => {
      if (b.confirmed < 3 || b.missing >= 120) return false;
      if (aiOnly && !b.label) return false;
      return true;
    });
    if (visible.length === 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // ── K-nearest-neighbor mesh (gallery mode only) ──────────────────────────
    // Each blob connects to its 2 nearest neighbors, with a distance cap.
    // Avoids the O(n²) full-mesh cobweb that was just visual noise.
    if (!aiOnly && lineAmt > 0 && visible.length > 1) {
      const distCap = Math.min(W, H) * 0.4;
      const edges = new Set();
      for (let i = 0; i < visible.length; i++) {
        const a = visible[i];
        const dists = [];
        for (let j = 0; j < visible.length; j++) {
          if (i === j) continue;
          const b = visible[j];
          dists.push({ j, d: Math.hypot(a.x - b.x, a.y - b.y) });
        }
        dists.sort((p, q) => p.d - q.d);
        for (let n = 0; n < Math.min(2, dists.length); n++) {
          if (dists[n].d > distCap) break;
          const j = dists[n].j;
          edges.add(i < j ? `${i}-${j}` : `${j}-${i}`);
        }
      }
      ctx.lineWidth = 0.9;
      for (const key of edges) {
        const [pi, pj] = key.split('-').map(Number);
        const a = visible[pi], b = visible[pj];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        // Fully visible at distCap*0.5, fading toward distCap
        const distFade = Math.max(0, 1 - d / distCap);
        const alpha = lineAmt * 0.85 * distFade;
        if (alpha < 0.02) continue;
        ctx.strokeStyle = multiColor ? MULTI_COLORS[a.colorIdx] : fg;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // ── Boxes ────────────────────────────────────────────────────────────────
    for (const blob of visible) {
      // Solid alpha while alive — no fade-blinking. The box exists or it doesn't.
      const fade = 1;

      const color = multiColor ? MULTI_COLORS[blob.colorIdx] : fg;
      // Apply user-controlled box scale, then clamp to the hard cap.
      const bw = Math.min(maxBoxDim, Math.max(12, blob.w * boxScale));
      const bh = Math.min(maxBoxDim, Math.max(10, blob.h * boxScale));
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
          ctx.font = `${textSize - 1}px Helvetica, Arial, sans-serif`;
          ctx.globalAlpha = 0.5;
          ctx.fillText(TEXT_POOL[blob.textIdx % TEXT_POOL.length], bx, by + bh + textSize + 5);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
