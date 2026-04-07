/**
 * Magnetic Field — simulates magnetic field lines between poles.
 * Iron filing visualization with field line tracing.
 */

import { Algorithm } from '../base.js';

export class MagneticField extends Algorithm {
  constructor(engine) {
    super(engine);
    this._poles = [];
    this._lastPoleCount = 0;
  }

  get metadata() {
    return {
      name: 'Magnetic Field',
      eq: 'B = sum(q/r^2)',
      cat: 'Nature',
      desc: 'Simulates magnetic field lines between randomly placed poles. Traces iron filing patterns that reveal invisible force fields.',
    };
  }

  get params() {
    return [
      { id: 'mag_poles',     label: 'Poles',          min: 2,   max: 12,   step: 1    },
      { id: 'mag_strength',  label: 'Field Strength', min: 50,  max: 500,  step: 10   },
      { id: 'mag_lines',     label: 'Line Count',     min: 100, max: 2000, step: 50   },
      { id: 'mag_lineLen',   label: 'Line Length',    min: 10,  max: 200,  step: 5    },
      { id: 'mag_colorMode', label: 'Color',          min: 0,   max: 3,    step: 1    },
      { id: 'mag_lineStyle', label: 'Line Style',     min: 0,   max: 3,    step: 1    },
      { id: 'mag_energy',    label: 'Energy',         min: 0.1, max: 5,    step: 0.1  },
      { id: 'mag_poleSize',  label: 'Pole Size',      min: 2,   max: 20,   step: 1    },
    ];
  }

  get detailParam() {
    return { id: 'mag_lines', min: 100, max: 2000, step: 50 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.mag_strength = 50 + mx * 450;
    };
  }

  _generatePoles(count, W, H) {
    this._poles = [];
    for (let i = 0; i < count; i++) {
      this._poles.push({
        x: W * 0.15 + Math.random() * W * 0.7,
        y: H * 0.15 + Math.random() * H * 0.7,
        // Alternate polarity: +1 / -1
        charge: i % 2 === 0 ? 1 : -1,
      });
    }
    this._lastPoleCount = count;
  }

  animate(world) { const { state: s } = world;
    const t = s.time;
    const energy = s.mag_energy ?? 1;
    // Gently drift poles, amplitude scaled by energy multiplier
    for (let i = 0; i < this._poles.length; i++) {
      const pole = this._poles[i];
      pole.x += Math.sin(t * 0.3 + i * 2.1) * 0.3 * energy;
      pole.y += Math.cos(t * 0.25 + i * 1.7) * 0.3 * energy;
    }
  }

