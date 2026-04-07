/**
 * Harmonograph — damped dual-pendulum Lissajous figure.
 * x = sin(f1*t + phase) * e^(-damping*t)
 * y = sin(f2*t) * e^(-damping*t)
 */

import { Algorithm } from '../base.js';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export class Harmonograph extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPoints = [];
  }

  get metadata() {
    return {
      name: 'Harmonograph',
      eq: 'x=sin(f₁t+φ)·e^(-dt), y=sin(f₂t)·e^(-dt)',
      cat: 'Physics',
      desc: 'Two pendulums swinging at different frequencies create damped Lissajous figures. Near-integer frequency ratios produce slowly drifting quasi-periodic patterns.',
    };
  }

  get params() {
    return [
      { id: 'harm_f1',        label: 'Freq 1',         min: 1,   max: 7,      step: 0.01   },
      { id: 'harm_f2',        label: 'Freq 2',         min: 1,   max: 7,      step: 0.01   },
      { id: 'harm_phase',     label: 'Phase',          min: 0,   max: 3.14,   step: 0.01   },
      { id: 'harm_damping',   label: 'Damping',        min: 0,   max: 0.01,   step: 0.0002 },
      { id: 'harm_points',    label: 'Points',         min: 5000, max: 200000, step: 5000  },
      { id: 'harm_colorGrad', label: 'Color Gradient', min: 0,   max: 1,      step: 1      },
      { id: 'harm_compound',  label: 'Compound Freq',  min: 0,   max: 1,      step: 1      },
    ];
  }

  get detailParam() {
    return { id: 'harm_points', min: 5000, max: 200000, step: 10000 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.harm_f1 = 1 + mx * 6;
      s.harm_f2 = 1 + my * 6;
    };
  }

  animate(world) { const { state: s } = world;
    s.harm_phase = (s.harm_phase + 0.002) % (Math.PI * 2);
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const f1         = s.harm_f1;
    const f2         = s.harm_f2;
    const phase      = s.harm_phase;
    const damping    = s.harm_damping;
    const n          = Math.max(5000, Math.min(200000, Math.round(s.harm_points)));
    const colorGrad  = s.harm_colorGrad ? 1 : 0;
    const compound   = s.harm_compound ? 1 : 0;
    const fg         = this.engine.fg(s);
    const camZoom    = s.camZoom || 1;
    const panX       = s.camPanX || 0;
    const panY       = s.camPanY || 0;

    const cx     = W / 2 + panX;
    const cy     = H / 2 + panY;
    const radius = Math.min(W, H) * 0.44;
    const dt     = (Math.PI * 2 * 10) / n; // 10 full cycles
    const f3     = (f1 + f2) / 2; // compound third frequency

    // Pre-compute gradient colors if needed
    let fgRgb, tintRgb;
    if (colorGrad) {
      fgRgb   = hexToRgb(s.fgColor || '#ffffff');
      tintRgb = [100, 150, 255];
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.lineWidth = Math.max(0.8, s.lineWeight || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this._svgPoints = [];

    if (colorGrad) {
      // Draw each segment individually with interpolated color
      for (let i = 0; i < n; i++) {
        const t     = i * dt;
        const t1    = (i + 1) * dt;
        const decay  = Math.exp(-damping * t);
        const decay1 = Math.exp(-damping * t1);
        const compX  = compound ? Math.sin(f3 * t) * decay * radius * 0.3 : 0;
        const compX1 = compound ? Math.sin(f3 * t1) * decay1 * radius * 0.3 : 0;
        const x  = cx + Math.sin(f1 * t + phase) * decay * radius + compX;
        const y  = cy + Math.sin(f2 * t) * decay * radius;
        const x1 = cx + Math.sin(f1 * t1 + phase) * decay1 * radius + compX1;
        const y1 = cy + Math.sin(f2 * t1) * decay1 * radius;
        const prog = n > 1 ? i / (n - 1) : 0;
        const [r, g, b] = lerpRgb(fgRgb, tintRgb, prog);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        if (i % 10 === 0) this._svgPoints.push([x, y]);
      }
    } else {
      ctx.strokeStyle = fg;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t     = i * dt;
        const decay = Math.exp(-damping * t);
        const compX = compound ? Math.sin(f3 * t) * decay * radius * 0.3 : 0;
        const x = cx + Math.sin(f1 * t + phase) * decay * radius + compX;
        const y = cy + Math.sin(f2 * t) * decay * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        if (i % 10 === 0) this._svgPoints.push([x, y]);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  collectSVG(world) { const { W, H, state: s } = world;
    if (!this._svgPoints.length) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    const d = 'M ' + this._svgPoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <polyline points="${this._svgPoints.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${fg}" stroke-width="${Math.max(0.8, s.lineWeight || 1)}"/>
</svg>`;
  }
}
