/**
 * Blob Track — blob detection + face detection with persistent tracking.
 * Uses browser FaceDetector API when available for face tracking with
 * generated names/ages. Falls back to brightness blob detection.
 * Color modes for box styling.
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

const NAMES = [
  'ALEX', 'MAYA', 'KAI', 'LUNA', 'REMI', 'NOVA', 'SASHA', 'RIVER',
  'ZARA', 'FINN', 'IRIS', 'JUDE', 'CLEO', 'MILO', 'SAGE', 'WREN',
  'EDEN', 'LUCA', 'ARIA', 'SETH', 'NOOR', 'OMAR', 'YUKI', 'INES',
  'DARA', 'LEON', 'ELIF', 'AMIR', 'HANA', 'ROAN', 'TARA', 'VERA',
];

const COLOR_MODES = [
  { name: 'White',   box: '#ffffff', text: '#ffffff' },
  { name: 'Cyan',    box: '#00ddff', text: '#00ddff' },
  { name: 'Green',   box: '#00ff88', text: '#00ff88' },
  { name: 'Red',     box: '#ff3344', text: '#ff3344' },
  { name: 'Yellow',  box: '#ffdd00', text: '#ffdd00' },
  { name: 'Pink',    box: '#ff69b4', text: '#ff69b4' },
  { name: 'Multi',   box: null,      text: null      }, // each blob gets its own color
];

const MULTI_COLORS = ['#00ddff','#ff3344','#00ff88','#ffdd00','#ff69b4','#ff8800','#aa55ff','#55ffaa'];

// ── Face detection (browser API) ─────────────────────────────────────────────

let faceDetector = null;
let faceDetectorFailed = false;

async function initFaceDetector() {
  if (faceDetector || faceDetectorFailed) return;
  try {
    if (typeof FaceDetector !== 'undefined') {
      faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 50 });
    } else {
      faceDetectorFailed = true;
    }
  } catch (e) {
    faceDetectorFailed = true;
  }
}

async function detectFaces(source, W, H) {
  if (!faceDetector) return [];
  try {
    const faces = await faceDetector.detect(source);
    // Map face bounding boxes to canvas coordinates
    const srcW = source.videoWidth || source.naturalWidth || source.width;
    const srcH = source.videoHeight || source.naturalHeight || source.height;
    const scaleX = W / srcW;
    const scaleY = H / srcH;
    return faces.map(f => ({
      x: f.boundingBox.x * scaleX + f.boundingBox.width * scaleX / 2,
      y: f.boundingBox.y * scaleY + f.boundingBox.height * scaleY / 2,
      w: f.boundingBox.width * scaleX,
      h: f.boundingBox.height * scaleY,
      isFace: true,
    }));
  } catch (e) {
    return [];
  }
}

// ── Brightness blob detection (fallback) ─────────────────────────────────────

function detectBrightnessBlobs(canvas, W, H, threshold, maxBlobs, maxBlobCells) {
  const gW = 24, gH = 18;
  const off = document.createElement('canvas');
  off.width = gW; off.height = gH;
  const c = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(canvas, 0, 0, gW, gH);
  const d = c.getImageData(0, 0, gW, gH).data;
  const cellW = W / gW, cellH = H / gH;

  const bright = new Float32Array(gW * gH);
  for (let i = 0; i < gW * gH; i++) {
    const j = i * 4;
    bright[i] = (d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114) / 255;
  }

  const on = new Uint8Array(gW * gH);
  for (let i = 0; i < gW * gH; i++) on[i] = bright[i] >= threshold ? 1 : 0;

  const labels = new Int16Array(gW * gH).fill(-1);
  let nextLabel = 0;
  const components = [];

  for (let y = 0; y < gH; y++) {
    for (let x = 0; x < gW; x++) {
      const idx = y * gW + x;
      if (!on[idx] || labels[idx] >= 0) continue;

      const label = nextLabel++;
      const queue = [idx];
      labels[idx] = label;
      const cells = [];

      while (queue.length > 0 && cells.length < maxBlobCells) {
        const ci = queue.shift();
        cells.push(ci);
        const cx = ci % gW, cy = (ci - cx) / gW;
        for (const ni of [cy > 0 ? ci-gW : -1, cy < gH-1 ? ci+gW : -1, cx > 0 ? ci-1 : -1, cx < gW-1 ? ci+1 : -1]) {
          if (ni >= 0 && on[ni] && labels[ni] < 0) { labels[ni] = label; queue.push(ni); }
        }
      }
      for (const lo of queue) labels[lo] = -1;

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
          isFace: false,
        });
      }
    }
  }

  components.sort((a, b) => b.w * b.h - a.w * a.h);
  return components.slice(0, maxBlobs);
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export class BlobTrack extends Algorithm {
  constructor(engine) {
    super(engine);
    this._blobs = [];
    this._nextId = 0;
    this._faceDetectPending = false;
    this._lastFaces = [];
    this._lastFaceTime = 0;
    initFaceDetector();
  }

  get metadata() {
    return { name: 'Blob Track', eq: 'detect × annotate', cat: 'Data Art',
      desc: 'Blob + face tracking — detects bright regions and faces, assigns IDs/names/ages, draws connection mesh.' };
  }

  get params() {
    return [
      { id: 'bt_threshold', label: 'Threshold', min: 0.1,  max: 0.95, step: 0.02 },
      { id: 'bt_maxBlobs',  label: 'Max Blobs', min: 2,    max: 50,   step: 1    },
      { id: 'bt_boxSize',   label: 'Max Size',  min: 3,    max: 12,   step: 1    },
      { id: 'bt_lines',     label: 'Lines',     min: 0,    max: 1,    step: 0.05 },
      { id: 'bt_text',      label: 'Text Size', min: 6,    max: 18,   step: 1    },
      { id: 'bt_color',     label: 'Color',     min: 0,    max: 6,    step: 1    },
      { id: 'bt_seed',      label: 'Seed',      min: 0,    max: 100,  step: 1    },
    ];
  }

  get detailParam() { return { id: 'bt_threshold', min: 0.1, max: 0.95, step: 0.02 }; }
  animate() {}

  randomize(state, set) {
    set('bt_threshold', parseFloat((0.2 + Math.random() * 0.4).toFixed(2)));
    set('bt_maxBlobs',  Math.floor(5 + Math.random() * 30));
    set('bt_boxSize',   Math.floor(4 + Math.random() * 6));
    set('bt_lines',     parseFloat((0.2 + Math.random() * 0.8).toFixed(2)));
    set('bt_text',      Math.floor(8 + Math.random() * 8));
    set('bt_color',     Math.floor(Math.random() * 7));
    set('bt_seed',      Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const threshold = s.bt_threshold ?? 0.4;
    const maxBlobs  = Math.round(s.bt_maxBlobs ?? 15);
    const maxSize   = Math.round(s.bt_boxSize ?? 6);
    const lineAmt   = s.bt_lines ?? 0.5;
    const textSize  = Math.round(s.bt_text ?? 11);
    const colorMode = Math.round(s.bt_color ?? 0);
    const seed      = Math.round(s.bt_seed ?? 42);
    const t         = s.time ?? 0;

    const cm = COLOR_MODES[colorMode] || COLOR_MODES[0];

    // ── Face detection (async, non-blocking) ─────────────────────────────────
    const now = performance.now();
    const imgSource = world.engine?._algorithm?.engine?.world?.camera?._video ||
      (typeof imageProcessor !== 'undefined' ? null : null);

    // Try face detection on the image processor source
    if (faceDetector && !this._faceDetectPending && now - this._lastFaceTime > 200) {
      this._faceDetectPending = true;
      this._lastFaceTime = now;
      // Try to get the source from the image processor
      const ip = world.engine?.world?.camera?._video;
      const src = ip || ctx.canvas;
      detectFaces(src, W, H).then(faces => {
        this._lastFaces = faces;
        this._faceDetectPending = false;
      }).catch(() => { this._faceDetectPending = false; });
    }

    // ── Brightness blob detection ────────────────────────────────────────────
    const brightBlobs = detectBrightnessBlobs(ctx.canvas, W, H, threshold, maxBlobs, maxSize);

    // Combine face detections + brightness blobs
    const allDetections = [...this._lastFaces, ...brightBlobs].slice(0, maxBlobs + 10);

    // ── Match to existing blobs ──────────────────────────────────────────────
    const matchR = Math.min(W, H) * 0.15;
    const usedD = new Set();

    for (const blob of this._blobs) {
      let bestD = Infinity, bestDi = -1;
      for (let di = 0; di < allDetections.length; di++) {
        if (usedD.has(di)) continue;
        const d = Math.hypot(allDetections[di].x - blob.x, allDetections[di].y - blob.y);
        if (d < bestD && d < matchR) { bestD = d; bestDi = di; }
      }
      if (bestDi >= 0) {
        const det = allDetections[bestDi];
        usedD.add(bestDi);
        blob.x += (det.x - blob.x) * 0.5;
        blob.y += (det.y - blob.y) * 0.5;
        blob.w += (det.w - blob.w) * 0.3;
        blob.h += (det.h - blob.h) * 0.3;
        blob.missing = 0;
        blob.confirmed++;
        if (det.isFace && !blob.isFace) {
          blob.isFace = true;
          blob.name = NAMES[blob.id % NAMES.length];
          blob.age = 18 + Math.floor(Math.abs(Math.sin(blob.id * 7.3)) * 45);
          blob.confidence = 75 + Math.floor(Math.abs(Math.cos(blob.id * 3.1)) * 24);
        }
      } else {
        blob.missing++;
      }
      blob.age_frames++;
    }

    // New blobs
    for (let di = 0; di < allDetections.length; di++) {
      if (usedD.has(di)) continue;
      if (this._blobs.length >= maxBlobs) break;
      const det = allDetections[di];
      const id = this._nextId++;
      const blob = {
        x: det.x, y: det.y, w: det.w, h: det.h,
        id,
        textIdx: Math.floor(Math.random() * TEXT_POOL.length),
        age_frames: 0, missing: 0, confirmed: 1,
        isFace: det.isFace || false,
        name: det.isFace ? NAMES[id % NAMES.length] : null,
        age: det.isFace ? 18 + Math.floor(Math.abs(Math.sin(id * 7.3)) * 45) : null,
        confidence: det.isFace ? 75 + Math.floor(Math.abs(Math.cos(id * 3.1)) * 24) : null,
        colorIdx: id % MULTI_COLORS.length,
      };
      this._blobs.push(blob);
    }

    // Kill missing
    this._blobs = this._blobs.filter(b => b.missing < 60);

    // Clamp
    for (const b of this._blobs) {
      b.x = Math.max(b.w / 2, Math.min(W - b.w / 2, b.x));
      b.y = Math.max(b.h / 2, Math.min(H - b.h / 2, b.y));
    }

    const visible = this._blobs.filter(b => b.confirmed >= 3 && b.missing < 30);
    if (visible.length === 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    function getColor(blob) {
      if (cm.box === null) return MULTI_COLORS[blob.colorIdx % MULTI_COLORS.length];
      return cm.box;
    }

    // Mesh lines
    if (lineAmt > 0 && visible.length > 1) {
      ctx.lineWidth = 0.6;
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i], b = visible[j];
          const fa = Math.max(0, 1 - a.missing / 30);
          const fb = Math.max(0, 1 - b.missing / 30);
          ctx.strokeStyle = getColor(a);
          ctx.globalAlpha = lineAmt * 0.3 * fa * fb;
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

      const color = getColor(blob);
      const bw = Math.max(14, blob.w);
      const bh = Math.max(10, blob.h);
      const bx = blob.x - bw / 2;
      const by = blob.y - bh / 2;

      // Box
      ctx.strokeStyle = color;
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

      // Label
      ctx.fillStyle = color;
      ctx.globalAlpha = fade * 0.85;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';

      if (blob.isFace && blob.name) {
        // Face: show name, age, confidence
        ctx.font = `bold ${textSize}px Helvetica, Arial, sans-serif`;
        ctx.fillText(blob.name, bx + 1, by - 2);
        ctx.font = `${textSize - 2}px Helvetica, Arial, sans-serif`;
        ctx.globalAlpha = fade * 0.6;
        ctx.textBaseline = 'top';
        ctx.fillText(`Age: ${blob.age}  ${blob.confidence}%`, bx, by + bh + 2);
      } else {
        // Blob: hex ID
        ctx.font = `${textSize}px Helvetica, Arial, sans-serif`;
        ctx.fillText('0x' + (blob.id & 0xFF).toString(16).toUpperCase().padStart(2, '0'), bx + 1, by - 2);

        // Text annotation
        if (blob.age_frames > 8 && (blob.id + seed) % 3 === 0) {
          ctx.font = `italic ${textSize - 1}px Helvetica, Arial, sans-serif`;
          ctx.globalAlpha = fade * 0.5;
          ctx.textBaseline = 'top';
          ctx.fillText(TEXT_POOL[blob.textIdx % TEXT_POOL.length], bx, by + bh + 3);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG() { return null; }
}
