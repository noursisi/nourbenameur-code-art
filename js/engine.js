/**
 * Engine — manages the full 2D render pipeline.
 * Pipeline per frame:
 *   clear → image-behind → algorithm.render() → symmetry → post-process → image-front → grain
 */

import { state } from './state.js';

class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0;
    this.H = 0;
    this._algorithm = null;
    this._glCanvas = null;
    this._glCtx = null;
  }

  /** Update W/H to match the canvas-area container */
  resize() {
    const area = document.getElementById('canvas-area');
    const dpr = window.devicePixelRatio || 1;
    const rect = area.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    // Reset the transform and apply DPR scaling
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Resize GL canvas if it exists
    if (this._glCanvas) {
      this._glCanvas.width = this.canvas.width;
      this._glCanvas.height = this.canvas.height;
    }
  }

  /** Returns the 2D rendering context */
  getCtx() {
    return this.ctx;
  }

  /** Lazily creates and returns the offscreen WebGL canvas */
  getGLCanvas() {
    if (!this._glCanvas) {
      this._glCanvas = document.createElement('canvas');
      this._glCanvas.width = this.canvas.width;
      this._glCanvas.height = this.canvas.height;
      this._glCtx = this._glCanvas.getContext('webgl') ||
                   this._glCanvas.getContext('experimental-webgl');
    }
    return this._glCanvas;
  }

  /** Returns the WebGL context (creates GL canvas if needed) */
  getGL() {
    this.getGLCanvas();
    return this._glCtx;
  }

  /** Set the active algorithm instance */
  setAlgorithm(algo) {
    this._algorithm = algo;
  }

  /** Get background color for the current colorMode */
  bg() {
    switch (state.colorMode) {
      case 'bw':     return '#f0efe8';
      case 'silver': return '#0a0a0a';
      default:       return '#000000'; // wb
    }
  }

  /** Get foreground color for the current colorMode */
  fg() {
    switch (state.colorMode) {
      case 'bw':     return '#000000';
      case 'silver': return '#bbbbbb';
      default:       return '#ffffff'; // wb
    }
  }

  /**
   * Run the full pipeline for one frame.
   * @param {object} s - state snapshot
   */
  render(s) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    if (W === 0 || H === 0) return;

    ctx.save();

    // ── 1. Clear ───────────────────────────────────────────────────────────────
    if (s.transparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = this.bg();
      ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Image — behind layer ────────────────────────────────────────────────
    if (s.img_layer === 'behind' && this._imageEl) {
      this._drawImage(ctx, W, H, s);
    }

    // ── 3. Algorithm ───────────────────────────────────────────────────────────
    if (this._algorithm) {
      this._algorithm.render(ctx, W, H, s);
      // If algo uses WebGL, composite it
      if (this._glCanvas) {
        ctx.drawImage(this._glCanvas, 0, 0, W, H);
      }
    }

    // ── 4. Symmetry (stub — future) ────────────────────────────────────────────
    // Symmetry post-processing goes here

    // ── 5. Post-process: glow / blur ──────────────────────────────────────────
    if (s.blur > 0 || s.glow > 0) {
      // Blur is applied via CSS filter on the canvas element
      // We apply glow as a canvas shadow pass — stub for now
    }

    // ── 6. Image — front layer ────────────────────────────────────────────────
    if (s.img_layer === 'front' && this._imageEl) {
      this._drawImage(ctx, W, H, s);
    }

    // ── 7. Grain ─────────────────────────────────────────────────────────────
    if (s.grain > 0) {
      this._drawGrain(ctx, W, H, s.grain);
    }

    ctx.restore();

    // CSS filter for blur/glow
    const filterParts = [];
    if (s.blur > 0) filterParts.push(`blur(${s.blur}px)`);
    this.canvas.style.filter = filterParts.length ? filterParts.join(' ') : '';
  }

  /** Draw the user-imported image layer */
  _drawImage(ctx, W, H, s) {
    const img = this._imageEl;
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = s.img_opacity;
    ctx.globalCompositeOperation = s.img_blend || 'source-over';
    const scale = s.img_scale || 1;
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    ctx.restore();
  }

  /** Grain overlay */
  _drawGrain(ctx, W, H, amount) {
    const imageData = ctx.getImageData(0, 0, W, H);
    const data = imageData.data;
    const strength = amount * 60;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * strength;
      data[i]     = Math.min(255, Math.max(0, data[i]     + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  /** Store reference to imported image element */
  setImage(imgEl) {
    this._imageEl = imgEl;
  }

  clearImage() {
    this._imageEl = null;
  }
}

export const engine = new Engine(document.getElementById('art'));
