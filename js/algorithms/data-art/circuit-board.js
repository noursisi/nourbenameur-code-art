/**
 * Circuit Board — Dense pixel-art tech collage.
 * Packs dozens of different micro-visualizations into a grid:
 * bar charts, pie charts, knobs, dot matrices, waveforms, tables,
 * circuit traces, pixel art, buttons, sliders, globe, LED displays.
 * Monochrome. Every pixel filled. No gaps.
 */

import { Algorithm } from '../base.js';

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xFFFFFFFF; };
}
function pick(a, r) { return a[Math.floor(r() * a.length)]; }
function lerp(a, b, t) { return a + (b - a) * t; }

// ── Widget drawing functions ─────────────────────────────────────────────────
// Each takes (ctx, x, y, w, h, rng, fg, dim) and fills its rectangle completely.

function drawBarChart(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y, w, h);
  const bars = Math.max(3, Math.floor(w / 4));
  const bw = Math.floor(w / bars);
  const pad = 1;
  // Axes
  ctx.strokeStyle = dim;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + 2, y + h - 2);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.stroke();
  for (let i = 0; i < bars; i++) {
    const bh = Math.floor(rng() * (h - 8)) + 2;
    ctx.fillStyle = rng() < 0.2 ? fg : dim;
    ctx.fillRect(x + 3 + i * bw + pad, y + h - 2 - bh, bw - pad * 2, bh);
  }
}

