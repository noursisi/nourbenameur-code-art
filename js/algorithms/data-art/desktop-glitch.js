/**
 * Desktop Glitch — Windows XP/95 glitch aesthetic.
 * Cursor arrows, context menus, selection rectangles, error dialogs,
 * image displacement/corruption. Like a broken Windows desktop.
 * The uploaded image shows through — these elements layer on top.
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

// ── Win95/XP UI constants ─────────────────────────────────────────────────────

const WIN_GRAY   = '#C0C0C0';
const WIN_DARK   = '#808080';
const WIN_DARKER = '#404040';
const WIN_NAVY   = '#000080';
const WIN_WHITE  = '#ffffff';
const WIN_BLACK  = '#000000';

const CONTEXT_ITEMS = [
  'View', 'Sort by', 'Group by', 'Refresh',
  'Customize this folder...', 'Paste', 'Paste shortcut',
  'Share with', 'New', 'Properties',
];

const ERROR_MESSAGES = [
  'This program has performed an illegal operation\nand will be shut down.',
  'Error at or near\nUnknown System Error',
  'A fatal exception 0E has occurred at\n0028:C0034B53 in VxD---.',
  'Not enough memory to complete\nthis operation.',
  'Windows cannot access the specified device,\npath, or file.',
  'Stack overflow at line: 0',
  'Internet Explorer has encountered\nan error and must close.',
  'The connection was refused when\nattempting to contact the server.',
  'Object expected\nLine: 1 Char: 1\nCode: 0',
  'Runtime Error!\nProgram: C:\\WINDOWS\\Explorer.EXE',
];

const WINDOW_TITLES = [
  'Error', 'Warning', 'Microsoft Windows', 'Internet Explorer',
  'File Download', 'Security Warning', 'System Properties',
  'Windows has encountered a problem', 'Illegal Operation',
];

const EYE_TEXTS = ['EYE', 'WATCH', 'SEEN', 'RECORD', 'LOG', 'TRACE'];

// ── Drawing helpers ───────────────────────────────────────────────────────────

/** Draw classic Windows raised 3D border (inset=false) or sunken (inset=true) */
function drawWin3dBorder(ctx, x, y, w, h, inset = false) {
  const light  = inset ? WIN_DARKER : WIN_WHITE;
  const shadow = inset ? WIN_WHITE  : WIN_DARKER;
  const mid    = inset ? WIN_WHITE  : WIN_GRAY;
  const dark   = inset ? WIN_GRAY   : WIN_DARK;

  // Outer light (top, left)
  ctx.strokeStyle = light;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y); ctx.lineTo(x + w, y);
  ctx.stroke();

  // Outer shadow (bottom, right)
  ctx.strokeStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  ctx.stroke();

  // Inner light
  ctx.strokeStyle = mid;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + h - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + 1);
  ctx.stroke();

  // Inner shadow
  ctx.strokeStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + w - 1, y + 1); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x + 1, y + h - 1);
  ctx.stroke();
}

