/**
 * Voronoi — nearest-neighbor distance field in a fragment shader.
 * For each pixel, finds the two nearest seed points and renders an edge
 * where the distance difference is small.
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

// MAX_CELLS must match the JS-side cap
const MAX_CELLS = 200;

const FRAG_SRC = /* glsl */`
precision highp float;

varying vec2 v_uv;

uniform int   u_numCells;
uniform vec2  u_seeds[${MAX_CELLS}];
uniform vec2  u_resolution;
uniform float u_time;
uniform int   u_colorMode;
uniform bool  u_transparent;

void main() {
  // Correct aspect so Voronoi cells look even
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = v_uv * aspect;

  float d1 = 1e9; // nearest
  float d2 = 1e9; // second-nearest

  for (int i = 0; i < ${MAX_CELLS}; i++) {
    if (i >= u_numCells) break;
    vec2 seed = u_seeds[i] * aspect;
    float d = distance(p, seed);
    if (d < d1) {
      d2 = d1;
      d1 = d;
    } else if (d < d2) {
      d2 = d;
    }
  }

  // Edge: where d2 - d1 is small
  float edge = 1.0 - smoothstep(0.0, 0.012 * aspect.x, d2 - d1);

  // ── Colour ─────────────────────────────────────────────────────────────────
  vec3 col;
  if (u_colorMode == 0) {
    col = vec3(edge);
  } else if (u_colorMode == 1) {
    col = vec3(1.0 - edge);
  } else {
    col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), edge);
  }

  float alpha;
  if (u_transparent) {
    alpha = edge;
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

/** Deterministic pseudo-random from two ints */
function hash(a, b) {
  let x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/** Generate seed positions deterministically, then animate slowly */
function buildSeeds(n, time) {
  const seeds = new Float32Array(MAX_CELLS * 2);
  for (let i = 0; i < n; i++) {
    // Base position from hash
    const bx = hash(i, 0);
    const by = hash(i, 1);
    // Drift direction + speed per seed
    const dx = (hash(i, 2) - 0.5) * 2;
    const dy = (hash(i, 3) - 0.5) * 2;
    const speed = 0.02 + hash(i, 4) * 0.03;
    const freq  = 0.3  + hash(i, 5) * 0.4;
    // Oscillate around base — wrap in [0,1]
    seeds[i * 2]     = ((bx + Math.sin(time * freq * dx) * speed + 10) % 1);
    seeds[i * 2 + 1] = ((by + Math.cos(time * freq * dy) * speed + 10) % 1);
  }
  return seeds;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class Voronoi extends Algorithm {
  constructor(engine) {
    super(engine);
    this._prog = null;
    this._quad = null;
    this._gl   = null;
  }

  get metadata() {
    return {
      name: 'Voronoi',
      eq:   'Nearest-neighbor cells',
      cat:  'Nature',
      desc: 'Space divided by proximity. Giraffe skin, dragonfly wings, dried mud, soap bubbles.',
    };
  }

  get params() {
    return [
      { id: 'voronoi_cells', label: 'Cells', min: 5, max: 200, step: 1 },
    ];
  }

  get detailParam() {
    return { id: 'voronoi_cells', min: 5, max: 200, step: 5 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.voronoi_cells = Math.round(5 + mx * 195);
    };
  }

  animate(s) {
    // Seeds move on their own; just mark dirty so render keeps running
    // (animate is called each frame while playing)
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

    const n = Math.min(Math.round(s.voronoi_cells ?? 50), MAX_CELLS);
    const seeds = buildSeeds(n, s.time ?? 0);

    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this._prog;
    gl.useProgram(prog);

    const cmLoc = gl.getUniformLocation(prog, 'u_colorMode');
    const trLoc = gl.getUniformLocation(prog, 'u_transparent');
    const nLoc  = gl.getUniformLocation(prog, 'u_numCells');
    const sLoc  = gl.getUniformLocation(prog, 'u_seeds');

    if (cmLoc !== null) gl.uniform1i(cmLoc, colorModeIndex(s.colorMode));
    if (trLoc !== null) gl.uniform1i(trLoc, s.transparent ? 1 : 0);
    if (nLoc  !== null) gl.uniform1i(nLoc,  n);
    if (sLoc  !== null) gl.uniform2fv(sLoc, seeds);

    this._quad.render(gl, prog, {
      u_resolution: [glCanvas.width, glCanvas.height],
      u_time:       s.time ?? 0,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG() { return null; }
}