  _fieldAt(x, y, strength) {
    let fx = 0, fy = 0;
    for (const pole of this._poles) {
      const dx = x - pole.x;
      const dy = y - pole.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) + 1;
      const force = pole.charge * strength / (distSq + 100);
      fx += force * dx / dist;
      fy += force * dy / dist;
    }
    return { x: fx, y: fy };
  }

  _nearestPole(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const pole of this._poles) {
      const dx = x - pole.x;
      const dy = y - pole.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = pole; }
    }
    return best;
  }

  _colorForMode(mode, fx, fy, x, y, strength, fg) {
    switch (mode) {
      case 1: {
        // Field direction — hue from angle
        const angle = Math.atan2(fy, fx); // -PI to PI
        const hue = ((angle / Math.PI) * 180 + 180) % 360;
        return `hsl(${hue.toFixed(1)},80%,60%)`;
      }
      case 2: {
        // Field strength — brightness
        const rawMag = Math.sqrt(fx * fx + fy * fy);
        // Map to a brightness between 20% and 90%
        const norm = Math.min(1, rawMag / (strength * 0.01));
        const lightness = Math.round(20 + norm * 70);
        return `hsl(0,0%,${lightness}%)`;
      }
      case 3: {
        // Pole proximity — warm/cool by nearest pole charge
        const pole = this._nearestPole(x, y);
        if (!pole) return fg;
        const hue = pole.charge > 0 ? 0 : 220;
        return `hsl(${hue},80%,60%)`;
      }
      default:
        return null; // use fg with random alpha
    }
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const poleCount   = Math.round(s.mag_poles ?? 4);
    const strength    = s.mag_strength ?? 200;
    const lineCount   = Math.round(s.mag_lines ?? 500);
    const lineLen     = Math.round(s.mag_lineLen ?? 60);
    const lw          = s.lineWeight ?? 1;
    const camZoom     = s.camZoom ?? 1;
    const colorMode   = Math.round(s.mag_colorMode ?? 0);
    const lineStyle   = Math.round(s.mag_lineStyle ?? 0);
    const poleSize    = s.mag_poleSize ?? 8;

    // Rebuild poles if count changed
    if (poleCount !== this._lastPoleCount || this._poles.length === 0) {
      this._generatePoles(poleCount, W, H);
    }

    const bg = this.engine.bg(s);
    const fg = this.engine.fg(s);

    if (!s.transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2 + (s.camPanX || 0), -H / 2 + (s.camPanY || 0));

    const baseLineWidth = Math.max(0.8, lw * 0.8);
    ctx.lineWidth = baseLineWidth;
    ctx.lineCap = 'round';

    // Apply line dash style (solid or patterned)
    switch (lineStyle) {
      case 1: ctx.setLineDash([6, 4]); break;
      case 2: ctx.setLineDash([1, 3]); break;
      default: ctx.setLineDash([]); break;
      // case 3 (tapered) handled per-segment below
    }

    const stepSize = 2;
    const isMono   = colorMode === 0;
    const isTaper  = lineStyle === 3;

    // Trace field lines from random starting points
    for (let i = 0; i < lineCount; i++) {
      let x = Math.random() * W;
      let y = Math.random() * H;

      const lineAlpha = 0.3 + Math.random() * 0.3;

      // Collect all steps first so we know total count for tapering
      const pts = [{ x, y }];
      let valid = true;

      for (let step = 0; step < lineLen; step++) {
        const field = this._fieldAt(x, y, strength);
        const mag = Math.sqrt(field.x * field.x + field.y * field.y);
        if (mag < 0.0001) { valid = false; break; }

        x += (field.x / mag) * stepSize;
        y += (field.y / mag) * stepSize;

        if (x < 0 || x > W || y < 0 || y > H) break;
        pts.push({ x, y });
      }

      if (!valid || pts.length < 2) continue;

      ctx.globalAlpha = lineAlpha;

      if (isMono && !isTaper) {
        // Fast path: single path stroke
        ctx.strokeStyle = fg;
        ctx.lineWidth = baseLineWidth;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
        ctx.stroke();
      } else {
        // Per-segment path for color variation or tapering
        if (isTaper) ctx.setLineDash([]);

        for (let p = 1; p < pts.length; p++) {
          const prev = pts[p - 1];
          const cur  = pts[p];

          if (!isMono) {
            // Re-compute raw field at prev point for coloring
            const field = this._fieldAt(prev.x, prev.y, strength);
            const color = this._colorForMode(colorMode, field.x, field.y, prev.x, prev.y, strength, fg);
            ctx.strokeStyle = color ?? fg;
          } else {
            ctx.strokeStyle = fg;
          }

          if (isTaper) {
            // Decrease lineWidth from full to near-zero along trace
            const t = (p - 1) / (pts.length - 1);
            ctx.lineWidth = Math.max(0.2, baseLineWidth * (1 - t * 0.9));
          }

          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
        }
      }
    }

    // Reset dash and alpha
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = baseLineWidth;

    // Draw poles
    ctx.globalAlpha = 0.8;
    for (const pole of this._poles) {
      ctx.fillStyle = pole.charge > 0 ? '#ff4444' : '#4488ff';
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, poleSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
