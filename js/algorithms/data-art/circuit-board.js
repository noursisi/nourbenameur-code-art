/**
 * Circuit Board — Canvas 2D procedural PCB generator.
 * Generates a realistic-looking circuit board with varied components,
 * real text labels, metallic traces, and organic imperfection.
 * NOT a tiled pattern — every component is unique.
 */

import { Algorithm } from '../base.js';

// ── Seeded RNG ───────────────────────────────────────────────────────────────

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function lerp(a, b, t) { return a + (b - a) * t; }

// ── Component data ───────────────────────────────────────────────────────────

const IC_NAMES = [
  'ATmega328P', '74HC595', '74LS04', 'LM7805', 'NE555', 'AD9850',
  'TL072', 'MAX232', 'ULN2803', 'CD4017', 'LM358', 'MC68000',
  'Z80A CPU', 'SAA1099', 'YM2612', '6502', '8086', 'TDA7294',
  'TOSHIBA\nT7891A', 'Canon', 'MOSEL\nMS6264', 'HD6301', 'AY-3-8910',
  'AM27C256', 'W65C02S', 'SN76489', 'TMP8255AP-5', 'HM62256',
  'MB8464A', 'D8255AC', 'uPD71054', 'TC5565', 'M5M5256',
];

const LABELS = [
  'REV A.3', 'REV 2.1B', 'MADE IN JAPAN', 'MADE IN TAIWAN',
  'FG1-8358', '41014108', 'FH11069', 'PWB-A', 'ASSY 250469',
  '(C) 1989', '(C) 1994', 'PAT.PEND.', 'TESTED OK', 'LOT 2847',
  'DATE: 94.03', 'PCB-REV4', 'DO NOT REMOVE',
];

const PIN_LABELS = [
  'VCC', 'GND', 'CLK', 'DATA', 'RST', 'TX', 'RX', 'SCL', 'SDA',
  'CS', 'MISO', 'MOSI', 'A0', 'A1', 'D0', 'D1', 'D2', 'D3',
  '+5V', '+3V3', '+12V', '-12V', 'NC', 'EN', 'OUT', 'IN',
];

const WIRE_COLORS = [
  '#cc2222', '#2255cc', '#22aa22', '#ccaa22', '#cc6600',
  '#aa22aa', '#22aaaa', '#666666', '#884422', '#ffffff',
];

// ── Algorithm ────────────────────────────────────────────────────────────────

export class CircuitBoard extends Algorithm {
  constructor(engine) {
    super(engine);
    this._cache = null;
    this._cacheKey = '';
  }

  get metadata() {
    return {
      name: 'Circuit Board',
      eq: 'PCB × silver',
      cat: 'Data Art',
      desc: 'Procedural motherboard — ICs, capacitors, traces, silkscreen labels, wires. Every board unique.',
    };
  }

  get params() {
    return [
      { id: 'pcb_scale',   label: 'Scale',    min: 0.5, max: 3,   step: 0.1  },
      { id: 'pcb_density', label: 'Density',   min: 0.2, max: 1,   step: 0.05 },
      { id: 'pcb_layers',  label: 'Layers',    min: 1,   max: 3,   step: 1    },
      { id: 'pcb_shine',   label: 'Shine',     min: 0,   max: 1,   step: 0.05 },
      { id: 'pcb_light',   label: 'Light',     min: 0,   max: 6.28,step: 0.1  },
      { id: 'pcb_warmth',  label: 'Warmth',    min: 0,   max: 1,   step: 0.05 },
    ];
  }

  get detailParam() { return { id: 'pcb_density', min: 0.2, max: 1, step: 0.05 }; }

  get cursorMap() {
    return (mx, my, s) => {
      s.pcb_light = mx * 6.28;
      s.pcb_scale = 0.5 + (1 - my) * 2.5;
    };
  }

  animate(world) {
    world.state.pcb_light = ((world.state.pcb_light ?? 0.8) + 0.003) % 6.2832;
  }

