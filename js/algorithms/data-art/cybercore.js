/**
 * Cybercore — Y2K/cybercore/techcore collage compositions.
 * Generates hacker-desktop, surveillance-system, and late-90s terminal aesthetics
 * using seeded layouts, fake UI windows, circuit traces, and glitch artifacts.
 * Works with an uploaded image as base layer, or standalone.
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

// ── Tech string pools ─────────────────────────────────────────────────────────

const WINDOW_TITLES = [
  'SYSTEM_CORE.dll', 'NEURAL_MAP v2.1', '0x7F3A::MONITOR',
  'DATA_STREAM_04',  'PROXY_CHAIN::OK', 'SCAN COMPLETE',
  'ERR::0x0042',     'BUFFER_OVERFLOW', 'TRACE_ROUTE',
  'NET_DAEMON v4',   'SYS.PROC::LIVE',  'KERNEL_LOG_03',
  'PACKET_SNIFFER',  'CRYPTO_INIT::OK', 'WATCHDOG::RUN',
  'UPLINK_SECURED',  'FIREWALL_ACTIVE', 'REBOOT_PENDING',
];

const WINDOW_SUBTITLES = [
  'PID 2847 :: ACTIVE', 'HEAP: 0xC0DEBEEF', 'CHECKSUM OK',
  'PORT 8080 LISTEN',   'AES-256 ENGAGED',  'LATENCY 12ms',
  'THREAD COUNT: 48',   'SIGNAL LOCKED',    'SYNC IN PROGRESS',
];

const READOUT_POOL = [
  '0xAF3B', '0x001C', '0xFF00', '0xDEAD', '0xBEEF', '0xC0DE',
  '0x4F3A', '0x7E2B', '0xFF3C', '0x1A4D',
  'LAT 48.8566 LON 2.3522', 'LAT 35.6762 LON 139.6503',
  'NODE_127.0.0.1', 'NODE_10.0.0.255',
  'CONNECTED', 'DECRYPTING...', 'ACCESS GRANTED', 'AUTH FAILED',
  'CPU 87%', 'MEM 64%', 'NET 12Mbps', 'DISK 94%',
  'TX 4.2KB/s', 'RX 18.7KB/s', 'PING 8ms', 'LOSS 0%',
  '2026.04.08 19:41:33', '2026.01.01 00:00:01',
  'THREAD DUMP...', 'GC PAUSED', 'STACK DEPTH: 12', 'CACHE MISS',
  'PROXY 195.43.12.8', 'TOR EXIT NODE', 'ROUTE HOP 7',
  'ENTROPY: HIGH', 'NOISE FLOOR -94dBm', 'SIGNAL 5/5',
];

const CONTENT_LABELS = [
  'INCOMING', 'OUTGOING', 'QUEUED', 'DROPPED',
  'BYTES_IN', 'BYTES_OUT', 'ERRORS', 'STATUS',
  'TEMP', 'VOLTAGE', 'AMPERE', 'WATT',
];

// ── Color palette ─────────────────────────────────────────────────────────────

const NEON_COLORS = [
  '#00ffff', '#00ccff', '#00ff00', '#00cc44',
  '#0066ff', '#33ffcc', '#66ff00', '#00ffaa',
];
const WARN_COLORS  = ['#ff0033', '#ff6600', '#ffcc00'];
const BG_DARK      = '#050810';
const BG_PANEL     = '#090d1a';
const BG_TITLEBAR  = '#0d1424';
const BORDER_CYAN  = '#1a4060';
const BORDER_BRIGHT = '#0f3050';

function neonPick(rng, warnChance = 0.08) {
  if (rng() < warnChance) return WARN_COLORS[Math.floor(rng() * WARN_COLORS.length)];
  return NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)];
}

function hexAlpha(hex, a) {
  // Returns hex color with explicit globalAlpha set externally; returns the hex string.
  return hex;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function pickFrom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Main class ────────────────────────────────────────────────────────────────

export class Cybercore extends Algorithm {

  get metadata() {
    return {
      name: 'Cybercore',
      eq:   'y2k × data',
      cat:  'Data Art',
      desc: 'Y2K / techcore collage — fake UI windows, circuit traces, glitch bars, and data readouts compose a late-90s hacker desktop.',
    };
  }

  get params() {
    return [
      { id: 'cyber_windows',  label: 'Windows',  min: 0,    max: 12,  step: 1,    default: 5    },
      { id: 'cyber_circuits', label: 'Circuits', min: 0,    max: 20,  step: 1,    default: 10   },
      { id: 'cyber_scanlines',label: 'Scanlines',min: 0,    max: 1,   step: 0.05, default: 0.45 },
      { id: 'cyber_text',     label: 'Text',     min: 0,    max: 1,   step: 0.05, default: 0.6  },
      { id: 'cyber_grid',     label: 'Grid',     min: 0,    max: 0.5, step: 0.02, default: 0.1  },
      { id: 'cyber_glitch',   label: 'Glitch',   min: 0,    max: 10,  step: 1,    default: 3    },
      { id: 'cyber_thumbs',   label: 'Thumbs',   min: 0,    max: 1,   step: 1,    default: 1    },
      { id: 'cyber_tint',     label: 'Tint',     min: 0,    max: 1,   step: 0.05, default: 0.35 },
      { id: 'cyber_seed',     label: 'Seed',     min: 0,    max: 100, step: 1,    default: 42   },
    ];
  }

  get detailParam() {
    return { id: 'cyber_circuits', min: 0, max: 20, step: 1 };
  }

  // ── Animate ────────────────────────────────────────────────────────────────

  animate(world) {
    // Time advances from the engine render loop — we use world.state.time.
    // No layout changes here; scanline offset and blink state are derived from time.
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render(ctx, world) {
    const { W, H, state: s } = world;

    const nWindows  = Math.round(clamp(s.cyber_windows  ?? 5,    0,  12));
    const nCircuits = Math.round(clamp(s.cyber_circuits ?? 10,   0,  20));
    const scanlines = clamp(s.cyber_scanlines ?? 0.45, 0, 1);
    const textDens  = clamp(s.cyber_text      ?? 0.6,  0, 1);
    const gridOp    = clamp(s.cyber_grid      ?? 0.1,  0, 0.5);
    const nGlitch   = Math.round(clamp(s.cyber_glitch  ?? 3,    0,  10));
    const thumbs    = Math.round(clamp(s.cyber_thumbs  ?? 1,    0,  1));
    const tint      = clamp(s.cyber_tint      ?? 0.35, 0, 1);
    const seed      = Math.round(clamp(s.cyber_seed    ?? 42,   0,  100));
    const t         = s.time ?? 0;

    // Stable layout RNG (seed-based)
    const rng = makeLCG(seed * 7919 + 31337);

    ctx.save();

    // ── 1. Dark base fill (only if no image loaded as background) ─────────────
    // We do a semi-transparent wash so image behind shows through, but we still
    // add enough darkness to sell the aesthetic.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = BG_DARK;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // ── 2. Grid Overlay ────────────────────────────────────────────────────────
    if (gridOp > 0) {
      this._drawGrid(ctx, W, H, gridOp, rng);
    }

    // ── 3. Circuit Traces ──────────────────────────────────────────────────────
    if (nCircuits > 0) {
      this._drawCircuits(ctx, W, H, nCircuits, rng, t);
    }

    // ── 4. Tech Text Readouts ──────────────────────────────────────────────────
    if (textDens > 0) {
      this._drawTextReadouts(ctx, W, H, textDens, rng, t);
    }

    // ── 5. Fake UI Windows ─────────────────────────────────────────────────────
    if (nWindows > 0) {
      this._drawWindows(ctx, W, H, nWindows, rng, t);
    }

    // ── 6. Thumbnail Strip ─────────────────────────────────────────────────────
    if (thumbs > 0) {
      this._drawThumbnails(ctx, W, H, rng, t);
    }

    // ── 7. Scanlines ───────────────────────────────────────────────────────────
    if (scanlines > 0) {
      this._drawScanlines(ctx, W, H, scanlines, t);
    }

    // ── 8. Glitch Bars ─────────────────────────────────────────────────────────
    if (nGlitch > 0) {
      this._drawGlitch(ctx, W, H, nGlitch, rng, t);
    }

    // ── 9. Color Tint ──────────────────────────────────────────────────────────
    if (tint > 0) {
      this._drawTint(ctx, W, H, tint);
    }

    // ── 10. Corner HUD decorations ─────────────────────────────────────────────
    this._drawCornerHUD(ctx, W, H, t);

    ctx.restore();
  }

  // ── Internal draw methods ──────────────────────────────────────────────────

  _drawGrid(ctx, W, H, opacity, rng) {
    const cellW = Math.floor(lerp(20, 60, rng()));
    const cellH = cellW;

    ctx.save();
    ctx.strokeStyle = '#0a2030';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = opacity;

    // Vertical lines
    for (let x = 0; x <= W; x += cellW) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    // Horizontal lines
    for (let y = 0; y <= H; y += cellH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Occasional brighter dot at intersections
    ctx.fillStyle = '#00ccff';
    ctx.globalAlpha = opacity * 0.6;
    for (let x = 0; x <= W; x += cellW) {
      for (let y = 0; y <= H; y += cellH) {
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
    ctx.restore();
  }

  _drawCircuits(ctx, W, H, count, rng, t) {
    ctx.save();
    ctx.lineCap = 'square';

    for (let i = 0; i < count; i++) {
      const color  = neonPick(rng, 0.06);
      const bright = rng() < 0.25; // some traces are brighter/thicker
      const lw     = bright ? 1.5 : 0.8;
      const alpha  = bright ? 0.9 : lerp(0.3, 0.65, rng());

      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      ctx.lineWidth   = lw;
      ctx.globalAlpha = alpha;

      // Starting point
      let x = Math.floor(rng() * W);
      let y = Math.floor(rng() * H);

      // Number of segments (each is a horizontal or vertical run)
      const segs = 3 + Math.floor(rng() * 6);
      let dir = rng() < 0.5 ? 0 : 1; // 0=horizontal, 1=vertical

      const points = [{ x, y }];

      for (let s = 0; s < segs; s++) {
        const len = 20 + Math.floor(rng() * (W * 0.25));
        if (dir === 0) {
          x += rng() < 0.5 ? len : -len;
          x = clamp(x, 2, W - 2);
        } else {
          y += rng() < 0.5 ? len : -len;
          y = clamp(y, 2, H - 2);
        }
        points.push({ x, y });
        dir = 1 - dir;
      }

      // Draw the trace
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let j = 1; j < points.length; j++) {
        ctx.lineTo(points[j].x, points[j].y);
      }
      ctx.stroke();

      // Dot at each turn point
      const dotR = lw + 1;
      for (const pt of points) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animated pulse dot travelling along the trace
      if (bright) {
        const speed   = 0.1 + rng() * 0.3;
        const phase   = rng() * Math.PI * 2;
        const progress = ((t * speed + phase) % 1 + 1) % 1;
        const idx     = progress * (points.length - 1);
        const segIdx  = Math.floor(idx);
        const segT    = idx - segIdx;
        if (segIdx < points.length - 1) {
          const pa = points[segIdx];
          const pb = points[segIdx + 1];
          const px = lerp(pa.x, pb.x, segT);
          const py = lerp(pa.y, pb.y, segT);
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(px, py, dotR + 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  _drawTextReadouts(ctx, W, H, density, rng, t) {
    const count = Math.round(density * 40) + 5;

    ctx.save();
    ctx.font = '9px monospace';
    ctx.textBaseline = 'top';

    for (let i = 0; i < count; i++) {
      const text  = pickFrom(READOUT_POOL, rng).toUpperCase();
      const color = rng() < 0.7 ? '#00ccff' : rng() < 0.5 ? '#00ff88' : '#0066ff';
      const alpha = lerp(0.2, 0.65, rng());

      // Place in margins and scattered zones
      let px, py;
      const zone = Math.floor(rng() * 4);
      switch (zone) {
        case 0: // left margin
          px = lerp(4, W * 0.18, rng());
          py = lerp(10, H - 10, rng());
          break;
        case 1: // right margin
          px = lerp(W * 0.82, W - 4, rng());
          py = lerp(10, H - 10, rng());
          break;
        case 2: // top strip
          px = lerp(4, W - 4, rng());
          py = lerp(4, H * 0.12, rng());
          break;
        case 3: // scattered mid
          px = lerp(W * 0.1, W * 0.9, rng());
          py = lerp(H * 0.1, H * 0.9, rng());
          break;
      }

      // Blinking: some lines blink at different rates
      const blink = rng() < 0.2;
      if (blink) {
        const blinkRate = 0.5 + rng() * 1.5;
        const blinkPhase = rng() * Math.PI * 2;
        const bv = Math.sin(t * blinkRate + blinkPhase);
        if (bv < 0) continue; // skip when invisible
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillText(text, px, py);

      // Tiny prefix indicator
      if (rng() < 0.3) {
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = '#005533';
        ctx.fillText('>', px - 8, py);
      }
    }

    ctx.restore();
  }

  _drawWindows(ctx, W, H, count, rng, t) {
    // Margin so windows don't go off-screen
    const MARGIN = 10;
    const MIN_W  = 140;
    const MAX_W  = Math.min(320, W * 0.45);
    const MIN_H  = 80;
    const MAX_H  = Math.min(220, H * 0.35);
    const TITLE_H = 20;

    for (let i = 0; i < count; i++) {
      const ww = Math.floor(lerp(MIN_W, MAX_W, rng()));
      const wh = Math.floor(lerp(MIN_H, MAX_H, rng()));
      const wx = Math.floor(MARGIN + rng() * (W - ww - MARGIN * 2));
      const wy = Math.floor(MARGIN + rng() * (H - wh - MARGIN * 2));

      const title  = pickFrom(WINDOW_TITLES,    rng);
      const hasErr = rng() < 0.15;
      const borderColor = hasErr ? '#441010' : BORDER_CYAN;
      const titleBg     = hasErr ? '#1a0808' : BG_TITLEBAR;
      const bodyType    = Math.floor(rng() * 4); // 0=text, 1=grid-squares, 2=progress, 3=dark

      ctx.save();

      // Drop shadow
      ctx.shadowColor  = hasErr ? 'rgba(255,0,51,0.25)' : 'rgba(0,180,255,0.18)';
      ctx.shadowBlur   = 12;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;

      // Window border + body background
      ctx.fillStyle   = BG_PANEL;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1);
      ctx.shadowBlur = 0;

      // Title bar
      ctx.fillStyle   = titleBg;
      ctx.globalAlpha = 1;
      ctx.fillRect(wx, wy, ww, TITLE_H);

      // Title bar bottom border line
      ctx.strokeStyle = borderColor;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(wx, wy + TITLE_H);
      ctx.lineTo(wx + ww, wy + TITLE_H);
      ctx.stroke();

      // Window control buttons (right side of title bar)
      const btnY   = wy + TITLE_H / 2;
      const btnR   = 4;
      const btns   = [
        { x: wx + ww - 10, color: '#331010', border: '#662020' },
        { x: wx + ww - 22, color: '#1a2a10', border: '#2a4415' },
        { x: wx + ww - 34, color: '#10202a', border: '#154060' },
      ];
      for (const btn of btns) {
        ctx.fillStyle   = btn.color;
        ctx.strokeStyle = btn.border;
        ctx.lineWidth   = 0.5;
        ctx.fillRect(btn.x - btnR, btnY - btnR, btnR * 2, btnR * 2);
        ctx.strokeRect(btn.x - btnR, btnY - btnR, btnR * 2, btnR * 2);
      }

      // Title text
      ctx.font        = '8px monospace';
      ctx.fillStyle   = hasErr ? '#ff4444' : '#66ccff';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.95;
      // Clip title text to avoid overlapping buttons
      ctx.save();
      ctx.rect(wx + 4, wy, ww - 44, TITLE_H);
      ctx.clip();
      ctx.fillText(title, wx + 6, wy + TITLE_H / 2);
      ctx.restore();

      // Blinking active indicator dot in title bar
      const blinkOn = Math.sin(t * 1.5 + i * 0.8) > 0;
      ctx.fillStyle   = blinkOn ? '#00ff88' : '#003322';
      ctx.beginPath();
      ctx.arc(wx + ww - 46, btnY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Content area clip
      const contentY = wy + TITLE_H + 1;
      const contentH = wh - TITLE_H - 1;
      ctx.save();
      ctx.rect(wx + 1, contentY, ww - 2, contentH - 1);
      ctx.clip();

      switch (bodyType) {
        case 0: // scrolling text dump
          this._drawWindowText(ctx, wx, contentY, ww, contentH, rng, t, i);
          break;
        case 1: // colored grid of squares
          this._drawWindowGrid(ctx, wx, contentY, ww, contentH, rng);
          break;
        case 2: // progress bars
          this._drawWindowProgress(ctx, wx, contentY, ww, contentH, rng, t, i);
          break;
        case 3: // pure dark with scanline-like stripe
          this._drawWindowDark(ctx, wx, contentY, ww, contentH, rng, t);
          break;
      }

      ctx.restore(); // clip
      ctx.restore(); // window save
    }
  }

  _drawWindowText(ctx, wx, wy, ww, wh, rng, t, windowIdx) {
    ctx.font        = '8px monospace';
    ctx.textBaseline = 'top';
    const lineH = 10;
    const lines = Math.floor(wh / lineH);
    const scrollOffset = (t * 0.4 + windowIdx * 3.7) % lines;
    const startLine = Math.floor(scrollOffset);

    for (let i = 0; i < lines; i++) {
      const lineIdx = (startLine + i) % (READOUT_POOL.length);
      const text = READOUT_POOL[lineIdx % READOUT_POOL.length].toUpperCase();
      const alpha = lerp(0.15, 0.55, rng());
      const isHighlight = rng() < 0.08;
      ctx.fillStyle   = isHighlight ? '#ff4444' : rng() < 0.6 ? '#009955' : '#005533';
      ctx.globalAlpha = isHighlight ? 0.8 : alpha;
      ctx.fillText(text, wx + 5, wy + i * lineH + 3);
    }

    // Cursor blink on last visible line
    const cursorOn = Math.sin(t * 2) > 0;
    if (cursorOn) {
      ctx.fillStyle   = '#00ff88';
      ctx.globalAlpha = 0.9;
      ctx.fillText('_', wx + 5 + 3, wy + (lines - 1) * lineH + 3);
    }
  }

  _drawWindowGrid(ctx, wx, wy, ww, wh, rng) {
    const cols = Math.floor(lerp(6, 12, rng()));
    const rows = Math.floor(lerp(3, 7, rng()));
    const cw = (ww - 10) / cols;
    const ch = (wh - 10) / rows;
    const gapFrac = 0.15;
    const cellW = cw * (1 - gapFrac);
    const cellH = ch * (1 - gapFrac);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = wx + 5 + c * cw + cw * gapFrac / 2;
        const cy = wy + 5 + r * ch + ch * gapFrac / 2;
        const v = rng();
        const hue = rng() < 0.7 ? lerp(170, 220, rng()) : lerp(80, 140, rng()); // cyan/blue or green
        const lit = lerp(5, 35, v);
        ctx.fillStyle   = `hsl(${hue}, 80%, ${lit}%)`;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(cx, cy, cellW, cellH);
        // Bright border on active cells
        if (v > 0.7) {
          ctx.strokeStyle = `hsl(${hue}, 90%, 55%)`;
          ctx.lineWidth   = 0.5;
          ctx.globalAlpha = v * 0.8;
          ctx.strokeRect(cx, cy, cellW, cellH);
        }
      }
    }
  }

  _drawWindowProgress(ctx, wx, wy, ww, wh, rng, t, windowIdx) {
    ctx.font        = '7px monospace';
    ctx.textBaseline = 'top';
    const barCount = Math.floor(wh / 20);
    const barH     = 6;
    const barPad   = (wh - barCount * 18) / (barCount + 1);

    for (let i = 0; i < barCount; i++) {
      const label = pickFrom(CONTENT_LABELS, rng).toUpperCase();
      const speed  = 0.05 + rng() * 0.15;
      const phase  = rng() * Math.PI * 2;
      // Oscillate fill 0..1 with a slow sine for animation
      let fill = ((Math.sin(t * speed + phase + windowIdx) + 1) / 2) * 0.9 + 0.05;
      fill = clamp(fill, 0, 1);

      const barY  = wy + barPad + i * (barH + 12);
      const barX  = wx + 5;
      const barW  = ww - 10;

      const isHot = fill > 0.8;
      const color = isHot ? '#ff3300' : rng() < 0.6 ? '#00ccff' : '#00ff66';

      // Label
      ctx.fillStyle   = '#336655';
      ctx.globalAlpha = 0.7;
      ctx.fillText(label, barX, barY - 9);

      // Fill percentage
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.6;
      ctx.fillText(`${Math.round(fill * 100)}%`, barX + barW - 24, barY - 9);

      // Bar track
      ctx.fillStyle   = '#060e1a';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(barX, barY, barW, barH);

      // Bar fill
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(barX, barY, Math.floor(barW * fill), barH);

      // Bar border
      ctx.strokeStyle = isHot ? '#660000' : '#0a2030';
      ctx.lineWidth   = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  _drawWindowDark(ctx, wx, wy, ww, wh, rng, t) {
    // Almost pure dark with occasional horizontal scan sweep line
    ctx.fillStyle   = '#03070f';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(wx, wy, ww, wh);

    // Sweep line
    const sweepY = ((t * 0.5) % 1) * wh;
    ctx.fillStyle = '#00ffff';
    ctx.globalAlpha = 0.04;
    ctx.fillRect(wx, wy + sweepY, ww, 2);

    // Sparse random data pixels
    ctx.globalAlpha = 0.5;
    for (let j = 0; j < 30; j++) {
      const px = wx + Math.floor(rng() * (ww - 4));
      const py = wy + Math.floor(rng() * (wh - 4));
      const color = rng() < 0.7 ? '#00ff44' : '#0066ff';
      ctx.fillStyle = color;
      ctx.fillRect(px, py, 1, 1);
    }

    // Bottom-left timestamp
    ctx.font        = '7px monospace';
    ctx.fillStyle   = '#004422';
    ctx.globalAlpha = 0.6;
    ctx.textBaseline = 'bottom';
    const ts = '00:' + String(Math.floor(t * 60) % 60).padStart(2, '0') + ':' + String(Math.floor(t * 3600) % 60).padStart(2, '0');
    ctx.fillText(ts, wx + 5, wy + wh - 3);
  }

  _drawThumbnails(ctx, W, H, rng, t) {
    const STRIP_H  = 48;
    const THUMB_W  = 56;
    const THUMB_H  = 36;
    const PAD      = 4;
    const STRIP_Y  = H - STRIP_H - 2;
    const count    = Math.max(3, Math.floor((W - 20) / (THUMB_W + PAD)));

    // Strip background
    ctx.save();
    ctx.fillStyle   = '#04080f';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, STRIP_Y, W, STRIP_H + 2);

    // Top border line
    ctx.strokeStyle = BORDER_CYAN;
    ctx.lineWidth   = 0.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, STRIP_Y);
    ctx.lineTo(W, STRIP_Y);
    ctx.stroke();

    const startX = (W - count * (THUMB_W + PAD)) / 2;

    for (let i = 0; i < count; i++) {
      const tx = startX + i * (THUMB_W + PAD);
      const ty = STRIP_Y + (STRIP_H - THUMB_H) / 2;

      // Pick a base hue stable per thumbnail
      const hue     = lerp(170, 240, rng());
      const lit     = lerp(3, 18, rng());
      const isActive = Math.floor(t * 0.2) % count === i;

      // Thumbnail body
      ctx.fillStyle   = `hsl(${hue}, 70%, ${lit}%)`;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(tx, ty, THUMB_W, THUMB_H);

      // Internal pattern: rows of tiny dots
      ctx.fillStyle   = `hsl(${hue}, 80%, ${lit + 20}%)`;
      ctx.globalAlpha = 0.4;
      const dotRows = 4, dotCols = 8;
      const dw = THUMB_W / dotCols, dh = THUMB_H / dotRows;
      for (let dr = 0; dr < dotRows; dr++) {
        for (let dc = 0; dc < dotCols; dc++) {
          if (rng() < 0.5) {
            ctx.fillRect(tx + dc * dw + 1, ty + dr * dh + 1, dw - 2, dh - 2);
          }
        }
      }

      // Border — brighter if active
      ctx.strokeStyle = isActive ? '#00ccff' : BORDER_BRIGHT;
      ctx.lineWidth   = isActive ? 1 : 0.5;
      ctx.globalAlpha = isActive ? 1 : 0.5;
      ctx.strokeRect(tx, ty, THUMB_W, THUMB_H);

      // Tiny index label below thumbnail
      ctx.font        = '7px monospace';
      ctx.fillStyle   = isActive ? '#00ccff' : '#224433';
      ctx.globalAlpha = 0.7;
      ctx.textBaseline = 'top';
      ctx.fillText(String(i).padStart(2, '0'), tx + 2, ty + THUMB_H + 1);
    }

    // "FILES" label on right edge
    ctx.font        = '8px monospace';
    ctx.fillStyle   = '#003344';
    ctx.globalAlpha = 0.6;
    ctx.textBaseline = 'middle';
    ctx.fillText('FILES', W - 36, STRIP_Y + STRIP_H / 2);

    ctx.restore();
  }

  _drawScanlines(ctx, W, H, intensity, t) {
    // Scroll the scanlines slowly upward using time
    const scrollOffset = (t * 18) % 4;

    ctx.save();
    ctx.globalAlpha = intensity * 0.35;

    // Use a pattern-like approach: draw horizontal bars every 4px
    ctx.fillStyle = '#000000';
    for (let y = -scrollOffset; y < H; y += 4) {
      ctx.fillRect(0, y, W, 2);
    }

    // Subtle vignette-ish edge darkening (top and bottom strips)
    const vigH = H * 0.12;
    const topGrad = ctx.createLinearGradient(0, 0, 0, vigH);
    topGrad.addColorStop(0, `rgba(0,0,0,${intensity * 0.6})`);
    topGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, vigH);

    const botGrad = ctx.createLinearGradient(0, H - vigH, 0, H);
    botGrad.addColorStop(0, 'rgba(0,0,0,0)');
    botGrad.addColorStop(1, `rgba(0,0,0,${intensity * 0.6})`);
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, H - vigH, W, vigH);

    ctx.restore();
  }

  _drawGlitch(ctx, W, H, count, rng, t) {
    ctx.save();

    for (let i = 0; i < count; i++) {
      // Glitch bars appear and disappear using time + per-bar phase
      const phase    = rng() * Math.PI * 2;
      const blinkRate = 0.8 + rng() * 3;
      const visible  = Math.sin(t * blinkRate + phase) > 0.4;
      if (!visible) continue;

      const gy  = Math.floor(rng() * H);
      const gh  = Math.floor(lerp(2, 18, rng()));
      const gx  = Math.floor(lerp(-20, 20, rng())); // horizontal offset/shift
      const color = rng() < 0.6 ? '#00ffff' : rng() < 0.5 ? '#ff0033' : '#0066ff';
      const alpha = lerp(0.05, 0.25, rng());

      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = color;
      ctx.fillRect(gx, gy, W, gh);

      // Some glitch bars get a copied strip offset
      if (rng() < 0.4) {
        try {
          // Pull a strip from a nearby area and re-paint offset
          const srcY = clamp(gy - 5 - Math.floor(rng() * 30), 0, H - gh - 1);
          const imgData = ctx.getImageData(0, srcY, W, gh);
          ctx.globalAlpha = lerp(0.1, 0.5, rng());
          ctx.putImageData(imgData, gx, gy);
        } catch (e) {
          // getImageData can fail in some cross-origin contexts; skip silently
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  _drawTint(ctx, W, H, tintStrength) {
    ctx.save();
    // Multiply-ish tint: overlay a semi-transparent cyan-blue gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0,   `rgba(0,30,60,${tintStrength * 0.45})`);
    grad.addColorStop(0.5, `rgba(0,10,30,${tintStrength * 0.2})`);
    grad.addColorStop(1,   `rgba(0,20,50,${tintStrength * 0.4})`);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle   = grad;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Screen pass: adds cyan bloom to bright areas
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle   = `rgba(0,80,120,${tintStrength * 0.12})`;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }

  _drawCornerHUD(ctx, W, H, t) {
    ctx.save();
    ctx.font        = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.55;

    // Top-left: system identifier
    ctx.fillStyle = '#004433';
    ctx.fillText('SYS::CYBERCORE_v2.0', 6, 6);

    // Top-right: live clock-like readout
    const secs    = Math.floor(t * 10) % 60;
    const mins    = Math.floor(t / 6) % 60;
    const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    ctx.fillStyle = '#003344';
    ctx.textAlign = 'right';
    ctx.fillText('T+' + timeStr + ' | ONLINE', W - 6, 6);

    // Bottom-right: tiny status cluster
    ctx.textBaseline = 'bottom';
    ctx.fillStyle    = '#002233';
    ctx.fillText('SECURE_LINK::ACTIVE', W - 6, H - 6);

    // Bottom-left: signal strength bars
    const bars = 5;
    const barW = 3, barPad = 2;
    const strength = (Math.sin(t * 0.3) * 0.5 + 0.5);
    for (let b = 0; b < bars; b++) {
      const bh = 3 + b * 2;
      const bx = 6 + b * (barW + barPad);
      const by = H - 8 - bh;
      const active = b / bars < strength;
      ctx.fillStyle   = active ? '#00aa44' : '#081810';
      ctx.globalAlpha = active ? 0.8 : 0.4;
      ctx.fillRect(bx, by, barW, bh);
    }

    // Corner bracket decorations (top-left, top-right, bottom-left, bottom-right)
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth   = 1;
    const brk = 12; // bracket arm length

    // TL
    ctx.beginPath(); ctx.moveTo(0, brk); ctx.lineTo(0, 0); ctx.lineTo(brk, 0); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(W - brk, 0); ctx.lineTo(W, 0); ctx.lineTo(W, brk); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(0, H - brk); ctx.lineTo(0, H); ctx.lineTo(brk, H); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(W - brk, H); ctx.lineTo(W, H); ctx.lineTo(W, H - brk); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ── Randomize ──────────────────────────────────────────────────────────────

  randomize(state, set) {
    // Randomize seed first — this cascades all layout decisions
    set('cyber_seed', Math.floor(Math.random() * 100));

    // Weighted random choices for a coherent aesthetic
    const dense = Math.random() < 0.5;

    set('cyber_windows',   Math.round(lerp(dense ? 4 : 1, dense ? 12 : 6,  Math.random())));
    set('cyber_circuits',  Math.round(lerp(dense ? 8 : 2, dense ? 20 : 12, Math.random())));
    set('cyber_scanlines', parseFloat(lerp(0.15, 0.75, Math.random()).toFixed(2)));
    set('cyber_text',      parseFloat(lerp(0.2,  0.9,  Math.random()).toFixed(2)));
    set('cyber_grid',      parseFloat(lerp(0,    0.3,  Math.random()).toFixed(2)));
    set('cyber_glitch',    Math.round(lerp(0, 8, Math.random())));
    set('cyber_thumbs',    Math.random() < 0.7 ? 1 : 0);
    set('cyber_tint',      parseFloat(lerp(0.1, 0.7, Math.random()).toFixed(2)));
  }
}
