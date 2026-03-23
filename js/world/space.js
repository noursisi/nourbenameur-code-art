/**
 * Space — spatial canvas with world coordinate system.
 * Reads zoom/pan from state. Provides coordinate transforms and viewport info.
 */

export class Space {
  constructor() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.W = 0;
    this.H = 0;

    // Momentum state
    this._velX = 0;
    this._velY = 0;
    this._velZoom = 0;
    this._friction = 0.92;
  }

  /** Detail level — higher zoom = more detail (1 at default, increases with zoom) */
  get detail() {
    return Math.max(1, Math.log2(this.zoom) + 1);
  }

  /** Visible region in world coordinates */
  get viewport() {
    const halfW = (this.W / 2) / this.zoom;
    const halfH = (this.H / 2) / this.zoom;
    const cx = this.panX;
    const cy = this.panY;
    return {
      left: cx - halfW,
      right: cx + halfW,
      top: cy - halfH,
      bottom: cy + halfH,
      width: halfW * 2,
      height: halfH * 2,
    };
  }

  /** Convert screen pixel coordinate to world coordinate */
  toWorld(screenX, screenY) {
    return {
      x: (screenX - this.W / 2) / this.zoom + this.panX,
      y: (screenY - this.H / 2) / this.zoom + this.panY,
    };
  }

  /** Convert world coordinate to screen pixel coordinate */
  toScreen(worldX, worldY) {
    return {
      x: (worldX - this.panX) * this.zoom + this.W / 2,
      y: (worldY - this.panY) * this.zoom + this.H / 2,
    };
  }

  /** Called each frame — sync with state */
  update(W, H, state) {
    this.W = W;
    this.H = H;
    this.zoom = state.camZoom || 1;
    this.panX = state.camPanX || 0;
    this.panY = state.camPanY || 0;
  }
}
