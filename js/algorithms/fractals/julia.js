/**
 * Julia Set algorithm — rendered via WebGL.
 * Per-pixel iteration of z² + c in the fragment shader.
 */

import { Algorithm } from '../base.js';
import { createProgram } from '../../webgl/context.js';
import { Quad } from '../../webgl/quad.js';

// ── Shaders ──────────────────────────────────────────────────────────────────

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
uniform vec2  u_c;
uniform float u_maxIter;
uniform float u_scale;
uniform vec2  u_pan;
uniform int   u_colorMode;  // 0=wb, 1=bw, 2=silver
uniform bool  u_transparent;

// ── Iteration ───────────────────────────────────────────────────────────────

float julia(vec2 z, vec2 c) {
  float iter = 0.0;
  float maxI = u_maxIter;
  for (int i = 0; i < 300; i++) {
    if (float(i) >= maxI) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) {
      iter = float(i);
      // Smooth colouring
      return iter - log2(log2(dot(z, z))) + 4.0;
    }
    iter = float(i) + 1.0;
  }
  return 0.0; // inside the set
}

void main() {
  // Map pixel to math coordinates
  vec2 uv = v_uv;
  // aspect-correct, centred at 0.5,0.5
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 z = (uv - 0.5) * aspect * u_scale;
  // Apply pan (pan is in pixels, convert to math coords)
  z -= u_pan / u_resolution * aspect * u_scale;

  float raw = julia(z, u_c);

  float brightness;
  if (raw == 0.0) {
    // Inside the Julia set
    brightness = 0.0;
  } else {
    // Normalised escape — logarithmic scale for smooth bands
    brightness = clamp(pow(raw / u_maxIter, 0.45), 0.0, 1.0);
  }

  // ── Colour mode ─────────────────────────────────────────────────────────
  vec3 col;
  if (u_colorMode == 0) {
    // wb: white on black
    col = vec3(brightness);
  } else if (u_colorMode == 1) {
    // bw: black on cream — invert
    col = vec3(1.0 - brightness);
  } else {
    // silver: cool grey palette
    col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), brightness);
  }

  // ── Transparency mode ───────────────────────────────────────────────────
  float alpha;
  if (u_transparent) {
    // Dark (inside set) = transparent; bright fractal detail = opaque
    // No gradient halo — hard-ish falloff
    alpha = brightness;
  } else {
    alpha = 1.0;
  }

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

// ── Colour mode index mapping ────────────────────────────────────────────────

function colorModeIndex(mode) {
  if (mode === 'bw')     return 1;
  if (mode === 'silver') return 2;
  return 0; // 'wb' default
}

// ── Main class ───────────────────────────────────────────────────────────────

export class JuliaSet extends Algorithm {
  constructor(engine) {
    super(engine);
    this._prog = null;
    this._quad = null;
    this._gl   = null;
  }

  get metadata() {
    return {
      name: 'Julia Set',
      eq:   'z = z² + c',
      cat:  'Fractals',
      desc: 'Infinite complexity from iterating z²+c. Each pixel's colour is determined by how quickly the orbit escapes to infinity.',
    };
  }

  get params() {
    return [
      { id: 'julia_cr',   label: 'Real(c)',    min: -2,  max: 2,   step: 0.005 },
      { id: 'julia_ci',   label: 'Imag(c)',    min: -2,  max: 2,   step: 0.005 },
      { id: 'julia_iter', label: 'Iterations', min: 20,  max: 300, step: 1     },
      { id: 'julia_scale',label: 'Math Zoom',  min: 0.5, max: 20,  step: 0.5   },
    ];
  }

  get detailParam() {
    return { id: 'julia_scale', min: 0.5, max: 20, step: 0.3 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.julia_cr = (mx - 0.5) * 3;
      s.julia_ci = (my - 0.5) * 3;
    };
  }

  animate(s) {
    // Orbit c through interesting parameter space
    const t = s.time * 0.3;
    s.julia_cr = Math.cos(t * 1.1) * 0.8 - 0.2;
    s.julia_ci = Math.sin(t * 0.7) * 0.6 + 0.27;
  }

  render(ctx, W, H, s) {
    const glCanvas = this.engine.getGLCanvas();
    const gl       = this.engine.getGL();

    if (!gl) {
      // WebGL unavailable — fallback message
      ctx.fillStyle = this.engine.bg();
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = this.engine.fg();
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WebGL not available', W / 2, H / 2);
      return;
    }

    // Lazily compile shader
    if (!this._prog || this._gl !== gl) {
      this._gl = gl;
      this._prog = createProgram(gl, VERT_SRC, FRAG_SRC);
      this._quad = new Quad(gl);
    }

    if (!this._prog) return; // compile failed

    // Match GL canvas size to physical canvas
    const pW = glCanvas.width;
    const pH = glCanvas.height;

    gl.viewport(0, 0, pW, pH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for transparent mode
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this._prog;
    gl.useProgram(prog);

    // Set typed uniforms manually for int/bool types
    const cmLoc = gl.getUniformLocation(prog, 'u_colorMode');
    const trLoc = gl.getUniformLocation(prog, 'u_transparent');
    if (cmLoc !== null) gl.uniform1i(cmLoc, colorModeIndex(s.colorMode));
    if (trLoc !== null) gl.uniform1i(trLoc, s.transparent ? 1 : 0);

    // Render via Quad (float uniforms)
    this._quad.render(gl, prog, {
      u_resolution: [pW, pH],
      u_c:          [s.julia_cr ?? -0.7, s.julia_ci ?? 0.27],
      u_maxIter:    s.julia_iter ?? 80,
      u_scale:      s.julia_scale ?? 2.5,
      u_pan:        [s.camPanX ?? 0, -(s.camPanY ?? 0)], // invert Y for GL coords
    });

    // Composite the GL canvas onto the main 2D canvas
    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG() {
    return null; // pixel-based, no SVG export
  }
}