function drawLineGraph(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  // Grid
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.3;
  for (let gx = x; gx < x + w; gx += Math.max(6, w / 8)) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += Math.max(6, h / 6)) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  // Line
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const pts = Math.max(5, Math.floor(w / 3));
  for (let i = 0; i <= pts; i++) {
    const px = x + (i / pts) * w;
    const py = y + h * 0.2 + rng() * h * 0.6;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawPieChart(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 3;
  let angle = -Math.PI / 2;
  const segs = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < segs; i++) {
    const sweep = (rng() * 0.4 + 0.05) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? fg : `rgba(255,255,255,${0.1 + rng() * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    angle += sweep;
  }
}

function drawDotMatrix(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#080808';
  ctx.fillRect(x, y, w, h);
  const sp = Math.max(2, Math.floor(Math.min(w, h) / 12));
  const cols = Math.floor(w / sp);
  const rows = Math.floor(h / sp);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = rng() < 0.4;
      ctx.fillStyle = on ? (rng() < 0.1 ? fg : dim) : '#111';
      const dr = Math.max(1, sp * 0.35);
      ctx.beginPath();
      ctx.arc(x + c * sp + sp / 2, y + r * sp + sp / 2, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawKnob(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 4;
  // Outer ring
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = dim; ctx.lineWidth = 1.5; ctx.stroke();
  // Tick marks
  const ticks = 8 + Math.floor(rng() * 8);
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
    ctx.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // Inner circle
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a'; ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5; ctx.stroke();
  // Pointer
  const pa = rng() * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(pa) * r * 0.55, cy + Math.sin(pa) * r * 0.55);
  ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawWaveform(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#080808';
  ctx.fillRect(x, y, w, h);
  // Center line
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  // Wave
  ctx.strokeStyle = fg; ctx.lineWidth = 0.8;
  ctx.beginPath();
  const freq = 2 + rng() * 8;
  const amp = h * 0.3 + rng() * h * 0.15;
  for (let i = 0; i <= w; i++) {
    const v = Math.sin(i / w * Math.PI * freq + rng() * 0.3) * amp;
    const py = y + h / 2 + v;
    i === 0 ? ctx.moveTo(x + i, py) : ctx.lineTo(x + i, py);
  }
  ctx.stroke();
}

function drawTextBlock(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  const texts = ['SYSTEM OK', 'ERR 0x42', 'MEM: 64K', 'CPU: 87%', 'DISK: 94%',
    'NET: 12Mb', 'CACHE HIT', 'PID 2847', 'ROOT', 'STDIN', 'STDOUT', '/dev/null',
    'chmod 755', 'grep -r', 'sudo rm', 'ping 8.8', 'ssh root@', 'tar -xvf',
    'NODE_ENV', 'PORT 443', 'HTTP 200', 'TCP/IP', 'FTP 21', 'DNS OK',
    'BIOS v3.2', 'IRQ 7', 'DMA CH2', 'I/O 0x3F8', 'INT 21h', 'MOV AX,BX'];
  const fs = Math.max(4, Math.min(7, Math.floor(h / 8)));
  ctx.font = `${fs}px monospace`;
  ctx.textBaseline = 'top';
  const lineH = fs + 1;
  const lines = Math.floor(h / lineH);
  for (let i = 0; i < lines; i++) {
    ctx.fillStyle = rng() < 0.15 ? fg : `rgba(255,255,255,${0.1 + rng() * 0.2})`;
    ctx.fillText(pick(texts, rng), x + 2, y + 1 + i * lineH);
  }
}

function drawHeatmap(ctx, x, y, w, h, rng, fg, dim) {
  const cellSz = Math.max(2, Math.floor(Math.min(w, h) / 10));
  const cols = Math.floor(w / cellSz);
  const rows = Math.floor(h / cellSz);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = rng();
      const b = Math.floor(v * 80);
      ctx.fillStyle = `rgb(${b},${b},${b})`;
      ctx.fillRect(x + c * cellSz, y + r * cellSz, cellSz - 0.5, cellSz - 0.5);
    }
  }
}

function drawProgressBars(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  const barH = Math.max(3, Math.floor(h / 8));
  const bars = Math.floor(h / (barH + 2));
  for (let i = 0; i < bars; i++) {
    const by = y + 2 + i * (barH + 2);
    const fill = rng();
    ctx.fillStyle = '#151515';
    ctx.fillRect(x + 2, by, w - 4, barH);
    ctx.fillStyle = fill > 0.8 ? fg : dim;
    ctx.fillRect(x + 2, by, (w - 4) * fill, barH);
  }
}

function drawCircuitTrace(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#080808';
  ctx.fillRect(x, y, w, h);
  const count = 5 + Math.floor(rng() * 10);
  for (let i = 0; i < count; i++) {
    let tx = x + rng() * w, ty = y + rng() * h;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    const segs = 2 + Math.floor(rng() * 5);
    let dir = rng() < 0.5 ? 0 : 1;
    for (let s = 0; s < segs; s++) {
      const len = 5 + rng() * Math.max(w, h) * 0.4;
      if (dir === 0) tx = Math.max(x, Math.min(x + w, tx + (rng() < 0.5 ? len : -len)));
      else ty = Math.max(y, Math.min(y + h, ty + (rng() < 0.5 ? len : -len)));
      ctx.lineTo(tx, ty);
      dir = 1 - dir;
    }
    ctx.strokeStyle = rng() < 0.3 ? fg : dim;
    ctx.lineWidth = rng() < 0.2 ? 1.5 : 0.5;
    ctx.stroke();
    // Pad at end
    ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = dim; ctx.fill();
  }
}

function drawGlobe(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#050505';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 3;
  // Outer circle
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = dim; ctx.lineWidth = 1; ctx.stroke();
  // Latitude lines
  for (let i = 1; i < 5; i++) {
    const ly = r * (i / 5 * 2 - 1);
    const lr = Math.sqrt(r * r - ly * ly);
    ctx.beginPath(); ctx.ellipse(cx, cy + ly, lr, lr * 0.15, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // Longitude lines
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * Math.abs(Math.cos(a)), r, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // Random "land" dots
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * r * 0.9;
    const dx = cx + Math.cos(a) * d;
    const dy = cy + Math.sin(a) * d * 0.8;
    if (rng() < 0.5) { ctx.fillStyle = dim; ctx.fillRect(dx, dy, 1, 1); }
  }
}

function drawSliders(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  const count = Math.max(2, Math.floor(w / 8));
  const sp = w / count;
  for (let i = 0; i < count; i++) {
    const sx = x + i * sp + sp / 2;
    const trackTop = y + 3;
    const trackBot = y + h - 3;
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, trackTop); ctx.lineTo(sx, trackBot); ctx.stroke();
    const val = rng();
    const handleY = trackTop + (trackBot - trackTop) * (1 - val);
    ctx.fillStyle = fg;
    ctx.fillRect(sx - 2, handleY - 1, 4, 3);
  }
}

function drawLEDNumber(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#050505';
  ctx.fillRect(x, y, w, h);
  const num = String(Math.floor(rng() * 10000)).padStart(4, '0');
  const digitW = Math.floor(w / 5);
  const fs = Math.max(6, Math.min(digitW * 1.5, h - 4));
  ctx.font = `bold ${fs}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === 0 && rng() < 0.3 ? '#330000' : (rng() < 0.15 ? fg : `rgba(255,255,255,${0.3 + rng() * 0.4})`);
    ctx.fillText(num[i], x + digitW / 2 + i * digitW + digitW / 2, y + h / 2);
  }
}

