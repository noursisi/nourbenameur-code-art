/**
 * Image Flow — Particle stream that follows iso-luminance contours of the
 * underlying video. Each particle samples the local image gradient and
 * moves perpendicular to it (along the iso-line), inheriting its color
 * from the source pixel. Trails decay between frames via a separate
 * compositing buffer so the underlying image stays bright.
 */

import { Algorithm } from '../base.js';

export class ImageFlow extends Algorithm {
  constructor(engine) {
    super(engine);
    this._cap = null;
    this._capCtx = null;
    this._trail = null;
    this._trailCtx = null;
    this._particles = [];
    this._particleCount = 0;
  }

  get metadata() {
    return {
      name: 'Image Flow',
      eq: 'particles ⊥ ∇I',
      cat: 'Image Art',
      desc: 'A field of particles that drift along the contours of your video, picking up color from the source. The image becomes a flowing current.',
    };
  }

  get params() {
    return [
      { id: 'if_count', label: 'Particles',  min: 100,  max: 4000, step: 100   },
      { id: 'if_speed', label: 'Speed',      min: 0.2,  max: 4,    step: 0.1   },
      { id: 'if_trail', label: 'Trail',      min: 0.5,  max: 0.99, step: 0.01  },
      { id: 'if_alpha', label: 'Stroke',     min: 0.1,  max: 1,    step: 0.02  },
      { id: 'if_life',  label: 'Particle Life', min: 20, max: 300, step: 10    },
    ];
  }

  get detailParam() { return { id: 'if_count', min: 100, max: 4000, step: 100 }; }
  animate() {}

  randomize(state, set) {
    set('if_count', Math.round(500 + Math.random() * 2500));
    set('if_speed', parseFloat((0.5 + Math.random() * 2.5).toFixed(2)));
    set('if_trail', parseFloat((0.85 + Math.random() * 0.13).toFixed(2)));
    set('if_alpha', parseFloat((0.2 + Math.random() * 0.6).toFixed(2)));
    set('if_life',  Math.round(50 + Math.random() * 200));
  }

  _ensureParticles(count, W, H) {
    if (this._particleCount === count) return;
    this._particles = new Array(count);
    for (let i = 0; i < count; i++) {
      this._particles[i] = {
        x: Math.random() * W,
        y: Math.random() * H,
        age: Math.random() * 100,
        seedAge: 0,
      };
    }
    this._particleCount = count;
  }

  _ensureBuffers(W, H) {
    if (!this._trail) {
      this._trail = document.createElement('canvas');
      this._trailCtx = this._trail.getContext('2d');
    }
    if (this._trail.width !== Math.round(W) || this._trail.height !== Math.round(H)) {
      this._trail.width = Math.round(W);
      this._trail.height = Math.round(H);
    }
    if (!this._cap) {
      this._cap = document.createElement('canvas');
      this._capCtx = this._cap.getContext('2d', { willReadFrequently: true });
    }
  }

  _sampleImage(srcCanvas, W, H) {
    const sW = 96;
    const sH = Math.max(24, Math.round(sW * H / W));
    if (this._cap.width !== sW || this._cap.height !== sH) {
      this._cap.width = sW;
      this._cap.height = sH;
    }
    this._capCtx.drawImage(srcCanvas, 0, 0, sW, sH);
    return { data: this._capCtx.getImageData(0, 0, sW, sH).data, sW, sH };
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const count = Math.round(s.if_count ?? 1200);
    const speed = s.if_speed ?? 1.4;
    const trail = s.if_trail ?? 0.92;
    const alpha = s.if_alpha ?? 0.5;
    const life = Math.round(s.if_life ?? 100);

    this._ensureBuffers(W, H);
    this._ensureParticles(count, W, H);
    const { data: img, sW, sH } = this._sampleImage(ctx.canvas, W, H);

    // Erase trail buffer proportionally to (1 - trail). 'destination-out'
    // erases by alpha rather than darkening — the underlying image stays
    // unaffected when we composite this on top.
    const tCtx = this._trailCtx;
    tCtx.globalCompositeOperation = 'destination-out';
    tCtx.fillStyle = `rgba(0,0,0,${1 - trail})`;
    tCtx.fillRect(0, 0, this._trail.width, this._trail.height);
    tCtx.globalCompositeOperation = 'source-over';
    tCtx.lineCap = 'round';
    tCtx.lineWidth = 1;

    const cellW = W / sW;
    const cellH = H / sH;
    for (const p of this._particles) {
      const cx = Math.floor((p.x / W) * sW);
      const cy = Math.floor((p.y / H) * sH);
      if (cx < 1 || cx >= sW - 1 || cy < 1 || cy >= sH - 1) {
        p.x = Math.random() * W;
        p.y = Math.random() * H;
        p.age = 0;
        continue;
      }
      // Local intensity gradient via central differences
      const idxL = (cy * sW + cx - 1) * 4;
      const idxR = (cy * sW + cx + 1) * 4;
      const idxU = ((cy - 1) * sW + cx) * 4;
      const idxD = ((cy + 1) * sW + cx) * 4;
      const lumaL = img[idxL] * 0.299 + img[idxL + 1] * 0.587 + img[idxL + 2] * 0.114;
      const lumaR = img[idxR] * 0.299 + img[idxR + 1] * 0.587 + img[idxR + 2] * 0.114;
      const lumaU = img[idxU] * 0.299 + img[idxU + 1] * 0.587 + img[idxU + 2] * 0.114;
      const lumaD = img[idxD] * 0.299 + img[idxD + 1] * 0.587 + img[idxD + 2] * 0.114;
      const gx = (lumaR - lumaL) / 255;
      const gy = (lumaD - lumaU) / 255;
      // Move perpendicular to gradient — along iso-luminance lines
      let dx = -gy;
      let dy = gx;
      const mag = Math.hypot(dx, dy);
      if (mag < 0.005) {
        // No gradient here → respawn somewhere new occasionally
        if (Math.random() < 0.05) {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.age = 0;
          continue;
        }
        // Drift slightly to escape flat regions
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
      } else {
        dx /= mag; dy /= mag;
      }
      const stepLen = Math.max(cellW, cellH) * 0.5 * speed;
      const newX = p.x + dx * stepLen;
      const newY = p.y + dy * stepLen;

      // Color from current cell
      const ci = (cy * sW + cx) * 4;
      const r = img[ci];
      const g = img[ci + 1];
      const b = img[ci + 2];

      tCtx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      tCtx.beginPath();
      tCtx.moveTo(p.x, p.y);
      tCtx.lineTo(newX, newY);
      tCtx.stroke();

      p.x = newX;
      p.y = newY;
      p.age++;
      if (p.age > life || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
        p.x = Math.random() * W;
        p.y = Math.random() * H;
        p.age = 0;
      }
    }

    // Composite trail buffer on the main canvas — the underlying image
    // remains unchanged where the trails are transparent.
    ctx.drawImage(this._trail, 0, 0);
  }

  collectSVG() { return null; }
}
