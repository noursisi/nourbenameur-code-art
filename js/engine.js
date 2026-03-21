/**
 * Engine — manages the full 2D render pipeline.
 * Pipeline per frame (multi-layer):
 *   clear → for each layer: [image-processor → algorithm] with blend/opacity → post-process → grain
 * Legacy single-layer pipeline still works when layers are not used.
 */

import { state } from './state.js';
import { applySymmetry } from './effects/symmetry.js';
import { postProcess } from './effects/post-process.js';
import { applyGrain } from './effects/grain.js';
import { drawImageLayer } from './interaction/image-layer.js';
import { imageProcessor } from './interaction/image-processor.js';
import { getLayers } from './layers.js';

class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0;
    this.H = 0;
    this._algorithm = null;
    this._glCanvas = null;
    this._glCtx = null;
    /** @type {Map<number, object>} layer id → algorithm instance */
    this._layerAlgos = new Map();
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

  /** Set the active algorithm instance (for the active layer / legacy) */
  setAlgorithm(algo) {
    this._algorithm = algo;
  }

  /** Set an algorithm for a specific layer */
  setLayerAlgorithm(layerId, algo) {
    this._layerAlgos.set(layerId, algo);
  }

  /** Get algorithm for a layer */
  getLayerAlgorithm(layerId) {
    return this._layerAlgos.get(layerId) || null;
  }

  /** Get background color — uses direct color if set, falls back to colorMode */
  bg() {
    if (state.bgColor) return state.bgColor;
    switch (state.colorMode) {
      case 'bw':     return '#f0efe8';
      case 'silver': return '#0a0a0a';
      default:       return '#000000';
    }
  }

  /** Get foreground/shape color — uses direct color if set, falls back to colorMode */
  fg() {
    if (state.fgColor) return state.fgColor;
    switch (state.colorMode) {
      case 'bw':     return '#000000';
      case 'silver': return '#bbbbbb';
      default:       return '#ffffff';
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

    const layers = getLayers();
    const useMultiLayer = layers && layers.length > 1;

    // ── 1. Clear ───────────────────────────────────────────────────────────────
    if (s.transparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = this.bg();
      ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Image — behind layer (legacy) ─────────────────────────────────────
    if (s.img_layer === 'behind') {
      drawImageLayer(ctx, W, H, s);
    }

    // ── 3. Image Processor (behind algorithm if mix mode) ────────────────────
    if (s.ip_enabled && imageProcessor.hasSource() && !s.ip_mixWithAlgo) {
      imageProcessor.render(this, ctx, W, H, s);
    }

    // ── 4. Layers / Algorithm ───────────────────────────────────────────────
    if (useMultiLayer) {
      this._renderMultiLayer(ctx, W, H, s, layers);
    } else {
      this._renderSingleLayer(ctx, W, H, s);
    }

    // ── 5. Image Processor (on top if mix mode) ─────────────────────────────
    if (s.ip_enabled && imageProcessor.hasSource() && s.ip_mixWithAlgo) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'screen';
      imageProcessor.render(this, ctx, W, H, s);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── 6. Post-process: tint, glow, blur ─────────────────────────────────────
    postProcess(this.canvas, ctx, W, H, s);

    // ── 7. Image — front layer (legacy) ────────────────────────────────────────
    if (s.img_layer === 'front') {
      drawImageLayer(ctx, W, H, s);
    }

    // ── 8. Grain ──────────────────────────────────────────────────────────────
    if (s.grain > 0) {
      applyGrain(ctx, W, H, s.grain);
    }

    // Clear any CSS filter previously applied
    this.canvas.style.filter = '';
  }

  /** Render a single algorithm (legacy path, also used for 1-layer setups) */
  _renderSingleLayer(ctx, W, H, s) {
    if (!this._algorithm) return;

    if (s.sym && s.folds > 1) {
      const offscreen = document.createElement('canvas');
      offscreen.width  = W;
      offscreen.height = H;
      const offCtx = offscreen.getContext('2d');
      this._algorithm.render(offCtx, W, H, s);

      if (s.transparent) {
        ctx.clearRect(0, 0, W, H);
      } else {
        ctx.fillStyle = this.bg();
        ctx.fillRect(0, 0, W, H);
      }

      applySymmetry(offscreen, ctx, W, H, s.folds);
    } else {
      this._algorithm.render(ctx, W, H, s);
    }
  }

  /** Render multiple layers bottom-to-top */
  _renderMultiLayer(ctx, W, H, s, layers) {
    for (const layer of layers) {
      if (!layer.visible) continue;

      const algo = this._layerAlgos.get(layer.id);
      if (!algo) continue;

      // Render to offscreen
      const offscreen = document.createElement('canvas');
      offscreen.width = W;
      offscreen.height = H;
      const offCtx = offscreen.getContext('2d');

      // Render image processor for this layer if enabled
      if (layer.useImageProcessor && s.ip_enabled && imageProcessor.hasSource()) {
        imageProcessor.render(this, offCtx, W, H, s);
      }

      // Render algorithm
      algo.render(offCtx, W, H, s);

      // Apply symmetry if enabled
      if (s.sym && s.folds > 1) {
        const symCanvas = document.createElement('canvas');
        symCanvas.width = W;
        symCanvas.height = H;
        const symCtx = symCanvas.getContext('2d');
        applySymmetry(offscreen, symCtx, W, H, s.folds);
        // Composite with blend mode and opacity
        ctx.save();
        ctx.globalCompositeOperation = layer.blend || 'source-over';
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.drawImage(symCanvas, 0, 0);
        ctx.restore();
      } else {
        // Composite with blend mode and opacity
        ctx.save();
        ctx.globalCompositeOperation = layer.blend || 'source-over';
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.drawImage(offscreen, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

export const engine = new Engine(document.getElementById('art'));