function drawButtonRow(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(x, y, w, h);
  const labels = ['OK', 'SET', 'RST', 'RUN', 'CLR', 'SND', 'RCV', 'PWR', 'HLT', 'ACK', 'NAK', 'BRK'];
  const bw = Math.max(14, Math.floor(w / 4));
  const bh = Math.max(8, Math.floor(h / 3));
  const cols = Math.floor((w - 4) / (bw + 2));
  const rows = Math.floor((h - 4) / (bh + 2));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = x + 2 + c * (bw + 2);
      const by = y + 2 + r * (bh + 2);
      const active = rng() < 0.2;
      ctx.fillStyle = active ? '#333' : '#1a1a1a';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, bw, bh);
      if (bw > 10 && bh > 6) {
        ctx.font = `${Math.min(6, bh - 2)}px monospace`;
        ctx.fillStyle = active ? fg : dim;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pick(labels, rng), bx + bw / 2, by + bh / 2);
      }
    }
  }
}

function drawTable(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  const cols = Math.max(2, Math.floor(w / 20));
  const rows = Math.max(2, Math.floor(h / 8));
  const cw = w / cols;
  const rh = h / rows;
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(x + c * cw, y); ctx.lineTo(x + c * cw, y + h); ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(x, y + r * rh); ctx.lineTo(x + w, y + r * rh); ctx.stroke();
  }
  // Header row
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, w, rh);
  // Cell content
  ctx.font = `${Math.max(3, Math.min(5, rh - 2))}px monospace`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = r === 0 ? fg : (rng() < 0.1 ? fg : `rgba(255,255,255,${0.08 + rng() * 0.15})`);
      const val = r === 0 ? String.fromCharCode(65 + c) : (rng() < 0.3 ? String(Math.floor(rng() * 100)) : '');
      ctx.fillText(val, x + c * cw + cw / 2, y + r * rh + rh / 2);
    }
  }
}

function drawPixelArt(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#080808';
  ctx.fillRect(x, y, w, h);
  const px = Math.max(2, Math.floor(Math.min(w, h) / 12));
  const cols = Math.floor(w / px);
  const rows = Math.floor(h / px);
  // Generate symmetric pixel art (mirror left to right)
  const halfCols = Math.ceil(cols / 2);
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < halfCols; c++) {
      grid[r][c] = rng() < 0.35 ? 1 : 0;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mirrorC = c < halfCols ? c : cols - 1 - c;
      if (grid[r][mirrorC]) {
        ctx.fillStyle = fg;
        ctx.fillRect(x + c * px, y + r * px, px - 0.5, px - 0.5);
      }
    }
  }
}

