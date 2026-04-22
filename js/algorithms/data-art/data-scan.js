/**
 * Data Scan — Clinical/analytical overlay.
 * Coordinate markers, dashed measurement lines, selection handles,
 * small floating panels showing cropped image pieces.
 * Like facial recognition software or photogrammetry.
 * The uploaded image shows through — this is a clinical HUD layered on top.
 */

import { Algorithm } from '../base.js';

// ── Seeded LCG RNG ────────────────────────────────────────────────────────────

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function pickFrom(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

// ── Text pools ────────────────────────────────────────────────────────────────

const NODE_LABELS = [
  'NODE_A', 'NODE_B', 'REF_POINT_03', 'BASELINE', 'ANCHOR_01',
  'FOCAL_PT', 'VERTEX_12', 'ORIGIN', 'PIVOT_C', 'TRACK_07',
];

const DATA_LABELS = [
  'DELTA: 0.342', 'MATCH: 94.2%', 'SCAN AREA 02', 'CONF: 87.1%',
  'ERR: ±0.003', 'OFFSET: 1.44', 'RATIO: 1.618', 'PHI: 0.9997',
  'SIGMA: 2.31', 'ALIGN: OK', 'LOCK: TRUE', 'DRIFT: -0.07',
  'VAR: 0.0041', 'SCALE: 1:1', 'FRAME_ID: 044', 'SEQ: 00FF3A',
];

const STATUS_LABELS = [
  'SCANNING...', 'PROCESSING', 'LOCKED', 'TRACKING', 'MEASURING',
  'CALIBRATING', 'COMPUTING', 'ANALYZING', 'MAPPING', 'DETECTING',
];

// ── Colors ────────────────────────────────────────────────────────────────────

const COLORS = {
  white:  '#ffffff',
  green:  '#00FF88',
  orange: '#FF8800',
  red:    '#FF3333',
  blue:   '#44AAFF',
};

// ── Main class ────────────────────────────────────────────────────────────────

export class DataScan extends Algorithm {

  get metadata() {
    return {
      name: 'Data Scan',
      eq:   'scan × measure',
      cat:  'Data Art',
      desc: 'Clinical analysis overlay — measurement lines, coordinate markers, floating crop panels, grid, and data labels. Like facial recognition or photogrammetry software.',
    };
  }

  get params() {
    return [
      { id: 'ds_lines',   label: 'Lines',    min: 0,  max: 30,  step: 1,    default: 12  },
      { id: 'ds_panels',  label: 'Panels',   min: 0,  max: 12,  step: 1,    default: 5   },
      { id: 'ds_markers', label: 'Markers',  min: 0,  max: 20,  step: 1,    default: 8   },
      { id: 'ds_grid',    label: 'Grid',     min: 0,  max: 1,   step: 0.05, default: 0.3 },
      { id: 'ds_labels',  label: 'Labels',   min: 0,  max: 1,   step: 0.05, default: 0.5 },
      { id: 'ds_seed',    label: 'Seed',     min: 0,  max: 100, step: 1,    default: 42  },
    ];
  }

  get detailParam() {
    return { id: 'ds_lines', min: 0, max: 30, step: 1 };
  }

  animate(world) {}

  render(ctx, world) {
    const { W, H, state: s } = world;

    const nLines   = Math.round(clamp(s.ds_lines   ?? 12, 0,  30));
    const nPanels  = Math.round(clamp(s.ds_panels  ?? 5,  0,  12));
    const nMarkers = Math.round(clamp(s.ds_markers ?? 8,  0,  20));
    const grid     = clamp(s.ds_grid    ?? 0.3, 0,   1);
    const labels   = clamp(s.ds_labels  ?? 0.5, 0,   1);
    const seed     = Math.round(clamp(s.ds_seed ?? 42, 0, 100));

    const rng = makeLCG(seed * 3571 + 98765);

    ctx.save();

    // Very light wash (8%) — image dominant
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // ── 1. Grid overlay ───────────────────────────────────────────────────────
    if (grid > 0) {
      this._drawGrid(ctx, W, H, grid, rng);
    }

    // ── 2. Measurement lines ──────────────────────────────────────────────────
    if (nLines > 0) {
      this._drawMeasurementLines(ctx, W, H, nLines, labels, rng);
    }

    // ── 3. Coordinate markers ─────────────────────────────────────────────────
    if (nMarkers > 0) {
      this._drawMarkers(ctx, W, H, nMarkers, labels, rng);
    }

    // ── 4. Floating crop panels ───────────────────────────────────────────────
    if (nPanels > 0) {
      this._drawPanels(ctx, W, H, nPanels, rng);
    }

    // ── 5. Status/data label scatter ──────────────────────────────────────────
    if (labels > 0.3) {
      this._drawStatusLabels(ctx, W, H, labels, rng);
    }

    ctx.restore();
  }

  // ── Grid overlay ──────────────────────────────────────────────────────────

  _drawGrid(ctx, W, H, grid, rng) {
    ctx.save();

    // Number of cells = 4–16 depending on grid param
    const cols = Math.round(4 + grid * 12);
    const rows = Math.round(4 + grid * 8);
    const cellW = W / cols;
    const cellH = H / rows;

    ctx.strokeStyle = COLORS.green;
    ctx.globalAlpha = grid * 0.25;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 6]);

    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = r * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = grid * 0.5;

    // Column labels at top
    ctx.font = '9px monospace';
    ctx.fillStyle = COLORS.green;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let c = 0; c < cols; c++) {
      ctx.fillText(String.fromCharCode(65 + (c % 26)), c * cellW + cellW / 2, 3);
    }

    // Row labels at left
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      ctx.fillText(String(r + 1), 3, r * cellH + cellH / 2);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ── Measurement lines ────────────────────────────────────────────────────

  _drawMeasurementLines(ctx, W, H, nLines, labels, rng) {
    ctx.save();

    for (let i = 0; i < nLines; i++) {
      const x1 = rng() * W;
      const y1 = rng() * H;
      const x2 = rng() * W;
      const y2 = rng() * H;

      const colorKey = pickFrom(['white', 'green', 'red'], rng);
      const color = COLORS[colorKey];

      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Main measurement line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.setLineDash([]);

      // Square handles at endpoints
      const hSize = 4;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x1 - hSize / 2, y1 - hSize / 2, hSize, hSize);
      ctx.fillRect(x2 - hSize / 2, y2 - hSize / 2, hSize, hSize);

      // Label near midpoint
      if (labels > 0.2) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dx = Math.abs(Math.round(x2 - x1));
        const dy = Math.abs(Math.round(y2 - y1));
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

        ctx.font = '9px monospace';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.textBaseline = 'bottom';
        ctx.fillText(`x: ${Math.round(x1)} y: ${Math.round(y1)}`, mx + 4, my - 2);
        ctx.fillText(`${dist}px`, mx + 4, my + 10);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // ── Dimension annotations (horizontal/vertical with endcaps) ──────────────
    const nAnnotations = Math.round(labels * 4) + 1;
    for (let i = 0; i < nAnnotations; i++) {
      const isHoriz = rng() < 0.5;
      const ax = 30 + rng() * (W - 60);
      const ay = 30 + rng() * (H - 60);
      const len = 80 + rng() * 200;

      ctx.strokeStyle = COLORS.white;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      if (isHoriz) {
        // Horizontal dim line
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + len, ay);
        ctx.stroke();
        // Endcaps
        ctx.beginPath();
        ctx.moveTo(ax, ay - 5); ctx.lineTo(ax, ay + 5);
        ctx.moveTo(ax + len, ay - 5); ctx.lineTo(ax + len, ay + 5);
        ctx.stroke();
        // Label
        if (labels > 0.1) {
          ctx.font = '9px monospace';
          ctx.fillStyle = COLORS.white;
          ctx.globalAlpha = 0.8;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${Math.round(len)}px`, ax + len / 2, ay - 3);
        }
      } else {
        // Vertical dim line
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, ay + len);
        ctx.stroke();
        // Endcaps
        ctx.beginPath();
        ctx.moveTo(ax - 5, ay); ctx.lineTo(ax + 5, ay);
        ctx.moveTo(ax - 5, ay + len); ctx.lineTo(ax + 5, ay + len);
        ctx.stroke();
        // Label
        if (labels > 0.1) {
          ctx.font = '9px monospace';
          ctx.fillStyle = COLORS.white;
          ctx.globalAlpha = 0.8;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${Math.round(len)}px`, ax + 7, ay + len / 2);
        }
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Coordinate markers ────────────────────────────────────────────────────

  _drawMarkers(ctx, W, H, nMarkers, labels, rng) {
    ctx.save();

    for (let i = 0; i < nMarkers; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const type = rng() < 0.5 ? 'crosshair' : 'square';
      const colorKey = pickFrom(['white', 'green', 'orange'], rng);
      const color = COLORS[colorKey];
      const label = pickFrom(NODE_LABELS, rng);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      if (type === 'crosshair') {
        // Small crosshair +
        const size = 8;
        ctx.beginPath();
        ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
        ctx.stroke();

        // Small center dot
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Small square marker
        const sq = 6;
        ctx.strokeRect(x - sq / 2, y - sq / 2, sq, sq);

        // Dotted leader line to label
        if (labels > 0.2) {
          ctx.setLineDash([2, 3]);
          const lx = x + 15;
          const ly = y - 10;
          ctx.beginPath();
          ctx.moveTo(x + sq / 2, y);
          ctx.lineTo(lx, ly);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Label
      if (labels > 0.2) {
        ctx.font = '8px monospace';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x + 10, y - 2);
        ctx.textBaseline = 'alphabetic';
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Floating crop panels ──────────────────────────────────────────────────

  _drawPanels(ctx, W, H, nPanels, rng) {
    ctx.save();

    for (let i = 0; i < nPanels; i++) {
      // Source crop region (from the current canvas)
      const srcW = 80 + Math.floor(rng() * 120);
      const srcH = 60 + Math.floor(rng() * 100);
      const srcX = Math.floor(rng() * Math.max(1, W - srcW));
      const srcY = Math.floor(rng() * Math.max(1, H - srcH));

      // Destination (panel position) — avoid corners of panel going off canvas
      const panelW = 60 + Math.floor(rng() * 90);
      const panelH = Math.round(panelW * (srcH / srcW));
      const destX = Math.floor(rng() * Math.max(1, W - panelW - 2));
      const destY = Math.floor(rng() * Math.max(1, H - panelH - 16));

      // Don't overlap with source region (heuristic)
      const overlapX = destX < srcX + srcW && destX + panelW > srcX;
      const overlapY = destY < srcY + srcH && destY + panelH > srcY;
      if (overlapX && overlapY) continue;

      ctx.globalAlpha = 1;

      // Draw cropped image region
      try {
        ctx.drawImage(
          ctx.canvas,
          srcX, srcY, srcW, srcH,
          destX, destY, panelW, panelH
        );
      } catch (e) { /* canvas may not be readable */ }

      // Border around panel
      const borderColor = pickFrom([COLORS.white, COLORS.green, COLORS.orange], rng);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(destX, destY, panelW, panelH);

      // Label strip at bottom
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(destX, destY + panelH - 12, panelW, 12);
      ctx.font = '8px monospace';
      ctx.fillStyle = borderColor;
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${srcX},${srcY}  ${srcW}x${srcH}`,
        destX + 3,
        destY + panelH - 6
      );
      ctx.textBaseline = 'alphabetic';

      // Small corner marks on source region
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(srcX, srcY, srcW, srcH);
      ctx.setLineDash([]);

      // Leader line from panel corner to source corner
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(destX, destY);
      ctx.lineTo(srcX, srcY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Status labels ────────────────────────────────────────────────────────

  _drawStatusLabels(ctx, W, H, labels, rng) {
    const count = Math.round(labels * 12) + 2;
    ctx.save();
    ctx.font = '9px monospace';

    for (let i = 0; i < count; i++) {
      const isData   = rng() < 0.6;
      const text     = isData ? pickFrom(DATA_LABELS, rng) : pickFrom(STATUS_LABELS, rng);
      const colorKey = isData ? pickFrom(['white', 'green'], rng) : 'orange';
      const color    = COLORS[colorKey];

      const x = rng() * W;
      const y = rng() * H;

      ctx.globalAlpha = 0.65 + rng() * 0.3;
      ctx.fillStyle = color;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  randomize(state, set) {
    set('ds_lines',   Math.round(Math.random() * 30));
    set('ds_panels',  Math.round(Math.random() * 12));
    set('ds_markers', Math.round(Math.random() * 20));
    set('ds_grid',    parseFloat((Math.random()).toFixed(2)));
    set('ds_labels',  parseFloat((Math.random()).toFixed(2)));
    set('ds_seed',    Math.round(Math.random() * 100));
  }
}
