/**
 * Chladni figures — vibration nodal patterns.
 * cos(m·π·x)·cos(n·π·y) − cos(n·π·x)·cos(m·π·y)
 * Rendered in a WebGL fragment shader. Pixels near zero form the nodal lines.
 */

import { Algorithm } from '../base.js';
import { createProgram } from '../../webgl/context.js';
import { Quad } from '../../webgl/quad.js';

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

uniform float u_m;
uniform float u_n;
uniform int   u_colorMode;
uniform bool  u_transparent;

const float PI = 3.14159265358979323846;

void main() {
  // Map [0,1] uv to [-1,1] domain
  vec2 p = v_uv * 2.0 - 1.0;

  float val = cos(u_m * PI * p.x) * cos(u_n * PI * p.y)
            - cos(u_n * PI * p.x) * cos(u_m * PI * p.y);

  // Nodal lines are where val ≈ 0
  // Use abs(val) to find distance from node, then threshold
  float dist = abs(val);
  // Soft band around zero — make lines ~1.5% wide
  float line = 1.0 - smoothstep(0.0, 0.06, dist);

  // ── Colour mode ────────────────────────────────────────────────────────────
  vec3 col;
  if (u_colorMode == 0) {
    // wb: nodal lines = white, background = black
    col = vec3(line);
  } else if (u_colorMode == 1) {
    // bw: nodal lines = black, background = cream
    col = vec3(1.0 - line);
  } else {
    // silver
    col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), line);
  }

  // ── Transparency ───────────────────────────────────────────────────────────
  float alpha;
  if (u_transparent) {
    // Only nodal lines are opaque
    alpha = line;
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

export class Chladni extends Algorithm {
  constructor(engine) {
    super(engine);
    this._prog = null;
    this._quad = null;
    this._gl   = null;
  }

  get metadata() {
    return {
      name: 'Chladni',
      eq:   'cos(mπx)cos(nπy) ± cos(nπx)cos(mπy)',
      cat:  'Physics',
      desc: 'Vibration patterns — sand on a resonating plate. Sound made visible.',
    };
  }

  get params() {
    return [
      { id: 'chladni_m', label: 'Mode M', min: 1, max: 15, step: 1 },
      { id: 'chladni_n', label: 'Mode N', min: 1, max: 15, step: 1 },
    ];
  }

  get detailParam() {
    return { id: 'chladni_m', min: 1, max: 15, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.chladni_m = Math.round(1 + mx * 14);
      s.chladni_n = Math.round(1 + my * 14);
    };
  }

  animate(s) {
    // Slowly drift through mode space
    const t = s.time * 0.15;
    s.chladni_m = Math.max(1, Math.min(15, Math.round(8 + Math.sin(t * 0.7) * 6)));
    s.chladni_n = Math.max(1, Math.min(15, Math.round(8 + Math.cos(t * 1.1) * 6)));
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
      u_m: s.chladni_m ?? 5,
      u_n: s.chladni_n ?? 3,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG() { return null; }
}
