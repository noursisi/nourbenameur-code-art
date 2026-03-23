/**
 * Reaction-Diffusion — Gray-Scott model.
 * Two chemicals A and B react and diffuse. Produces Turing morphogenesis:
 * leopard spots, coral, fingerprints, labyrinths.
 *
 * Architecture:
 *   - Two ping-pong RGBA textures (A stored in .r, B stored in .g)
 *   - Simulation shader: reads one texture, writes diffusion+reaction to the other
 *   - Display shader: maps result to grayscale / colorMode
 *   - 16 simulation steps per rendered frame
 */

import { Algorithm }                    from '../base.js';
import { createProgram, createTexture, createFramebuffer } from '../../webgl/context.js';
import { Quad }                         from '../../webgl/quad.js';

// ── Vertex shader (shared) ────────────────────────────────────────────────────

const VERT_SRC = /* glsl */`
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ── Simulation shader ─────────────────────────────────────────────────────────
// Reads chemical state from u_state (A in .r, B in .g).
// Outputs next-state A in .r, B in .g.

const SIM_FRAG = /* glsl */`
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_state;
uniform vec2      u_resolution;
uniform float     u_feed;
uniform float     u_kill;
uniform float     u_dA;
uniform float     u_dB;

// 3×3 discrete Laplacian weights (9-point stencil)
vec2 laplacian(vec2 texel) {
  vec2 sum = vec2(0.0);
  // corners × 0.05, edges × 0.2, center × -1.0
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * texel;
      vec2 s = texture2D(u_state, v_uv + offset).rg;
      float w;
      if (dx == 0 && dy == 0) {
        w = -1.0;
      } else if (dx != 0 && dy != 0) {
        w = 0.05;
      } else {
        w = 0.2;
      }
      sum += s * w;
    }
  }
  return sum;
}

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec2 curr  = texture2D(u_state, v_uv).rg;
  float A = curr.r;
  float B = curr.g;

  vec2  lap  = laplacian(texel);
  float lapA = lap.r;
  float lapB = lap.g;

  float reaction = A * B * B;

  float nextA = A + (u_dA * lapA - reaction + u_feed * (1.0 - A));
  float nextB = B + (u_dB * lapB + reaction - (u_kill + u_feed) * B);

  nextA = clamp(nextA, 0.0, 1.0);
  nextB = clamp(nextB, 0.0, 1.0);

  gl_FragColor = vec4(nextA, nextB, 0.0, 1.0);
}
`;

// ── Display shader ────────────────────────────────────────────────────────────

const DISP_FRAG = /* glsl */`
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_state;
uniform int       u_colorMode;
uniform bool      u_transparent;