/** Draw a Win95-style button */
function drawButton(ctx, x, y, w, h, label) {
  ctx.fillStyle = WIN_GRAY;
  ctx.fillRect(x, y, w, h);
  drawWin3dBorder(ctx, x, y, w, h, false);
  ctx.fillStyle = WIN_BLACK;
  ctx.font = 'bold 11px "MS Sans Serif", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Draw a classic Windows cursor arrow */
function drawCursor(ctx, x, y, scale) {
  scale = scale ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // White fill
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22);
  ctx.lineTo(4, 17);
  ctx.lineTo(7, 24);
  ctx.lineTo(9, 23);
  ctx.lineTo(6, 16);
  ctx.lineTo(12, 16);
  ctx.closePath();
  ctx.fillStyle = WIN_WHITE;
  ctx.fill();
  // Black outline
  ctx.strokeStyle = WIN_BLACK;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/** Draw a Win95 title bar (including minimize/maximize/close buttons) */
function drawTitleBar(ctx, x, y, w, title) {
  const TH = 18;

  // Title bar background (navy gradient-like flat)
  ctx.fillStyle = WIN_NAVY;
  ctx.fillRect(x + 2, y + 2, w - 4, TH);

  // Title text
  ctx.fillStyle = WIN_WHITE;
  ctx.font = 'bold 11px "MS Sans Serif", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + 6, y + 2 + TH / 2);
  ctx.textBaseline = 'alphabetic';

  // Buttons: [_] [□] [X]
  const btnSize = 14;
  const btnY = y + 4;
  const btnX3 = x + w - 4 - btnSize;
  const btnX2 = btnX3 - btnSize - 2;
  const btnX1 = btnX2 - btnSize - 2;

  for (const bx of [btnX1, btnX2, btnX3]) {
    ctx.fillStyle = WIN_GRAY;
    ctx.fillRect(bx, btnY, btnSize, btnSize);
    drawWin3dBorder(ctx, bx, btnY, btnSize, btnSize, false);
  }
  // [_] minimize
  ctx.strokeStyle = WIN_BLACK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(btnX1 + 3, btnY + btnSize - 4);
  ctx.lineTo(btnX1 + btnSize - 3, btnY + btnSize - 4);
  ctx.stroke();
  // [□] maximize
  ctx.strokeStyle = WIN_BLACK;
  ctx.lineWidth = 1;
  ctx.strokeRect(btnX2 + 3, btnY + 3, btnSize - 6, btnSize - 6);
  // [X] close
  ctx.strokeStyle = WIN_BLACK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(btnX3 + 3, btnY + 3);
  ctx.lineTo(btnX3 + btnSize - 3, btnY + btnSize - 3);
  ctx.moveTo(btnX3 + btnSize - 3, btnY + 3);
  ctx.lineTo(btnX3 + 3, btnY + btnSize - 3);
  ctx.stroke();
}

// ── Main class ────────────────────────────────────────────────────────────────

export class DesktopGlitch extends Algorithm {

  get metadata() {
    return {
      name: 'Desktop Glitch',
      eq:   'win32 × error',
      cat:  'Data Art',
      desc: 'Windows XP/95 glitch — cursor arrows, error dialogs, context menus, selection rects, scanlines, image corruption.',
    };
  }

  get params() {
    return [
      { id: 'dg_cursors',   label: 'Cursors',    min: 0,  max: 30,  step: 1,    default: 8   },
      { id: 'dg_windows',   label: 'Windows',    min: 0,  max: 15,  step: 1,    default: 5   },
      { id: 'dg_glitch',    label: 'Glitch',     min: 0,  max: 1,   step: 0.05, default: 0.4 },
      { id: 'dg_selection', label: 'Selection',  min: 0,  max: 1,   step: 0.05, default: 0.5 },
      { id: 'dg_scanlines', label: 'Scanlines',  min: 0,  max: 1,   step: 0.05, default: 0.3 },
      { id: 'dg_seed',      label: 'Seed',       min: 0,  max: 100, step: 1,    default: 42  },
    ];
  }

  get detailParam() {
    return { id: 'dg_windows', min: 0, max: 15, step: 1 };
  }

  animate(world) {}

  render(ctx, world) {
    const { W, H, state: s } = world;

    const nCursors  = Math.round(clamp(s.dg_cursors   ?? 8,   0,  30));
    const nWindows  = Math.round(clamp(s.dg_windows   ?? 5,   0,  15));
    const glitch    = clamp(s.dg_glitch    ?? 0.4,  0,   1);
    const selection = clamp(s.dg_selection ?? 0.5,  0,   1);
    const scanlines = clamp(s.dg_scanlines ?? 0.3,  0,   1);
    const seed      = Math.round(clamp(s.dg_seed ?? 42, 0, 100));

    const rng = makeLCG(seed * 5381 + 12345);

    ctx.save();

    // Very light dark wash (10%)
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // ── 1. Image glitch — horizontal strip displacement ────────────────────────
    if (glitch > 0) {
      this._drawGlitch(ctx, W, H, glitch, rng);
    }

    // ── 2. Blue selection rectangles ──────────────────────────────────────────
    if (selection > 0) {
      this._drawSelections(ctx, W, H, selection, rng);
    }

    // ── 3. Error/context menu windows ─────────────────────────────────────────
    if (nWindows > 0) {
      this._drawWindows(ctx, W, H, nWindows, rng);
    }

    // ── 4. Cursor arrows ──────────────────────────────────────────────────────
    if (nCursors > 0) {
      this._drawCursors(ctx, W, H, nCursors, rng);
    }

    // ── 5. Eye/watermark texts ────────────────────────────────────────────────
    this._drawWatermarks(ctx, W, H, rng);

    // ── 6. Scanlines ──────────────────────────────────────────────────────────
    if (scanlines > 0) {
      this._drawScanlines(ctx, W, H, scanlines);
    }

    ctx.restore();
  }

  // ── Glitch strips ─────────────────────────────────────────────────────────

  _drawGlitch(ctx, W, H, glitch, rng) {
    const numStrips = Math.floor(glitch * 25) + 2;
    ctx.save();

    // Horizontal strip displacement
    for (let i = 0; i < numStrips; i++) {
      const stripH = 2 + Math.floor(rng() * 20 * glitch);
      const stripY = Math.floor(rng() * H);
      const offset = (rng() - 0.5) * glitch * 80;

      if (Math.abs(offset) < 1) continue;
      if (stripY + stripH > H) continue;

      try {
        ctx.drawImage(
          ctx.canvas,
          0, stripY, W, stripH,
          offset, stripY, W, stripH
        );
      } catch (e) { /* canvas may not be readable yet */ }
    }

    // RGB channel offset with 'screen' blend
    if (glitch > 0.3) {
      const shift = glitch * 8;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.08 * glitch;
      try {
        ctx.drawImage(ctx.canvas, shift, 0);
        ctx.drawImage(ctx.canvas, -shift * 0.5, shift * 0.3);
      } catch (e) { /* ignore */ }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ── Blue selection rectangles ────────────────────────────────────────────

  _drawSelections(ctx, W, H, selection, rng) {
    const count = Math.round(selection * 8) + 1;
    ctx.save();
    ctx.setLineDash([3, 3]);

    for (let i = 0; i < count; i++) {
      const x = rng() * W * 0.8;
      const y = rng() * H * 0.8;
      const w = 40 + rng() * 200;
      const h = 30 + rng() * 150;

      // Semi-transparent blue fill
      ctx.fillStyle = 'rgba(0, 78, 215, 0.25)';
      ctx.fillRect(x, y, w, h);

      // Dotted blue border
      ctx.strokeStyle = 'rgba(0, 78, 215, 0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Windows / dialog boxes ────────────────────────────────────────────────

  _drawWindows(ctx, W, H, nWindows, rng) {
    for (let i = 0; i < nWindows; i++) {
      const type = rng() < 0.5 ? 'error' : 'context';

      if (type === 'error') {
        this._drawErrorDialog(ctx, W, H, rng);
      } else {
        this._drawContextMenu(ctx, W, H, rng);
      }
    }
  }

  _drawErrorDialog(ctx, W, H, rng) {
    const dw = 280 + Math.floor(rng() * 80);
    const msg = pickFrom(ERROR_MESSAGES, rng);
    const lines = msg.split('\n');
    const lineH = 14;
    const bodyH = 20 + lines.length * lineH + 50;
    const dh = 22 + bodyH; // title bar + body

    const x = Math.floor(rng() * Math.max(1, W - dw));
    const y = Math.floor(rng() * Math.max(1, H - dh));
    const title = pickFrom(WINDOW_TITLES, rng);

    ctx.save();

    // Window background
    ctx.fillStyle = WIN_GRAY;
    ctx.fillRect(x, y, dw, dh);
    drawWin3dBorder(ctx, x, y, dw, dh, false);

    // Title bar
    drawTitleBar(ctx, x, y, dw, title);

    // Body area
    const bodyY = y + 22;

    // Red circle X icon
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.arc(x + 24, bodyY + 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WIN_WHITE;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', x + 24, bodyY + 20);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Message text
    ctx.fillStyle = WIN_BLACK;
    ctx.font = '11px "MS Sans Serif", sans-serif';
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], x + 44, bodyY + 12 + li * lineH);
    }

    // Buttons
    const btnW = 70;
    const btnH = 22;
    const btnY2 = y + dh - btnH - 8;
    const midX = x + dw / 2;
    drawButton(ctx, midX - btnW - 6, btnY2, btnW, btnH, 'Continue');
    drawButton(ctx, midX + 6, btnY2, btnW, btnH, 'Stop');

    ctx.restore();
  }

  _drawContextMenu(ctx, W, H, rng) {
    const itemH = 18;
    const items = [];
    // Pick 4–8 items
    const count = 4 + Math.floor(rng() * 5);
    const shuffled = [...CONTEXT_ITEMS].sort(() => rng() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      items.push(shuffled[i]);
    }

    const menuW = 170;
    const menuH = items.length * itemH + 4;

    const x = Math.floor(rng() * Math.max(1, W - menuW));
    const y = Math.floor(rng() * Math.max(1, H - menuH));

    ctx.save();

    // White background
    ctx.fillStyle = WIN_WHITE;
    ctx.fillRect(x, y, menuW, menuH);
    drawWin3dBorder(ctx, x, y, menuW, menuH, false);

    // One highlighted item in blue
    const hlIdx = Math.floor(rng() * items.length);

    ctx.font = '11px "MS Sans Serif", sans-serif';
    for (let i = 0; i < items.length; i++) {
      const iy = y + 2 + i * itemH;

      if (i === hlIdx) {
        ctx.fillStyle = '#000080';
        ctx.fillRect(x + 2, iy, menuW - 4, itemH);
        ctx.fillStyle = WIN_WHITE;
      } else {
        ctx.fillStyle = WIN_BLACK;
      }
      ctx.fillText(items[i], x + 8, iy + 13);
    }

    ctx.restore();
  }

  // ── Cursor arrows ─────────────────────────────────────────────────────────

  _drawCursors(ctx, W, H, nCursors, rng) {
    ctx.save();

    // Some cursors scattered randomly, some in an arc/trail
    const doArc = nCursors > 4 && rng() < 0.6;

    if (doArc) {
      // Trail of cursors in a curve
      const arcCount = Math.min(nCursors, Math.floor(nCursors * 0.6));
      const cx = rng() * W;
      const cy = rng() * H;
      const radius = 60 + rng() * 120;
      const startAngle = rng() * Math.PI * 2;
      const sweep = (rng() * 0.8 + 0.2) * Math.PI;

      for (let i = 0; i < arcCount; i++) {
        const t = i / Math.max(arcCount - 1, 1);
        const angle = startAngle + t * sweep;
        const px = cx + Math.cos(angle) * radius * (1 + t * 0.5);
        const py = cy + Math.sin(angle) * radius * (1 + t * 0.3);
        const scale = 0.6 + t * 0.6;
        drawCursor(ctx, px, py, scale);
      }

      // Remaining cursors scattered
      for (let i = arcCount; i < nCursors; i++) {
        drawCursor(ctx, rng() * W, rng() * H, 0.7 + rng() * 0.8);
      }
    } else {
      // All scattered
      for (let i = 0; i < nCursors; i++) {
        const scale = 0.6 + rng() * 1.0;
        drawCursor(ctx, rng() * W, rng() * H, scale);
      }
    }

    ctx.restore();
  }

  // ── Watermarks ────────────────────────────────────────────────────────────

  _drawWatermarks(ctx, W, H, rng) {
    const count = 2 + Math.floor(rng() * 4);
    ctx.save();
    ctx.font = 'bold 10px monospace';

    for (let i = 0; i < count; i++) {
      const text = pickFrom(EYE_TEXTS, rng);
      const x = rng() * W;
      const y = rng() * H;
      const alpha = 0.15 + rng() * 0.25;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = WIN_WHITE;
      ctx.fillText(text, x, y);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Scanlines ─────────────────────────────────────────────────────────────

  _drawScanlines(ctx, W, H, scanlines) {
    ctx.save();
    ctx.globalAlpha = scanlines * 0.18;
    ctx.fillStyle = '#000000';
    for (let y = 0; y < H; y += 2) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  randomize(state, set) {
    set('dg_cursors',   Math.round(Math.random() * 30));
    set('dg_windows',   Math.round(Math.random() * 15));
    set('dg_glitch',    parseFloat((Math.random()).toFixed(2)));
    set('dg_selection', parseFloat((Math.random()).toFixed(2)));
    set('dg_scanlines', parseFloat((Math.random()).toFixed(2)));
    set('dg_seed',      Math.round(Math.random() * 100));
  }
}
