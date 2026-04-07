/**
 * Julia Set algorithm — rendered via WebGL.
 * Per-pixel iteration of z^n + c in the fragment shader.
 * Supports: power parameter (z^n, n=2-5), 5 color palettes,
 * orbit trap modes, and up to 500 iterations.
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
uniform float u_power;
uniform int   u_palette;    // 0=classic, 1=fire, 2=ocean, 3=aurora, 4=mono smooth
uniform int   u_trap;       // 0=none, 1=circle, 2=cross, 3=point

// ── Complex power (polar form) ──────────────────────────────────────────────

vec2 cpow(vec2 z, float n) {
  float r = length(z);
  float theta = atan(z.y, z.x);
  float rn = pow(r, n);
  return vec2(rn * cos(n * theta), rn * sin(n * theta));
}

// ── Color palettes ──────────────────────────────────────────────────────────

vec3 palette(float t, int pal) {
  if (pal == 1) return vec3(min(1.0, t * 3.0), t * t, t * t * t * 0.5); // Fire
  if (pal == 2) return vec3(t * t * 0.3, t * 0.7, min(1.0, t * 1.5));   // Ocean
  if (pal == 3) return vec3(                                               // Aurora
    0.5 + 0.5 * sin(t * 6.28),
    0.5 + 0.5 * sin(t * 6.28 + 2.09),
    0.5 + 0.5 * sin(t * 6.28 + 4.19)
  );
  if (pal == 4) return vec3(t); // Monochrome smooth
  return vec3(t);               // Classic (default)
}

// ── Iteration ───────────────────────────────────────────────────────────────

void julia(vec2 z, vec2 c, out float escapeVal, out float trapVal) {
  float iter = 0.0;
  float maxI = u_maxIter;
  float trapDist = 1e10;

  for (int i = 0; i < 500; i++) {
    if (float(i) >= maxI) break;
    z = cpow(z, u_power) + c;

    // Orbit trap tracking
    if (u_trap == 1) trapDist = min(trapDist, abs(length(z) - 1.0)); // circle
    else if (u_trap == 2) trapDist = min(trapDist, min(abs(z.x), abs(z.y))); // cross
    else if (u_trap == 3) trapDist = min(trapDist, length(z)); // point

    if (dot(z, z) > 4.0) {
      iter = float(i);
      // Smooth colouring
      escapeVal = iter - log2(log2(dot(z, z))) + 4.0;
      trapVal = trapDist;
      return;
    }
    iter = float(i) + 1.0;
  }
  escapeVal = 0.0; // inside the set
  trapVal = trapDist;
}

void main() {
  // Map pixel to math coordinates
  vec2 uv = v_uv;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 z = (uv - 0.5) * aspect * u_scale;
  z -= u_pan / u_resolution * aspect * u_scale;

  float raw;
  float trapVal;
  julia(z, u_c, raw, trapVal);

  float brightness;
  if (raw == 0.0) {
    brightness = 0.0;
  } else {
    brightness = clamp(pow(raw / u_maxIter, 0.45), 0.0, 1.0);
  }

  // When orbit trap is active, mix trap distance into brightness
  float trapBrightness = brightness;
  if (u_trap > 0 && raw != 0.0) {
    float td = clamp(trapVal * 2.0, 0.0, 1.0);
    trapBrightness = mix(brightness, 1.0 - td, 0.6);
  }

  // ── Colour mode / palette ────────────────────────────────────────────────
  vec3 col;
  if (u_palette > 0) {
    // Named palette — ignores colorMode, uses trap-influenced brightness
    col = (raw == 0.0) ? vec3(0.0) : palette(trapBrightness, u_palette);
  } else {
    // Classic: obey colorMode
    float b = trapBrightness;
    if (u_colorMode == 0) {
      col = vec3(b);
    } else if (u_colorMode == 1) {
      col = vec3(1.0 - b);
    } else {
      col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), b);
    }
  }

  // ── Transparency mode ───────────────────────────────────────────────────
  float alpha;
  if (u_transparent) {
    alpha = trapBrightness;
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
      eq:   'z = zⁿ + c',
      cat:  'Fractals',
      desc: 'Infinite complexity from iterating zⁿ+c. Power, palette, and orbit traps give each render a unique character.',
    };
  }

  get params() {
    return [
      { id: 'julia_cr',      label: 'Real(c)',    min: -2,  max: 2,   step: 0.005 },
      { id: 'julia_ci',      label: 'Imag(c)',    min: -2,  max: 2,   step: 0.005 },
      { id: 'julia_iter',    label: 'Iterations', min: 20,  max: 500, step: 1     },
      { id: 'julia_scale',   label: 'Math Zoom',  min: 0.5, max: 20,  step: 0.5   },
      { id: 'julia_power',   label: 'Power',      min: 2,   max: 5,   step: 1     },
      { id: 'julia_palette', label: 'Palette',    min: 0,   max: 4,   step: 1     },
      { id: 'julia_trap',    label: 'Orbit Trap', min: 0,   max: 3,   step: 1     },
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

  animate(world) { const { state: s } = world;
    const t = s.time * 0.3;
    s.julia_cr = Math.cos(t * 1.1) * 0.8 - 0.2;
    s.julia_ci = Math.sin(t * 0.7) * 0.6 + 0.27;
  }

  randomize(state, set) {
    const presets = [
      { cr: -0.7269, ci:  0.1889 },
      { cr: -0.8,    ci:  0.156  },
      { cr:  0.285,  ci:  0.01   },
      { cr: -0.4,    ci:  0.6    },
      { cr:  0.355,  ci:  0.355  },
      { cr: -0.54,   ci:  0.54   },
      { cr: -0.1,    ci:  0.651  },
      { cr: -1.476,  ci:  0.0    },
    ];
    const p = presets[Math.floor(Math.random() * presets.length)];
    set('julia_cr',      p.cr + (Math.random() - 0.5) * 0.05);
    set('julia_ci',      p.ci + (Math.random() - 0.5) * 0.05);
    set('julia_power',   Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 2 : 2);
    set('julia_palette', Math.floor(Math.random() * 5));
    set('julia_iter',    100 + Math.floor(Math.random() * 200));
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const glCanvas = this.engine.getGLCanvas();
    const gl       = this.engine.getGL();

    if (!gl) {
      ctx.fillStyle = this.engine.bg(s);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = this.engine.fg(s);
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

    if (!this._prog) return;

    const pW = glCanvas.width;
    const pH = glCanvas.height;

    gl.viewport(0, 0, pW, pH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this._prog;
    gl.useProgram(prog);

    // Integer / bool uniforms (not handled by Quad's float helper)
    const cmLoc  = gl.getUniformLocation(prog, 'u_colorMode');
    const trLoc  = gl.getUniformLocation(prog, 'u_transparent');
    const palLoc = gl.getUniformLocation(prog, 'u_palette');
    const trapLoc = gl.getUniformLocation(prog, 'u_trap');
    if (cmLoc  !== null) gl.uniform1i(cmLoc,  colorModeIndex(s.colorMode));
    if (trLoc  !== null) gl.uniform1i(trLoc,  s.transparent ? 1 : 0);
    if (palLoc !== null) gl.uniform1i(palLoc, s.julia_palette ?? 0);
    if (trapLoc !== null) gl.uniform1i(trapLoc, s.julia_trap ?? 0);

    // Float uniforms via Quad helper
    this._quad.render(gl, prog, {
      u_resolution: [pW, pH],
      u_c:          [s.julia_cr ?? -0.7, s.julia_ci ?? 0.27],
      u_maxIter:    s.julia_iter ?? 80,
      u_scale:      s.julia_scale ?? 2.5,
      u_pan:        [s.camPanX ?? 0, -(s.camPanY ?? 0)],
      u_power:      s.julia_power ?? 2,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG(world) {
    return null;
  }
}
