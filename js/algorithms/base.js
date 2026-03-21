/**
 * Algorithm base class.
 * All algorithms extend this and override the documented methods.
 */

export class Algorithm {
  /**
   * @param {import('../engine.js').Engine} engine
   */
  constructor(engine) {
    this.engine = engine;
  }

  /**
   * Algorithm metadata for UI display.
   * @returns {{ name: string, eq: string, cat: string, desc: string }}
   */
  get metadata() {
    return { name: '', eq: '', cat: '', desc: '' };
  }

  /**
   * Parameter descriptors used to auto-generate sliders.
   * @returns {Array<{id: string, label: string, min: number, max: number, step: number}>}
   */
  get params() {
    return [];
  }

  /**
   * Optional cursor-to-param mapping.
   * @returns {Function|null} - (mx, my, state) => void, or null
   */
  get cursorMap() {
    return null;
  }

  /**
   * The param that responds to scroll in 'detail' mode.
   * @returns {{ id: string, min: number, max: number, step: number }|null}
   */
  get detailParam() {
    return null;
  }

  /**
   * Called every frame while state.playing === true, before render.
   * @param {object} state
   */
  animate(state) {}

  /**
   * Draw the algorithm to the 2D canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W  - CSS pixel width
   * @param {number} H  - CSS pixel height
   * @param {object} state
   */
  render(ctx, W, H, state) {}

  /**
   * Return an SVG string representing the current render, or null.
   * @param {number} W
   * @param {number} H
   * @param {object} state
   * @returns {string|null}
   */
  collectSVG(W, H, state) {
    return null;
  }

  /**
   * Randomize algorithm-specific params within valid ranges.
   * Default: pick random values for each param.
   * @param {object} state
   * @param {Function} setFn - set(key, val)
   */
  randomize(state, setFn) {
    this.params.forEach(p => {
      const steps = Math.round((p.max - p.min) / p.step);
      const v = p.min + Math.round(Math.random() * steps) * p.step;
      setFn(p.id, parseFloat(v.toFixed(6)));
    });
  }
}
