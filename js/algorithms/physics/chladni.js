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
uniform int   u_palette;
uniform float u_lineWidth;
uniform int   u_invert;

const float PI = 3.14159265358979323846;

vec3 chladniPalette(float brightness, int pal) {
    if (pal == 1) { // Heat
        return vec3(brightness, brightness * 0.4, brightness * 0.1);
    }
    if (pal == 2) { // Ocean
        return vec3(brightness * 0.2, brightness * 0.5, brightness);
    }
    if (pal == 3) { // Neon
        return vec3(brightness * 0.6, brightness, brightness * 1.5);
    }
    return vec3(brightness); // Mono
}

void main() {
  // Map [0,1] uv to [-1,1] domain
  vec2 p = v_uv * 2.0 - 1.0;

  float val = cos(u_m * PI * p.x) * cos(u_n * PI * p.y)
            - cos(u_n * PI * p.x) * cos(u_m * PI * p.y);

  // Nodal lines are where val ≈ 0
  float dist = abs(val);
  float line = 1.0 - smoothstep(0.0, u_lineWidth, dist);

  // Apply invert: swap nodal lines and anti-nodal regions
  float brightness;
  if (u_invert == 1) {
    brightness = 1.0 - line;
  } else {
    brightness = line;
  }

  // ── Colour mode ────────────────────────────────────────────────────────────
  vec3 col;
  if (u_colorMode == 0) {
    // wb: nodal lines = white, background = black
    col = chladniPalette(brightness, u_palette);
  } else if (u_colorMode == 1) {
    // bw: nodal lines = black, background = cream
    col = vec3(1.0) - chladniPalette(brightness, u_palette) * 0.9;
  } else {
    // silver
    col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), brightness);
  }

  // ── Transparency ───────────────────────────────────────────────────────────
  float alpha;
  if (u_transparent) {
    alpha = brightness;
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
      { id: 'chladni_m',         label: 'Mode M',    min: 1,    max: 15,   step: 1     },
      { id: 'chladni_n',         label: 'Mode N',    min: 1,    max: 15,   step: 1     },
      { id: 'chladni_palette',   label: 'Palette',   min: 0,    max: 3,    step: 1     },
      { id: 'chladni_lineWidth', label: 'Line Width',min: 0.01, max: 0.15, step: 0.005 },
      { id: 'chladni_invert',    label: 'Invert',    min: 0,    max: 1,    step: 1     },
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

  animate(world) { const { state: s } = world;
    // Slowly drift through mode space
    const t = s.time * 0.15;
    s.chladni_m = Math.max(1, Math.min(15, Math.round(8 + Math.sin(t * 0.7) * 6)));
    s.chladni_n = Math.max(1, Math.min(15, Math.round(8 + Math.cos(t * 1.1) * 6)));
  }

  render(ctx, world) { const { W, H, state: s } = world;
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

    const cmLoc  = gl.getUniformLocation(prog, 'u_colorMode');
    const trLoc  = gl.getUniformLocation(prog, 'u_transparent');
    const palLoc = gl.getUniformLocation(prog, 'u_palette');
    const lwLoc  = gl.getUniformLocation(prog, 'u_lineWidth');
    const invLoc = gl.getUniformLocation(prog, 'u_invert');

    if (cmLoc  !== null) gl.uniform1i(cmLoc,  colorModeIndex(s.colorMode));
    if (trLoc  !== null) gl.uniform1i(trLoc,  s.transparent ? 1 : 0);
    if (palLoc !== null) gl.uniform1i(palLoc, s.chladni_palette ?? 0);
    if (lwLoc  !== null) gl.uniform1f(lwLoc,  s.chladni_lineWidth ?? 0.06);
    if (invLoc !== null) gl.uniform1i(invLoc, s.chladni_invert ?? 0);

    this._quad.render(gl, prog, {
      u_m: s.chladni_m ?? 5,
      u_n: s.chladni_n ?? 3,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG(world) {
    const s = world.state;
    const m = s.chladni_m || 5;
    const n = s.chladni_n || 3;
    const res = 300;
    const W = world.W || 800;
    const H = world.H || 600;

    // Evaluate grid — note: shader maps uv [0,1] -> p [-1,1]
    // We replicate that: x/y in [-1,1]
    const grid = [];
    for (let j = 0; j <= res; j++) {
      grid[j] = [];
      for (let i = 0; i <= res; i++) {
        const x = (i / res) * 2.0 - 1.0;
        const y = (j / res) * 2.0 - 1.0;
        grid[j][i] = Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
                   - Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y);
      }
    }

    // March squares — find zero crossings on edges
    const fgColor = (s.fgColor || '#ffffff').replace('#', '');
    let svg = '';
    const sx = W / res, sy = H / res;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const tl = grid[j][i],   tr = grid[j][i + 1];
        const bl = grid[j + 1][i], br = grid[j + 1][i + 1];
        const edges = [];
        if (tl * tr < 0) { // top edge
          const t = tl / (tl - tr);
          edges.push({ x: (i + t) * sx, y: j * sy });
        }
        if (bl * br < 0) { // bottom edge
          const t = bl / (bl - br);
          edges.push({ x: (i + t) * sx, y: (j + 1) * sy });
        }
        if (tl * bl < 0) { // left edge
          const t = tl / (tl - bl);
          edges.push({ x: i * sx, y: (j + t) * sy });
        }
        if (tr * br < 0) { // right edge
          const t = tr / (tr - br);
          edges.push({ x: (i + 1) * sx, y: (j + t) * sy });
        }
        // Connect pairs of edge crossings
        for (let e = 0; e + 1 < edges.length; e += 2) {
          svg += `<line x1="${edges[e].x.toFixed(1)}" y1="${edges[e].y.toFixed(1)}" x2="${edges[e + 1].x.toFixed(1)}" y2="${edges[e + 1].y.toFixed(1)}" />`;
        }
      }
    }
    return svg ? `<g stroke="#${fgColor}" stroke-width="1.5" fill="none">${svg}</g>` : null;
  }
}
