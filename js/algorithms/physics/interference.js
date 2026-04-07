/**
 * Wave Interference — multiple point sources create concentric ring overlaps.
 * Rendered via WebGL for performance (per-pixel computation).
 */

import { Algorithm } from '../base.js';
import { createProgram } from '../../webgl/context.js';
import { Quad } from '../../webgl/quad.js';

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
uniform float u_sources;
uniform float u_wavelength;
uniform float u_speed;
uniform vec2  u_pan;
uniform float u_zoom;
uniform vec3  u_fgColor;
uniform vec3  u_bgColor;
uniform bool  u_transparent;
uniform int   u_layout;
uniform float u_amplitude;
uniform float u_decay;
uniform int   u_palette;

#define MAX_SOURCES 12
#define PI 3.14159265359

vec2 getSourcePos(int i, int total, int layout, float time) {
  float fi = float(i);
  float ft = float(total);
  if (layout == 1) { // Line
    float t = fi / (ft - 1.0);
    return vec2(0.1 + t * 0.8, 0.5 + sin(time * 0.3 + t * 6.28) * 0.1);
  }
  if (layout == 2) { // Circle
    float angle = fi / ft * 6.2832 + time * 0.2;
    return vec2(0.5 + cos(angle) * 0.3, 0.5 + sin(angle) * 0.3);
  }
  if (layout == 3) { // Random (seeded)
    float seed = fi * 127.1 + 311.7;
    return vec2(fract(sin(seed) * 43758.5453), fract(sin(seed * 1.3) * 22578.1459));
  }
  // Default: golden angle
  float ga = fi * 2.39996;
  float r = sqrt(fi / ft) * 0.35;
  return vec2(0.5 + cos(ga) * r, 0.5 + sin(ga) * r);
}

vec3 intfColor(float val, int pal, float phase) {
  if (pal == 1) { // Rainbow phase
    return vec3(0.5+0.5*sin(val*6.28+phase), 0.5+0.5*sin(val*6.28+phase+2.09), 0.5+0.5*sin(val*6.28+phase+4.19));
  }
  if (pal == 2) { // Heat
    return vec3(val, val*val*0.5, val*val*val*0.2);
  }
  return vec3(val); // Mono
}

void main() {
  vec2 uv = v_uv;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 pos = (uv - 0.5) * aspect / u_zoom;
  pos -= u_pan / u_resolution * aspect / u_zoom;
  pos += 0.5;

  float totalWave = 0.0;
  int srcCount = int(u_sources);

  for (int i = 0; i < MAX_SOURCES; i++) {
    if (i >= srcCount) break;
    vec2 src = getSourcePos(i, srcCount, u_layout, u_time);
    // Animate sources slightly
    float fi = float(i);
    src.x += sin(u_time * 0.3 + fi * 1.7) * 0.03;
    src.y += cos(u_time * 0.25 + fi * 2.3) * 0.03;

    float dist = distance(pos * aspect, src * aspect);
    float wave = u_amplitude * sin(dist / u_wavelength * 2.0 * PI - u_time * u_speed);
    if (u_decay > 0.0) wave *= 1.0 / (1.0 + dist * u_decay * 20.0);
    totalWave += wave;
  }

  // Normalize
  totalWave /= u_sources;

  // Map to brightness
  float brightness = totalWave * 0.5 + 0.5;
  brightness = pow(brightness, 1.5); // contrast boost

  vec3 monoColor = intfColor(brightness, u_palette, u_time * 0.5);
  vec3 col;
  if (u_palette == 0) {
    col = mix(u_bgColor, u_fgColor, brightness);
  } else {
    col = monoColor;
  }

  float alpha = 1.0;
  if (u_transparent) {
    alpha = brightness;
  }

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function parseHexColor(hex) {
  if (!hex || hex[0] !== '#') return [1, 1, 1];
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class Interference extends Algorithm {
  constructor(engine) {
    super(engine);
    this._prog = null;
    this._quad = null;
    this._gl = null;
  }

  get metadata() {
    return {
      name: 'Interference',
      eq: 'A*sin(kr - wt)',
      cat: 'Physics',
      desc: 'Wave interference from multiple point sources. Overlapping concentric ripples create beautiful moire patterns.',
    };
  }

  get params() {
    return [
      { id: 'intf_sources',    label: 'Sources',    min: 2,    max: 12,   step: 1    },
      { id: 'intf_wavelength', label: 'Wavelength',  min: 0.005, max: 0.1, step: 0.002 },
      { id: 'intf_speed',      label: 'Speed',       min: 0,    max: 10,   step: 0.2  },
      { id: 'intf_layout',     label: 'Layout',      min: 0,    max: 3,    step: 1    },
      { id: 'intf_amplitude',  label: 'Amplitude',   min: 0.1,  max: 3,    step: 0.1  },
      { id: 'intf_decay',      label: 'Decay',       min: 0,    max: 2,    step: 0.1  },
      { id: 'intf_palette',    label: 'Palette',     min: 0,    max: 2,    step: 1    },
    ];
  }

  get detailParam() {
    return { id: 'intf_wavelength', min: 0.005, max: 0.1, step: 0.002 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.intf_wavelength = 0.005 + mx * 0.095;
      s.intf_speed = my * 10;
    };
  }

  animate(world) { const { state: s } = world;
    // Time advances via s.time
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const glCanvas = this.engine.getGLCanvas();
    const gl = this.engine.getGL();

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

    // Set bool/int uniforms manually
    const trLoc = gl.getUniformLocation(prog, 'u_transparent');
    if (trLoc !== null) gl.uniform1i(trLoc, s.transparent ? 1 : 0);

    const fgC = parseHexColor(this.engine.fg(s));
    const bgC = parseHexColor(this.engine.bg(s));

    // Pass int uniforms manually (Quad.render uses uniform1f for all)
    const layoutLoc = gl.getUniformLocation(prog, 'u_layout');
    if (layoutLoc !== null) gl.uniform1i(layoutLoc, s.intf_layout ?? 0);
    const paletteLoc = gl.getUniformLocation(prog, 'u_palette');
    if (paletteLoc !== null) gl.uniform1i(paletteLoc, s.intf_palette ?? 0);

    this._quad.render(gl, prog, {
      u_resolution: [pW, pH],
      u_time: s.time ?? 0,
      u_sources: s.intf_sources ?? 5,
      u_wavelength: s.intf_wavelength ?? 0.03,
      u_speed: s.intf_speed ?? 3,
      u_pan: [s.camPanX ?? 0, -(s.camPanY ?? 0)],
      u_zoom: s.camZoom ?? 1,
      u_fgColor: fgC,
      u_bgColor: bgC,
      u_amplitude: s.intf_amplitude ?? 1.0,
      u_decay: s.intf_decay ?? 0,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG(world) {
    return null; // pixel-based
  }
}
