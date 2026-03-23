/**
 * World — the unified context object passed to every algorithm.
 * Assembles all infrastructure modules.
 */

import { Space } from './space.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';

export class World {
  constructor(engine) {
    this.engine = engine;
    this.W = 0;
    this.H = 0;
    this.state = null;

    // Modules (added as they're built)
    this.space = new Space();
    this.camera = new Camera(engine);
    this.physics = null;
    this.gesture = null;
    this.renderer = new Renderer();
    this.time = null;
  }

  /** Called once per frame before algorithm render */
  update(W, H, state) {
    this.W = W;
    this.H = H;
    this.state = state;

    // Update modules that exist
    if (this.space) this.space.update(W, H, state);
    if (this.camera) this.camera.update();
    if (this.physics) this.physics.step();
    if (this.time) this.time.update();
    if (this.gesture) this.gesture.update();
    if (this.renderer) this.renderer.update(W, H, this.space);
  }

  /** Called when switching algorithms — resets algorithm-specific module state */
  resetForAlgo() {
    if (this.physics) this.physics.clear();
    if (this.time) this.time.reset();
  }
}
