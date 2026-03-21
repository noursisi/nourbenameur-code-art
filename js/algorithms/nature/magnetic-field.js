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
      { id: 'mag_lineLen',   label: 'Line Length',     min: 10,  max: 200,  step: 5    },
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

  animate(s) {
    const t = s.time;
    // Gently drift poles
    for (let i = 0; i < this._poles.length; i++) {
      const pole = this._poles[i];
      pole.x += Math.sin(t * 0.3 + i * 2.1) * 0.3;
      pole.y += Math.cos(t * 0.25 + i * 1.7) * 0.3;
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

  render(ctx, W, H, s) {
    const poleCount = Math.round(s.mag_poles ?? 4);
    const strength = s.mag_strength ?? 200;
    const lineCount = Math.round(s.mag_lines ?? 500);
    const lineLen = Math.round(s.mag_lineLen ?? 60);
    const lw = s.lineWeight ?? 1;
    const camZoom = s.camZoom ?? 1;

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

    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(0.8, lw * 0.8);
    ctx.lineCap = 'round';

    // Trace field lines from random starting points
    for (let i = 0; i < lineCount; i++) {
      let x = Math.random() * W;
      let y = Math.random() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);

      const stepSize = 2;
      let valid = true;

      for (let step = 0; step < lineLen; step++) {
        const field = this._fieldAt(x, y, strength);
        const mag = Math.sqrt(field.x * field.x + field.y * field.y);
        if (mag < 0.0001) { valid = false; break; }

        // Normalize and step
        x += (field.x / mag) * stepSize;
        y += (field.y / mag) * stepSize;

        if (x < 0 || x > W || y < 0 || y > H) break;
        ctx.lineTo(x, y);
      }

      if (valid) {
        ctx.globalAlpha = 0.3 + Math.random() * 0.3;
        ctx.stroke();
      }
    }

    // Draw poles
    ctx.globalAlpha = 0.8;
    for (const pole of this._poles) {
      ctx.fillStyle = pole.charge > 0 ? '#ff4444' : '#4488ff';
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
