/**
 * Spirograph — hypotrochoid/epitrochoid curve.
 * x = (R-r)*cos(t) + d*cos((R-r)/r * t)
 * y = (R-r)*sin(t) - d*sin((R-r)/r * t)
 */

import { Algorithm } from '../base.js';

export class Spirograph extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPoints = [];
  }

  get metadata() {
    return {
      name: 'Spirograph',
      eq: 'Hypotrochoid: (R-r, d)',
      cat: 'Data Art',
      desc: 'A pen inside a small circle rolling inside a larger circle traces hypotrochoid curves. The ratio R/r determines the number of petals.',
    };
  }

  get params() {
    return [
      { id: 'spiro_R',      label: 'Outer R',  min: 20,  max: 150,  step: 1     },
      { id: 'spiro_r',      label: 'Inner r',  min: 5,   max: 100,  step: 1     },
      { id: 'spiro_d',      label: 'Pen Dist', min: 5,   max: 120,  step: 1     },
      { id: 'spiro_points', label: 'Points',   min: 2000, max: 50000, step: 1000 },
    ];
  }

  get detailParam() {
    return { id: 'spiro_points', min: 2000, max: 50000, step: 2000 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.spiro_r = Math.round(5 + mx * 95);
      s.spiro_d = Math.round(5 + my * 115);
    };
  }

  animate(s) {
    // Animate pen distance and inner radius for morphing spirograph patterns
    s.spiro_d = 5  + (Math.sin(s.time * 0.5) * 0.5 + 0.5) * 115;
    s.spiro_r = 5  + (Math.cos(s.time * 0.3) * 0.5 + 0.5) * 95;
    // Slowly vary outer radius for scale changes
    s.spiro_R = 40 + (Math.sin(s.time * 0.18) * 0.5 + 0.5) * 110;
  }

  render(ctx, W, H, s) {
    const R = Math.max(20, Math.min(150, Math.round(s.spiro_R)));
    let   r = Math.max(5,  Math.min(100, Math.round(s.spiro_r)));
    const d = Math.max(5,  Math.min(120, s.spiro_d));
    const n = Math.max(2000, Math.min(50000, Math.round(s.spiro_points)));
    const fg = this.engine.fg(s);
    const camZoom = s.camZoom || 1;
    const panX    = s.camPanX || 0;
    const panY    = s.camPanY || 0;

    // Prevent r >= R (inner must be smaller than outer)
    if (r >= R) r = R - 1;

    const cx = W / 2 + panX;
    const cy = H / 2 + panY;

    // Find the LCM period for a closed curve
    function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
    const g   = gcd(R, r);
    const periods = r / g; // number of full rotations to close
    const maxT = periods * Math.PI * 2;

    // Auto-scale: max radial extent is (R-r)+d
    const maxExtent = (R - r) + d;
    const fitR = Math.min(W, H) * 0.44;
    const scale = maxExtent > 0 ? fitR / maxExtent : 1;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    this._svgPoints = [];

    const k = (R - r) / r;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * maxT;
      const x = cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(k * t));
      const y = cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(k * t));
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      if (i % 10 === 0) this._svgPoints.push([x, y]);
    }
    ctx.stroke();

    ctx.restore();
  }

  collectSVG(W, H, s) {
    if (!this._svgPoints.length) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <polyline points="${this._svgPoints.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${fg}" stroke-width="1"/>
</svg>`;
  }
}
