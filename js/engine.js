/**
 * Engine — manages the full 2D render pipeline.
 * Pipeline per frame:
 *   clear → image-behind → algorithm.render() → symmetry → post-process → image-front → grain
 */

import { state } from './state.js';
import { applySymmetry } from './effects/symmetry.js';
import { postProcess } from './effects/post-process.js';
import { applyGrain } from './effects/grain.js';
import { drawImageLayer } from './interaction/image-layer.js';

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

    // ── 1. Clear ───────────────────────────────────────────────────────────────
    if (s.transparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = this.bg();
      ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Image — behind layer ────────────────────────────────────────────────
    if (s.img_layer === 'behind') {
      drawImageLayer(ctx, W, H, s);
    }

    // ── 3. Algorithm ───────────────────────────────────────────────────────────
    if (this._algorithm) {
      if (s.sym && s.folds > 1) {
        // Render to offscreen canvas, then composite with symmetry
        const offscreen = document.createElement('canvas');
        offscreen.width  = W;
        offscreen.height = H;
        const offCtx = offscreen.getContext('2d');
        this._algorithm.render(offCtx, W, H, s);

        // Clear main canvas before compositing
        if (s.transparent) {
          ctx.clearRect(0, 0, W, H);
        } else {
          ctx.fillStyle = this.bg();
          ctx.fillRect(0, 0, W, H);
        }

        applySymmetry(offscreen, ctx, W, H, s.folds);
      } else {
        // Direct render to main context
        this._algorithm.render(ctx, W, H, s);
      }
    }

    // ── 4. Post-process: tint, glow, blur ─────────────────────────────────────
    postProcess(this.canvas, ctx, W, H, s);

    // ── 5. Image — front layer ────────────────────────────────────────────────
    if (s.img_layer === 'front') {
      drawImageLayer(ctx, W, H, s);
    }

    // ── 6. Grain ──────────────────────────────────────────────────────────────
    if (s.grain > 0) {
      applyGrain(ctx, W, H, s.grain);
    }

    // Clear any CSS filter previously applied
    this.canvas.style.filter = '';
  }
}

export const engine = new Engine(document.getElementById('art'));