  randomize(state, set) {
    set('pcb_scale',   parseFloat((0.6 + Math.random() * 2).toFixed(1)));
    set('pcb_density', parseFloat((0.3 + Math.random() * 0.65).toFixed(2)));
    set('pcb_layers',  Math.ceil(Math.random() * 3));
    set('pcb_shine',   parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('pcb_light',   parseFloat((Math.random() * 6.28).toFixed(2)));
    set('pcb_warmth',  parseFloat((Math.random() * 0.5).toFixed(2)));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const scale = s.pcb_scale ?? 1.5;
    const density = s.pcb_density ?? 0.6;
    const layers = s.pcb_layers ?? 2;
    const shine = s.pcb_shine ?? 0.7;
    const light = s.pcb_light ?? 0.8;
    const warmth = s.pcb_warmth ?? 0;
    const seed = Math.round(scale * 100 + density * 50 + layers);

    // Cache key — only regenerate when params change
    const key = `${seed}-${W}-${H}-${Math.round(light*10)}-${Math.round(shine*10)}-${Math.round(warmth*10)}`;
    if (this._cache && this._cacheKey === key) {
      ctx.drawImage(this._cache, 0, 0, W, H);
      return;
    }

    const rng = makeLCG(seed * 7919 + 31337);

    // Light direction for shadows/highlights
    const lx = Math.cos(light) * 1.5;
    const ly = Math.sin(light) * 1.5;

    // Material colors
    const silver = warmth < 0.5
      ? [lerp(140, 170, shine), lerp(145, 175, shine), lerp(150, 180, shine)]
      : [lerp(170, 195, shine), lerp(155, 170, shine), lerp(110, 130, shine)];
    const traceColor = `rgb(${silver[0]},${silver[1]},${silver[2]})`;
    const traceHighlight = `rgba(255,255,255,${shine * 0.4})`;
    const boardColor = warmth < 0.3 ? '#0a0f0a' : '#0d1a0d';

    // ── Board substrate ──────────────────────────────────────────────────────
    ctx.fillStyle = boardColor;
    ctx.fillRect(0, 0, W, H);

    // Board texture (subtle noise via tiny dots)
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < W * H * 0.003 * density; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#1a2a1a' : '#0a150a';
      ctx.fillRect(rng() * W, rng() * H, 1, 1);
    }
    ctx.globalAlpha = 1;

    // ── Mounting holes (corners) ─────────────────────────────────────────────
    const holes = [[15, 15], [W - 15, 15], [15, H - 15], [W - 15, H - 15]];
    for (const [hx, hy] of holes) {
      // Pad
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#888';
      ctx.fill();
      // Hole
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
    }

    // ── Trace routing ────────────────────────────────────────────────────────
    const traceCount = Math.round(60 + density * 200);
    for (let i = 0; i < traceCount; i++) {
      const tw = rng() < 0.15 ? lerp(2, 5, rng()) : lerp(0.3, 1.5, rng());
      let x = rng() * W;
      let y = rng() * H;
      const segs = 3 + Math.floor(rng() * 8);
      let dir = rng() < 0.5 ? 0 : 1;

      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let seg = 0; seg < segs; seg++) {
        const len = 10 + rng() * W * 0.25;
        if (dir === 0) x += (rng() < 0.5 ? len : -len);
        else y += (rng() < 0.5 ? len : -len);
        x = Math.max(5, Math.min(W - 5, x));
        y = Math.max(5, Math.min(H - 5, y));
        ctx.lineTo(x, y);
        dir = 1 - dir;
      }

      // Shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = tw + 1;
      ctx.stroke();
      // Trace
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = tw;
      ctx.stroke();
      // Highlight edge
      if (tw > 1 && shine > 0.3) {
        ctx.strokeStyle = traceHighlight;
        ctx.lineWidth = tw * 0.3;
        ctx.stroke();
      }

      // Pads at endpoints
      if (rng() < 0.6) {
        ctx.beginPath();
        ctx.arc(x, y, tw * 2 + 1, 0, Math.PI * 2);
        ctx.fillStyle = traceColor;
        ctx.fill();
      }
    }

