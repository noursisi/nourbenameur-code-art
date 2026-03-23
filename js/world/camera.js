/**
 * Camera Intelligence — Tier 1: pixel analysis.
 * Reads from the active video element (webcam or uploaded video).
 * Provides brightness, color, edge, motion sampling at normalized coordinates.
 */

export class Camera {
  constructor(engine) {
    this.engine = engine;
    this._video = null;
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    this._pixels = null;
    this._prevPixels = null;
    this._width = 0;
    this._height = 0;
    this._active = false;

    // Edge detection (downscaled for performance)
    this._edgeData = null;
    this._edgeW = 0;
    this._edgeH = 0;
    this._edgeCanvas = null;
    this._edgeCtx = null;
    // Downscale factor for edge analysis (1/4 resolution)
    this._analysisScale = 0.25;
  }

  get active() { return this._active && this._video && !this._video.paused; }

  setVideo(video) {
    this._video = video;
    this._active = !!video;
  }

  clearVideo() {
    this._video = null;
    this._active = false;
    this._pixels = null;
    this._prevPixels = null;
  }

  update() {
    if (!this.active) return;
    const v = this._video;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (w === 0 || h === 0) return;

    if (this._width !== w || this._height !== h) {
      this._width = w;
      this._height = h;
      this._canvas.width = w;
      this._canvas.height = h;
    }

    this._prevPixels = this._pixels;
    this._ctx.drawImage(v, 0, 0, w, h);
    this._pixels = this._ctx.getImageData(0, 0, w, h);
    this._computeEdges();
  }

  get pixels() { return this._pixels; }

  brightness(nx, ny) {
    if (!this._pixels) return 0;
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return 0;
    const d = this._pixels.data;
    return (d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114) / 255;
  }

  color(nx, ny) {
    if (!this._pixels) return { r: 0, g: 0, b: 0 };
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return { r: 0, g: 0, b: 0 };
    const d = this._pixels.data;
    return { r: d[idx], g: d[idx + 1], b: d[idx + 2] };
  }

  edge(nx, ny) {
    if (!this._edgeData) return 0;
    const x = Math.floor(nx * (this._edgeW - 1));
    const y = Math.floor(ny * (this._edgeH - 1));
    if (x < 0 || x >= this._edgeW || y < 0 || y >= this._edgeH) return 0;
    return this._edgeData[y * this._edgeW + x];
  }

  motion(nx, ny) {
    if (!this._pixels || !this._prevPixels) return 0;
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return 0;
    const d = this._pixels.data;
    const p = this._prevPixels.data;
    const dr = Math.abs(d[idx] - p[idx]);
    const dg = Math.abs(d[idx + 1] - p[idx + 1]);
    const db = Math.abs(d[idx + 2] - p[idx + 2]);
    return (dr + dg + db) / (255 * 3);
  }

  toVideo(worldX, worldY, space) {
    if (!space) return { x: 0.5, y: 0.5 };
    const screen = space.toScreen(worldX, worldY);
    return { x: screen.x / space.W, y: screen.y / space.H };
  }

  toWorld(videoX, videoY, space) {
    if (!space) return { x: 0, y: 0 };
    return space.toWorld(videoX * space.W, videoY * space.H);
  }

  _sampleIndex(nx, ny) {
    if (!this._pixels) return -1;
    const x = Math.floor(Math.max(0, Math.min(1, nx)) * (this._width - 1));
    const y = Math.floor(Math.max(0, Math.min(1, ny)) * (this._height - 1));
    return (y * this._width + x) * 4;
  }

  _computeEdges() {
    if (!this._pixels) return;
    const w = Math.floor(this._width * this._analysisScale);
    const h = Math.floor(this._height * this._analysisScale);
    if (w < 3 || h < 3) return;

    this._edgeW = w;
    this._edgeH = h;

    if (!this._edgeCanvas) {
      this._edgeCanvas = document.createElement('canvas');
      this._edgeCtx = this._edgeCanvas.getContext('2d', { willReadFrequently: true });
    }
    this._edgeCanvas.width = w;
    this._edgeCanvas.height = h;
    this._edgeCtx.drawImage(this._video, 0, 0, w, h);
    const small = this._edgeCtx.getImageData(0, 0, w, h).data;

    if (!this._edgeData || this._edgeData.length !== w * h) {
      this._edgeData = new Float32Array(w * h);
    }

    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = (small[idx] * 0.299 + small[idx + 1] * 0.587 + small[idx + 2] * 0.114) / 255;
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const tl = gray[(y-1)*w+(x-1)], t = gray[(y-1)*w+x], tr = gray[(y-1)*w+(x+1)];
        const l = gray[y*w+(x-1)], r = gray[y*w+(x+1)];
        const bl = gray[(y+1)*w+(x-1)], b = gray[(y+1)*w+x], br = gray[(y+1)*w+(x+1)];
        const gx = -tl - 2*l - bl + tr + 2*r + br;
        const gy = -tl - 2*t - tr + bl + 2*b + br;
        this._edgeData[y * w + x] = Math.min(1, Math.sqrt(gx*gx + gy*gy));
      }
    }
  }
}