function drawRadar(ctx, x, y, w, h, rng, fg, dim) {
  ctx.fillStyle = '#050505';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 3;
  // Concentric rings
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath(); ctx.arc(cx, cy, r * i / 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // Cross
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5; ctx.stroke();
  // Sweep line
  const sweepAngle = rng() * Math.PI * 2;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
  ctx.strokeStyle = fg; ctx.lineWidth = 0.8; ctx.stroke();
  // Blips
  for (let i = 0; i < 5; i++) {
    const ba = rng() * Math.PI * 2;
    const bd = rng() * r;
    ctx.fillStyle = fg;
    ctx.fillRect(cx + Math.cos(ba) * bd - 0.5, cy + Math.sin(ba) * bd - 0.5, 2, 2);
  }
}

// Widget list
const WIDGETS = [
  drawBarChart, drawLineGraph, drawPieChart, drawDotMatrix, drawKnob,
  drawWaveform, drawTextBlock, drawHeatmap, drawProgressBars, drawCircuitTrace,
  drawGlobe, drawSliders, drawLEDNumber, drawButtonRow, drawTable,
  drawPixelArt, drawRadar,
];

// ── BSP tree packing ─────────────────────────────────────────────────────────

function bspSplit(x, y, w, h, depth, maxDepth, rng, cells) {
  if (depth >= maxDepth || (w < 20 && h < 20)) {
    cells.push({ x, y, w, h });
    return;
  }
  // Decide split direction based on aspect ratio
  const splitH = w > h ? (rng() < 0.7) : (rng() < 0.3);
  if (splitH) {
    const split = Math.floor(w * (0.25 + rng() * 0.5));
    if (split < 15 || w - split < 15) { cells.push({ x, y, w, h }); return; }
    bspSplit(x, y, split, h, depth + 1, maxDepth, rng, cells);
    bspSplit(x + split, y, w - split, h, depth + 1, maxDepth, rng, cells);
  } else {
    const split = Math.floor(h * (0.25 + rng() * 0.5));
    if (split < 15 || h - split < 15) { cells.push({ x, y, w, h }); return; }
    bspSplit(x, y, w, split, depth + 1, maxDepth, rng, cells);
    bspSplit(x, y + split, w, h - split, depth + 1, maxDepth, rng, cells);
  }
}

// ── Algorithm class ──────────────────────────────────────────────────────────

export class CircuitBoard extends Algorithm {
  constructor(engine) {
    super(engine);
    this._cache = null;
    this._cacheKey = '';
  }

  get metadata() {
    return {
      name: 'Circuit Board',
      eq: 'data × grid',
      cat: 'Data Art',
      desc: 'Dense tech collage — dozens of micro-visualizations packed together. Bar charts, knobs, circuits, dot matrices, pixel art.',
    };
  }

  get params() {
    return [
      { id: 'pcb_scale',   label: 'Scale',    min: 0.5, max: 3,   step: 0.1  },
      { id: 'pcb_density', label: 'Density',   min: 0.2, max: 1,   step: 0.05 },
      { id: 'pcb_layers',  label: 'Depth',     min: 3,   max: 8,   step: 1    },
      { id: 'pcb_shine',   label: 'Bright',    min: 0,   max: 1,   step: 0.05 },
      { id: 'pcb_light',   label: 'Unused',    min: 0,   max: 6.28,step: 0.1  },
      { id: 'pcb_warmth',  label: 'Seed',      min: 0,   max: 100, step: 1    },
    ];
  }

  get detailParam() { return { id: 'pcb_density', min: 0.2, max: 1, step: 0.05 }; }

  animate() {}

  randomize(state, set) {
    set('pcb_scale',   parseFloat((0.6 + Math.random() * 2).toFixed(1)));
    set('pcb_density', parseFloat((0.3 + Math.random() * 0.65).toFixed(2)));
    set('pcb_layers',  Math.floor(3 + Math.random() * 5));
    set('pcb_shine',   parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('pcb_warmth',  Math.floor(Math.random() * 100));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const density = s.pcb_density ?? 0.6;
    const depth = Math.round(s.pcb_layers ?? 5);
    const bright = s.pcb_shine ?? 0.7;
    const seed = Math.round(s.pcb_warmth ?? 42);
    const scale = s.pcb_scale ?? 1;

    const key = `${seed}-${depth}-${Math.round(W)}-${Math.round(H)}-${Math.round(density*100)}-${Math.round(bright*100)}`;
    if (this._cache && this._cacheKey === key) {
      ctx.drawImage(this._cache, 0, 0, W, H);
      return;
    }

    const rng = makeLCG(seed * 7919 + 31337);

    const fg = `rgba(255,255,255,${0.5 + bright * 0.5})`;
    const dim = `rgba(255,255,255,${0.15 + bright * 0.15})`;

    // Black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // BSP split canvas into cells
    const cells = [];
    bspSplit(0, 0, W, H, 0, depth, rng, cells);

    // Draw a widget in each cell
    for (const cell of cells) {
      const widget = WIDGETS[Math.floor(rng() * WIDGETS.length)];
      widget(ctx, cell.x, cell.y, cell.w, cell.h, rng, fg, dim);
      // Thin border
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
    }

    // Subtle scanlines over everything
    ctx.globalAlpha = 0.03;
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;

    // Cache
    const cache = document.createElement('canvas');
    cache.width = ctx.canvas.width;
    cache.height = ctx.canvas.height;
    cache.getContext('2d').drawImage(ctx.canvas, 0, 0);
    this._cache = cache;
    this._cacheKey = key;
  }

  collectSVG() { return null; }
}