void main() {
  vec2 st = texture2D(u_state, v_uv).rg;
  // Visualise A - B: high A with low B = foreground
  float brightness = clamp(st.r - st.g, 0.0, 1.0);

  vec3 col;
  if (u_colorMode == 0) {
    // wb: bright = white
    col = vec3(brightness);
  } else if (u_colorMode == 1) {
    // bw: bright = black on cream
    col = vec3(1.0 - brightness);
  } else {
    // silver
    col = mix(vec3(0.06, 0.06, 0.08), vec3(0.73, 0.73, 0.76), brightness);
  }

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

// Simulation grid resolution (independent of display resolution for performance)
const SIM_W = 512;
const SIM_H = 512;

const STEPS_PER_FRAME = 16;

// ── Class ─────────────────────────────────────────────────────────────────────

export class ReactionDiffusion extends Algorithm {
  constructor(engine) {
    super(engine);
    this._simProg  = null;
    this._dispProg = null;
    this._quad     = null;
    this._gl       = null;

    // Ping-pong buffers
    this._texA = null;
    this._texB = null;
    this._fboA = null;
    this._fboB = null;
    this._ping = 0; // which pair is current source

    // Track last params to detect significant changes (reset sim)
    this._lastFeed = null;
    this._lastKill = null;

    this._initialized = false;
  }

  get metadata() {
    return {
      name: 'Reaction-Diffusion',
      eq:   'Gray-Scott Model',
      cat:  'Nature',
      desc: 'Two chemicals react and diffuse — creates leopard spots, coral, fingerprints. Turing morphogenesis.',
    };
  }

  get params() {
    return [
      { id: 'rd_feed', label: 'Feed Rate', min: 0.01, max: 0.08, step: 0.001 },
      { id: 'rd_kill', label: 'Kill Rate', min: 0.03, max: 0.07, step: 0.001 },
    ];
  }

  get detailParam() {
    return null; // continuous simulation, no detail param
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.rd_feed = 0.01 + mx * 0.07;
      s.rd_kill = 0.03 + my * 0.04;
    };
  }

  animate(world) { const { state: s } = world;
    // Simulation runs every render frame — just mark dirty
  }

  // ── GL setup ───────────────────────────────────────────────────────────────

  _setupGL(gl) {
    this._gl = gl;
    this._simProg  = createProgram(gl, VERT_SRC, SIM_FRAG);
    this._dispProg = createProgram(gl, VERT_SRC, DISP_FRAG);
    this._quad     = new Quad(gl);
    this._initialized = false; // will seed next frame
  }

  _setupBuffers(gl) {
    // Delete old resources if they exist
    if (this._texA) gl.deleteTexture(this._texA);
    if (this._texB) gl.deleteTexture(this._texB);
    if (this._fboA) gl.deleteFramebuffer(this._fboA);
    if (this._fboB) gl.deleteFramebuffer(this._fboB);

    // For reaction-diffusion we use UNSIGNED_BYTE textures (two channels packed as RGBA)
    // because float FBO rendering needs extensions that aren't always available.
    const makeByteTexture = (gl, w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return tex;
    };

    this._texA = makeByteTexture(gl, SIM_W, SIM_H);
    this._texB = makeByteTexture(gl, SIM_W, SIM_H);
    this._fboA = createFramebuffer(gl, this._texA);
    this._fboB = createFramebuffer(gl, this._texB);
    this._ping = 0;
  }

  _seedState(gl) {
    // Seed: all A=1, B=0; then drop blobs of B in center and random spots
    const data = new Uint8Array(SIM_W * SIM_H * 4);

    // Fill all A=255, B=0
    for (let i = 0; i < SIM_W * SIM_H; i++) {
      data[i * 4]     = 255; // A
      data[i * 4 + 1] = 0;   // B
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }

    // Seed B in center blob
    const cx = SIM_W / 2;
    const cy = SIM_H / 2;
    const seed = (x, y, r) => {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = ((x + dx + SIM_W) % SIM_W);
            const py = ((y + dy + SIM_H) % SIM_H);
            const idx = (py * SIM_W + px) * 4;
            data[idx]     = 128; // A = 0.5
            data[idx + 1] = 200; // B = ~0.78
          }
        }
      }
    };

    seed(cx, cy, 12);

    // Random spots
    const rng = (n) => {
      let x = Math.sin(n * 127.1) * 43758.5453123;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 12; i++) {
      const sx = Math.floor(rng(i * 3)     * SIM_W);
      const sy = Math.floor(rng(i * 3 + 1) * SIM_H);
      const sr = 4 + Math.floor(rng(i * 3 + 2) * 8);
      seed(sx, sy, sr);
    }

    // Upload to texA (ping source)
    gl.bindTexture(gl.TEXTURE_2D, this._texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_W, SIM_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Clear texB
    const clearData = new Uint8Array(SIM_W * SIM_H * 4);
    for (let i = 0; i < SIM_W * SIM_H; i++) {
      clearData[i * 4]     = 255;
      clearData[i * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this._texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_W, SIM_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, clearData);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this._ping = 0;
    this._initialized = true;
  }

  _resetIfNeeded(gl, feed, kill) {
    const THRESHOLD = 0.005;
    if (
      this._lastFeed === null ||
      Math.abs(feed - this._lastFeed) > THRESHOLD ||
      Math.abs(kill - this._lastKill) > THRESHOLD
    ) {
      this._lastFeed = feed;
      this._lastKill = kill;
      this._setupBuffers(gl);
      this._seedState(gl);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

    // Setup programs
    if (!this._simProg || this._gl !== gl) {
      this._setupGL(gl);
    }
    if (!this._simProg || !this._dispProg) return;

    const feed = s.rd_feed ?? 0.055;
    const kill = s.rd_kill ?? 0.062;

    // Reset simulation if params changed significantly or first run
    this._resetIfNeeded(gl, feed, kill);

    // Diffusion rates
    const dA = 1.0;
    const dB = 0.5;

    const textures = [this._texA, this._texB];
    const fbos     = [this._fboA, this._fboB];

    // ── Simulation steps ──────────────────────────────────────────────────────
    gl.disable(gl.BLEND);
    gl.useProgram(this._simProg);

    // Bind the quad's vertex data manually (sim FBO has its own viewport)
    gl.viewport(0, 0, SIM_W, SIM_H);

    const simFeedLoc = gl.getUniformLocation(this._simProg, 'u_feed');
    const simKillLoc = gl.getUniformLocation(this._simProg, 'u_kill');
    const simDALoc   = gl.getUniformLocation(this._simProg, 'u_dA');
    const simDBLoc   = gl.getUniformLocation(this._simProg, 'u_dB');
    const simResLoc  = gl.getUniformLocation(this._simProg, 'u_resolution');
    const simTexLoc  = gl.getUniformLocation(this._simProg, 'u_state');

    if (simFeedLoc !== null) gl.uniform1f(simFeedLoc, feed);
    if (simKillLoc !== null) gl.uniform1f(simKillLoc, kill);
    if (simDALoc   !== null) gl.uniform1f(simDALoc,   dA);
    if (simDBLoc   !== null) gl.uniform1f(simDBLoc,   dB);
    if (simResLoc  !== null) gl.uniform2f(simResLoc,  SIM_W, SIM_H);

    for (let step = 0; step < STEPS_PER_FRAME; step++) {
      const src = this._ping;
      const dst = 1 - src;

      // Read from src texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[src]);
      if (simTexLoc !== null) gl.uniform1i(simTexLoc, 0);

      // Write to dst FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[dst]);

      this._quad.render(gl, this._simProg, {}); // uniforms already set above

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this._ping = dst;
    }

    // ── Display pass ──────────────────────────────────────────────────────────
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this._dispProg);

    const dispTexLoc = gl.getUniformLocation(this._dispProg, 'u_state');
    const dispCmLoc  = gl.getUniformLocation(this._dispProg, 'u_colorMode');
    const dispTrLoc  = gl.getUniformLocation(this._dispProg, 'u_transparent');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[this._ping]);
    if (dispTexLoc !== null) gl.uniform1i(dispTexLoc, 0);
    if (dispCmLoc  !== null) gl.uniform1i(dispCmLoc,  colorModeIndex(s.colorMode));
    if (dispTrLoc  !== null) gl.uniform1i(dispTrLoc,  s.transparent ? 1 : 0);

    this._quad.render(gl, this._dispProg, {});

    // ── Composite ─────────────────────────────────────────────────────────────
    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG(world) { return null; }
}
