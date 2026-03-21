/**
 * Pixel Organic — FBM noise field thresholded and snapped to a pixel grid.
 * Smooth organic forms forced through a rigid pixel grid.
 */

import { Algorithm } from '../base.js';
import { createProgram } from '../../webgl/context.js';
import { Quad } from '../../webgl/quad.js';
import { NOISE_2D, FBM } from '../../webgl/shader-lib.js';

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */`
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_SRC = /* glsl */`
precision highp float;

varying vec2 v_uv;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_pixelSize;
uniform float u_threshold;
uniform float u_scale;
uniform int   u_colorMode;
uniform bool  u_transparent;

${NOISE_2D}
${FBM}

void main() {
  // Snap UV to pixel grid
  vec2 snapped = floor(v_uv * u_resolution / u_pixelSize) * u_pixelSize / u_resolution;

  // Sample FBM at snapped coordinates with drift
  vec2 p = snapped * u_resolution * u_scale + vec2(u_time * 0.4, u_time * 0.25);
  float n = fbm(p);

  // Map noise from [-1,1] → [0,1]
  float v = n * 0.5 + 0.5;

  // Threshold: above → foreground, below → background
  float fg = step(u_threshold, v);

  // ── Colour mode ────────────────────────────────────────────────────────────
  vec3 col;
  if (u_colorMode == 0) {
    // wb: foreground = white
    col = vec3(fg);
  } else if (u_colorMode == 1) {
    // bw: foreground = black, background = cream
    col = vec3(1.0 - fg);
  } else {
    // silver
    col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), fg);
  }

  float alpha;
  if (u_transparent) {
    alpha = fg;
  } else {
    alpha = 1.0;
  }

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function colorModeIndex(mode) {
  if (mode === 'bw')     return 1;
  if (mode === 'silver') return 2;
  return 0;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class PixelOrganic extends Algorithm {
  constructor(engine) {
    super(engine);
    this._prog = null;
    this._quad = null;
    this._gl   = null;
  }

  get metadata() {
    return {
      name: 'Pixel Organic',
      eq:   'Noise → pixel snap',
      cat:  'Data Art',
      desc: 'Smooth organic forms forced through a rigid pixel grid. Digital tension.',
    };
  }

  get params() {
    return [
      { id: 'pixel_res',       label: 'Pixel Size', min: 3,     max: 20,   step: 1     },
      { id: 'pixel_threshold', label: 'Threshold',  min: 0.1,   max: 0.9,  step: 0.05  },
      { id: 'pixel_scale',     label: 'Scale',      min: 0.003, max: 0.03, step: 0.001 },
    ];
  }

  get detailParam() {
    // Smaller pixel size = more detail, so reversed step
    return { id: 'pixel_res', min: 3, max: 20, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.pixel_threshold = 0.1 + mx * 0.8;
      s.pixel_scale     = 0.003 + my * 0.027;
    };
  }

  animate(s) {
    // Drift is driven by s.time in the shader — just mark dirty
  }

  render(ctx, W, H, s) {
    const glCanvas = this.engine.getGLCanvas();
    const gl       = this.engine.getGL();

    if (!gl) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WebGL not available', W / 2, H / 2);
      return;
    }

    if (!this._prog || this._gl !== gl) {
      this._gl   = gl;
      this._prog = createProgram(gl, VERT_SRC, FRAG_SRC);
      this._quad = new Quad(gl);
    }
    if (!this._prog) return;

    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this._prog;
    gl.useProgram(prog);

    const cmLoc = gl.getUniformLocation(prog, 'u_colorMode');
    const trLoc = gl.getUniformLocation(prog, 'u_transparent');
    if (cmLoc !== null) gl.uniform1i(cmLoc, colorModeIndex(s.colorMode));
    if (trLoc !== null) gl.uniform1i(trLoc, s.transparent ? 1 : 0);

    this._quad.render(gl, prog, {
      u_resolution: [glCanvas.width, glCanvas.height],
      u_time:       s.time ?? 0,
      u_pixelSize:  s.pixel_res       ?? 8,
      u_threshold:  s.pixel_threshold ?? 0.5,
      u_scale:      s.pixel_scale     ?? 0.01,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG() { return null; }
}
