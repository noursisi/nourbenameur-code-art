/**
 * Renderer — rich drawing primitives in world coordinates.
 * Auto-transforms via Space module. Falls back to screen coords if no Space.
 */

export class Renderer {
  constructor() {
    this._space = null;
    this._W = 0;
    this._H = 0;
  }

  update(W, H, space) {
    this._W = W;
    this._H = H;
    this._space = space;
  }

  _toScreen(x, y, screenCoords) {
    if (screenCoords) return { x, y };
    if (this._space) return this._space.toScreen(x, y);
    return { x, y };
  }

  _scaleSize(size, screenCoords) {
    if (screenCoords) return size;
    if (this._space) return size * this._space.zoom;
    return size;
  }

  text(ctx, str, x, y, opts = {}) {
    const sc = opts.screenCoords;
    const s = this._toScreen(x, y, sc);
    const size = this._scaleSize(opts.size || 14, sc);
    ctx.save();
    ctx.translate(s.x, s.y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.opacity !== undefined) ctx.globalAlpha = opts.opacity;
    ctx.font = `${size}px ${opts.font || 'monospace'}`;
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  textScatter(ctx, texts, positions, opts = {}) {
    const font = opts.font || 'monospace';
    const baseColor = opts.color || '#ffffff';
    const baseSize = opts.size || 14;
    const baseOpacity = opts.opacity !== undefined ? opts.opacity : 1;
    const sc = opts.screenCoords;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < texts.length; i++) {
      const p = positions[i];
      const s = this._toScreen(p.x, p.y, sc);
      const size = this._scaleSize(opts.sizes ? opts.sizes[i] : baseSize, sc);
      const color = opts.colors ? opts.colors[i] : baseColor;
      const opacity = opts.opacities ? opts.opacities[i] : baseOpacity;
      const rotation = opts.rotations ? opts.rotations[i] : 0;

      ctx.save();
      ctx.translate(s.x, s.y);
      if (rotation) ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.font = `${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.fillText(texts[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  block(ctx, x, y, w, h, opts = {}) {
    const sc = opts.screenCoords;
    const s = this._toScreen(x, y, sc);
    const sw = this._scaleSize(w, sc);
    const sh = this._scaleSize(h, sc);

    ctx.save();
    ctx.translate(s.x, s.y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.opacity !== undefined) ctx.globalAlpha = opts.opacity;
    ctx.fillStyle = opts.color || '#ffffff';

    if (opts.radius) {
      const r = Math.min(opts.radius, sw / 2, sh / 2);
      ctx.beginPath();
      ctx.roundRect(-sw / 2, -sh / 2, sw, sh, r);
      ctx.fill();
    } else {
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    }
    ctx.restore();
  }

  dot(ctx, x, y, radius, opts = {}) {
    const sc = opts.screenCoords;
    const s = this._toScreen(x, y, sc);
    const sr = this._scaleSize(radius, sc);

    ctx.save();
    if (opts.opacity !== undefined) ctx.globalAlpha = opts.opacity;
    if (opts.glow) {
      ctx.shadowColor = opts.color || '#ffffff';
      ctx.shadowBlur = opts.glow;
    }
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  trail(ctx, points, opts = {}) {
    if (points.length < 2) return;
    const color = opts.color || '#ffffff';
    const sc = opts.screenCoords;
    const width = this._scaleSize(opts.width || 2, sc);
    const fadeStart = opts.fadeStart || 0;

    ctx.save();
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < points.length; i++) {
      const t = i / (points.length - 1);
      const alpha = t < fadeStart ? 0 : (t - fadeStart) / (1 - fadeStart);
      const a = this._toScreen(points[i - 1].x, points[i - 1].y, sc);
      const b = this._toScreen(points[i].x, points[i].y, sc);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