    // ── Vias ─────────────────────────────────────────────────────────────────
    const viaCount = Math.round(30 + density * 100);
    for (let i = 0; i < viaCount; i++) {
      const vx = rng() * W;
      const vy = rng() * H;
      const vr = 1.5 + rng() * 2.5;
      ctx.beginPath();
      ctx.arc(vx, vy, vr + 1, 0, Math.PI * 2);
      ctx.fillStyle = traceColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(vx, vy, vr * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    }

    // ── IC Chips ─────────────────────────────────────────────────────────────
    const icCount = Math.round(8 + density * 25);
    for (let i = 0; i < icCount; i++) {
      const icW = lerp(15, 80, rng());
      const icH = lerp(10, 50, rng());
      const ix = rng() * (W - icW);
      const iy = rng() * (H - icH);
      const name = pick(IC_NAMES, rng);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ix + lx, iy + ly, icW, icH);
      // Body (dark)
      ctx.fillStyle = rng() < 0.7 ? '#1a1a1a' : '#222222';
      ctx.fillRect(ix, iy, icW, icH);
      // Bevel highlight (top/left edge)
      ctx.fillStyle = 'rgba(80,80,80,0.3)';
      ctx.fillRect(ix, iy, icW, 1);
      ctx.fillRect(ix, iy, 1, icH);

      // Pin 1 dot
      ctx.beginPath();
      ctx.arc(ix + 3, iy + 3, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#555';
      ctx.fill();

      // Pins on edges
      const pinSpacing = icW > 40 ? 3 : 2;
      const pinLen = 3;
      // Top/bottom pins
      for (let px = ix + pinSpacing; px < ix + icW - 1; px += pinSpacing) {
        ctx.fillStyle = traceColor;
        ctx.fillRect(px, iy - pinLen, 1, pinLen);
        ctx.fillRect(px, iy + icH, 1, pinLen);
      }
      // Left/right pins
      for (let py = iy + pinSpacing; py < iy + icH - 1; py += pinSpacing) {
        ctx.fillStyle = traceColor;
        ctx.fillRect(ix - pinLen, py, pinLen, 1);
        ctx.fillRect(ix + icW, py, pinLen, 1);
      }

      // Chip label
      const fontSize = Math.max(4, Math.min(8, icW * 0.12));
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = `rgba(180,180,180,${0.5 + shine * 0.3})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = name.split('\n');
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], ix + icW / 2, iy + icH / 2 + (li - (lines.length - 1) / 2) * (fontSize + 1));
      }
    }

    // ── SMD Capacitors / Resistors ───────────────────────────────────────────
    const smdCount = Math.round(40 + density * 150);
    for (let i = 0; i < smdCount; i++) {
      const sw = lerp(3, 10, rng());
      const sh = lerp(1.5, 5, rng());
      const sx = rng() * W;
      const sy = rng() * H;
      const rot = rng() < 0.5 ? 0 : Math.PI / 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(lx * 0.5, ly * 0.5, sw, sh);
      // Body
      const bodyColor = rng() < 0.4 ? '#1a1a1a' : rng() < 0.5 ? '#332211' : '#111122';
      ctx.fillStyle = bodyColor;
      ctx.fillRect(0, 0, sw, sh);
      // End caps (solder)
      ctx.fillStyle = traceColor;
      ctx.fillRect(0, 0, sw * 0.25, sh);
      ctx.fillRect(sw * 0.75, 0, sw * 0.25, sh);

      ctx.restore();
    }

    // ── Electrolytic Capacitors (top view = circle) ──────────────────────────
    const capCount = Math.round(5 + density * 15);
    for (let i = 0; i < capCount; i++) {
      const cr = lerp(4, 14, rng());
      const cx = cr + rng() * (W - cr * 2);
      const cy = cr + rng() * (H - cr * 2);

      // Shadow
      ctx.beginPath();
      ctx.arc(cx + lx, cy + ly, cr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = rng() < 0.5 ? '#111111' : '#0a0a2a';
      ctx.fill();
      // Top marking (stripe)
      ctx.beginPath();
      ctx.arc(cx, cy, cr, -0.4, 0.4);
      ctx.lineTo(cx, cy);
      ctx.fillStyle = 'rgba(150,150,150,0.2)';
      ctx.fill();
      // Center cross
      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - cr * 0.5, cy);
      ctx.lineTo(cx + cr * 0.5, cy);
      ctx.moveTo(cx, cy - cr * 0.5);
      ctx.lineTo(cx, cy + cr * 0.5);
      ctx.stroke();
      // Polarity marker
      ctx.font = '5px monospace';
      ctx.fillStyle = 'rgba(150,150,150,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText('+', cx - cr * 0.3, cy - cr * 0.3);
    }

    // ── Connectors / Headers ─────────────────────────────────────────────────
    const connCount = Math.round(3 + density * 8);
    for (let i = 0; i < connCount; i++) {
      const isVertical = rng() < 0.5;
      const pins = Math.floor(4 + rng() * 20);
      const pinRows = rng() < 0.4 ? 2 : 1;
      const pinSp = 2.5;
      const cw = isVertical ? pinRows * pinSp + 4 : pins * pinSp + 4;
      const ch = isVertical ? pins * pinSp + 4 : pinRows * pinSp + 4;
      const cx = rng() * (W - cw);
      const cy = rng() * (H - ch);

      // Housing
      ctx.fillStyle = rng() < 0.5 ? '#222' : '#1a1a0a';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx, cy, cw, ch);

      // Pin grid
      for (let r = 0; r < pinRows; r++) {
        for (let p = 0; p < pins; p++) {
          const px = isVertical ? cx + 2 + r * pinSp + pinSp / 2 : cx + 2 + p * pinSp + pinSp / 2;
          const py = isVertical ? cy + 2 + p * pinSp + pinSp / 2 : cy + 2 + r * pinSp + pinSp / 2;
          ctx.beginPath();
          ctx.arc(px, py, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = traceColor;
          ctx.fill();
        }
      }
    }

    // ── Wires / Jumpers ──────────────────────────────────────────────────────
    if (layers > 1) {
      const wireCount = Math.round(3 + density * 10);
      for (let i = 0; i < wireCount; i++) {
        const x1 = rng() * W, y1 = rng() * H;
        const x2 = rng() * W, y2 = rng() * H;
        const cpx = lerp(x1, x2, 0.5) + (rng() - 0.5) * 100;
        const cpy = lerp(y1, y2, 0.5) + (rng() - 0.5) * 100;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpx, cpy, x2, y2);
        ctx.strokeStyle = pick(WIRE_COLORS, rng);
        ctx.lineWidth = 0.8 + rng() * 1.2;
        ctx.stroke();

        // Solder points at ends
        for (const [wx, wy] of [[x1, y1], [x2, y2]]) {
          ctx.beginPath();
          ctx.arc(wx, wy, 2, 0, Math.PI * 2);
          ctx.fillStyle = traceColor;
          ctx.fill();
        }
      }
    }

    // ── Silkscreen text (component designators) ──────────────────────────────
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const textCount = Math.round(50 + density * 150);
    const prefixes = ['C', 'R', 'U', 'Q', 'D', 'J', 'L', 'TP', 'SW', 'F', 'T', 'X', 'FB', 'K'];
    for (let i = 0; i < textCount; i++) {
      const type = rng();
      let text, size;
      if (type < 0.6) {
        text = pick(prefixes, rng) + (Math.floor(rng() * 999) + 1);
        size = 3.5 + rng() * 3;
      } else if (type < 0.85) {
        text = pick(PIN_LABELS, rng);
        size = 3 + rng() * 2.5;
      } else {
        text = pick(LABELS, rng);
        size = 4 + rng() * 4;
      }

      ctx.font = `${size}px monospace`;
      ctx.fillStyle = `rgba(120,140,120,${0.15 + rng() * 0.25})`;

      const tx = rng() * W;
      const ty = rng() * H;
      if (rng() < 0.3) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(text, tx, ty);
      }
    }

    // ── Board edge line ──────────────────────────────────────────────────────
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // ── Edge connector (gold fingers at bottom) ──────────────────────────────
    if (rng() < 0.6) {
      const fingerCount = Math.floor(W / 4);
      const fingerY = H - 10;
      for (let f = 0; f < fingerCount; f++) {
        const fx = 10 + f * 3.5;
        if (fx > W - 10) break;
        ctx.fillStyle = warmth > 0.3 ? '#998844' : '#aaaaaa';
        ctx.fillRect(fx, fingerY, 1.5, 8);
      }
    }

    // Cache the result
    const cache = document.createElement('canvas');
    cache.width = ctx.canvas.width;
    cache.height = ctx.canvas.height;
    cache.getContext('2d').drawImage(ctx.canvas, 0, 0);
    this._cache = cache;
    this._cacheKey = key;
  }

  collectSVG() { return null; }
}
