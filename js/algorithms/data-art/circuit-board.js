/**
 * Circuit Board algorithm — rendered via WebGL.
 * Procedural 3D-looking circuit board with metallic silver rendering.
 * Uses height-based normals and Blinn-Phong shading for a convincing
 * raised-trace metallic PCB appearance.
 */

import { Algorithm }    from '../base.js';
import { createProgram } from '../../webgl/context.js';
import { Quad }          from '../../webgl/quad.js';

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
uniform float u_scale;
uniform float u_density;
uniform float u_layers;
uniform float u_shine;
uniform float u_lightAngle;
uniform float u_warmth;
uniform bool  u_transparent;
uniform float u_time;

// ── Hash ─────────────────────────────────────────────────────────────────────

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p) {
  return vec2(hash(p), hash(p + vec2(37.1, 91.7)));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ── SDF helpers ──────────────────────────────────────────────────────────────

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdCircle(vec2 p, float r) { return length(p) - r; }

float sm(float d, float aa) { return smoothstep(aa, -aa, d); }

// ── Zone map: decides what component type goes where ─────────────────────────
// Returns 0-6: trace area, IC large, IC small, capacitor cluster, connector,
//              via field, bus route

float zoneType(vec2 zoneCell) {
  float h = hash(zoneCell * 7.31 + vec2(13.7, 29.3));
  if (h < 0.15) return 1.0; // large IC
  if (h < 0.28) return 2.0; // small IC cluster
  if (h < 0.42) return 3.0; // capacitor/resistor field
  if (h < 0.52) return 4.0; // connector/slot
  if (h < 0.62) return 5.0; // via field
  if (h < 0.75) return 6.0; // bus traces
  return 0.0; // standard trace routing
}

// ── Standard trace routing ───────────────────────────────────────────────────

float tracePattern(vec2 uv, float scale, float density) {
  vec2 g = uv * scale;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float h = 0.0;
  float tw = 0.04 + (1.0 - density) * 0.03;
  float aa = 0.006;

  // Horizontal/vertical traces based on hash
  float hT = step(1.0 - density, hash(cell * 1.31 + 0.7));
  float vT = step(1.0 - density, hash(cell * 2.17 + 1.3));
  if (hT > 0.5) h = max(h, sm(abs(f.y - 0.5) - tw, aa) * 0.3);
  if (vT > 0.5) h = max(h, sm(abs(f.x - 0.5) - tw, aa) * 0.3);
  // Junction pad
  if (hT > 0.5 && vT > 0.5) h = max(h, sm(length(f - 0.5) - tw * 2.5, aa) * 0.45);
  // Via
  if (hash(cell * 3.7 + 5.4) > 0.8) {
    float d = length(f - 0.5);
    h = max(h, sm(d - tw * 2.0, aa) * 0.5 * sm(-(d - tw * 0.8), aa));
  }
  return h;
}

// ── Large IC package (BGA/QFP) ───────────────────────────────────────────────

float largeIC(vec2 local, vec2 cellHash) {
  float h = 0.0;
  float aa = 0.005;
  // Body
  float bodyW = 0.3 + cellHash.x * 0.15;
  float bodyH = 0.2 + cellHash.y * 0.12;
  float body = sm(sdBox(local - 0.5, vec2(bodyW, bodyH)), aa);
  h = max(h, body * 0.7);
  // Pin 1 marker (dot in corner)
  h = max(h, sm(sdCircle(local - vec2(0.5 - bodyW + 0.04, 0.5 - bodyH + 0.04), 0.015), aa) * 0.75);
  // Pin grid (BGA style)
  if (sdBox(local - 0.5, vec2(bodyW - 0.03, bodyH - 0.03)) < 0.0) {
    vec2 pinGrid = fract(local * 16.0);
    float pin = sm(length(pinGrid - 0.5) - 0.18, 0.02);
    h = max(h, pin * 0.55 * body);
  }
  // Edge pins (QFP style)
  for (float side = 0.0; side < 4.0; side++) {
    vec2 edgeLocal = local - 0.5;
    if (side < 1.0) edgeLocal = edgeLocal; // bottom
    else if (side < 2.0) edgeLocal = vec2(-edgeLocal.y, edgeLocal.x); // right
    else if (side < 3.0) edgeLocal = -edgeLocal; // top
    else edgeLocal = vec2(edgeLocal.y, -edgeLocal.x); // left

    if (edgeLocal.y > bodyH && edgeLocal.y < bodyH + 0.06) {
      float pinX = mod(edgeLocal.x + bodyW, 0.04);
      if (pinX < 0.02 && abs(edgeLocal.x) < bodyW) {
        h = max(h, 0.45);
      }
    }
  }
  return h;
}

// ── Small IC / SOT package ───────────────────────────────────────────────────

float smallIC(vec2 local, vec2 cellHash) {
  float h = 0.0;
  float aa = 0.005;
  // Multiple small ICs scattered in the zone
  for (float i = 0.0; i < 4.0; i++) {
    vec2 pos = vec2(hash(cellHash + i * 0.3), hash(cellHash + i * 0.7 + 1.0)) * 0.6 + 0.2;
    vec2 sz = vec2(0.06 + hash(cellHash + i) * 0.08, 0.03 + hash(cellHash + i + 5.0) * 0.04);
    float body = sm(sdBox(local - pos, sz), aa);
    h = max(h, body * 0.6);
    // Pins on two sides
    if (abs(local.y - pos.y) > sz.y - 0.005 && abs(local.y - pos.y) < sz.y + 0.02) {
      float px = mod((local.x - pos.x + sz.x) * 30.0, 1.0);
      if (px < 0.4 && abs(local.x - pos.x) < sz.x) h = max(h, 0.4);
    }
  }
  return h;
}

// ── Capacitor / resistor cluster ─────────────────────────────────────────────

float capCluster(vec2 local, vec2 cellHash) {
  float h = 0.0;
  float aa = 0.005;
  for (float i = 0.0; i < 8.0; i++) {
    vec2 pos = vec2(hash(cellHash + i * 1.3), hash(cellHash + i * 2.1 + 3.0)) * 0.7 + 0.15;
    float rot = hash(cellHash + i * 0.7) * 3.14159;
    float isElectrolytic = step(0.7, hash(cellHash + i * 4.0));

    if (isElectrolytic > 0.5) {
      // Electrolytic capacitor (cylinder, viewed from top = circle)
      float r = 0.025 + hash(cellHash + i * 3.0) * 0.03;
      float d = sdCircle(local - pos, r);
      float cap = sm(d, aa);
      h = max(h, cap * 0.8);
      // Top marking stripe
      h = max(h, sm(d + r * 0.3, aa) * sm(-(d + r * 0.1), aa) * 0.85);
    } else {
      // SMD resistor/capacitor
      vec2 sz = vec2(0.04, 0.018);
      vec2 rl = local - pos;
      float c = cos(rot), s = sin(rot);
      rl = vec2(rl.x * c - rl.y * s, rl.x * s + rl.y * c);
      float body = sm(sdBox(rl, sz), aa);
      h = max(h, body * 0.5);
      // Solder end caps
      if (abs(rl.x) > sz.x - 0.01 && abs(rl.y) < sz.y + 0.003) {
        h = max(h, body * 0.42);
      }
    }
  }
  return h;
}

// ── Connector / slot ─────────────────────────────────────────────────────────

float connector(vec2 local, vec2 cellHash) {
  float h = 0.0;
  float aa = 0.005;
  float isVertical = step(0.5, cellHash.x);
  vec2 sz = isVertical > 0.5 ? vec2(0.08, 0.4) : vec2(0.4, 0.08);
  float body = sm(sdBox(local - 0.5, sz), aa);
  h = max(h, body * 0.6);
  // Pin holes along the slot
  float along = isVertical > 0.5 ? local.y : local.x;
  float across = isVertical > 0.5 ? local.x : local.y;
  float center = 0.5;
  if (abs(across - center) < (isVertical > 0.5 ? sz.x : sz.y) - 0.01) {
    float pins = mod(along * 40.0, 1.0);
    if (pins < 0.3 && body > 0.5) h = max(h, 0.35);
  }
  // Mounting pads at ends
  vec2 pad1 = isVertical > 0.5 ? vec2(0.5, 0.5 - sz.y - 0.03) : vec2(0.5 - sz.x - 0.03, 0.5);
  vec2 pad2 = isVertical > 0.5 ? vec2(0.5, 0.5 + sz.y + 0.03) : vec2(0.5 + sz.x + 0.03, 0.5);
  h = max(h, sm(sdCircle(local - pad1, 0.025), aa) * 0.5);
  h = max(h, sm(sdCircle(local - pad2, 0.025), aa) * 0.5);
  return h;
}

// ── Via field ────────────────────────────────────────────────────────────────

float viaField(vec2 local, vec2 cellHash) {
  float h = 0.0;
  float aa = 0.005;
  float spacing = 0.06 + cellHash.x * 0.04;
  vec2 vg = fract(local / spacing);
  vec2 vc = floor(local / spacing);
  float present = step(0.3, hash(vc * 17.3 + cellHash));
  if (present > 0.5) {
    float d = length(vg - 0.5) * spacing;
    float outer = sm(d - 0.018, aa);
    float inner = sm(d - 0.006, aa);
    h = max(h, outer * 0.5 * (1.0 - inner * 0.8));
  }
  return h;
}

// ── Bus traces (wide parallel lines) ─────────────────────────────────────────

float busTraces(vec2 local, vec2 cellHash) {
  float h = 0.0;
  float aa = 0.005;
  float isHoriz = step(0.5, cellHash.y);
  float along = isHoriz > 0.5 ? local.x : local.y;
  float across = isHoriz > 0.5 ? local.y : local.x;
  float nTraces = 4.0 + floor(cellHash.x * 6.0);
  float spacing = 0.8 / nTraces;
  float start = 0.1;
  for (float i = 0.0; i < 10.0; i++) {
    if (i >= nTraces) break;
    float center = start + i * spacing;
    float tw = 0.008 + hash(cellHash + i) * 0.006;
    h = max(h, sm(abs(across - center) - tw, aa) * 0.3);
  }
  return h;
}

// ── Full height combining zones ──────────────────────────────────────────────

float getHeight(vec2 uv) {
  float scale = u_scale;
  float density = u_density;
  float h = 0.0;

  // Fine trace layer (always present)
  h = max(h, tracePattern(uv, 20.0 * scale, density));

  // Zone layer — large cells, each gets a unique component type
  float zoneScale = 3.0 * scale;
  vec2 zg = uv * zoneScale;
  vec2 zoneCell = floor(zg);
  vec2 zoneLocal = fract(zg);
  vec2 zoneHash = hash2(zoneCell);
  float zt = zoneType(zoneCell);

  if (zt < 0.5) h = max(h, tracePattern(uv + 0.37, 40.0 * scale, density * 0.9) * 0.7);
  else if (zt < 1.5) h = max(h, largeIC(zoneLocal, zoneHash));
  else if (zt < 2.5) h = max(h, smallIC(zoneLocal, zoneHash));
  else if (zt < 3.5) h = max(h, capCluster(zoneLocal, zoneHash));
  else if (zt < 4.5) h = max(h, connector(zoneLocal, zoneHash));
  else if (zt < 5.5) h = max(h, viaField(zoneLocal, zoneHash));
  else h = max(h, busTraces(zoneLocal, zoneHash));

  // Medium trace layer
  if (u_layers > 1.5) {
    h = max(h, tracePattern(uv + vec2(0.71, 0.55), 60.0 * scale, density * 0.85) * 0.5);
  }
  // Ultra-fine traces
  if (u_layers > 2.5) {
    h = max(h, tracePattern(uv + vec2(0.19, 0.83), 120.0 * scale, density * 0.7) * 0.35);
  }

  return h;
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 aUV = vec2(uv.x * aspect, uv.y);

  float height = getHeight(aUV);

  // ── Normals ────────────────────────────────────────────────────────────────
  float eps = 0.8 / u_resolution.y;
  float hL = getHeight(aUV - vec2(eps * aspect, 0.0));
  float hR = getHeight(aUV + vec2(eps * aspect, 0.0));
  float hD = getHeight(aUV - vec2(0.0, eps));
  float hU = getHeight(aUV + vec2(0.0, eps));

  float bumpScale = 14.0;
  vec3 normal = normalize(vec3((hL - hR) * bumpScale, (hD - hU) * bumpScale, 0.08));

  // ── Ambient occlusion (darken crevices) ────────────────────────────────────
  float ao = 1.0;
  float aoEps = eps * 3.0;
  float hCenter = height;
  float hAvg = (getHeight(aUV + vec2(aoEps, 0.0)) + getHeight(aUV - vec2(aoEps, 0.0))
              + getHeight(aUV + vec2(0.0, aoEps)) + getHeight(aUV - vec2(0.0, aoEps))) * 0.25;
  ao = 0.5 + 0.5 * smoothstep(-0.1, 0.1, hCenter - hAvg + 0.02);

  // ── Lighting ───────────────────────────────────────────────────────────────
  float la = u_lightAngle;
  vec3 lightDir = normalize(vec3(cos(la), sin(la), 0.7));
  vec3 lightDir2 = normalize(vec3(-cos(la) * 0.6, -sin(la) * 0.6, 0.3));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  float diff1 = max(dot(normal, lightDir), 0.0);
  float diff2 = max(dot(normal, lightDir2), 0.0) * 0.2;
  float diff = diff1 + diff2;

  vec3 halfDir = normalize(lightDir + viewDir);
  float shininess = 80.0 + u_shine * 256.0;
  float spec = pow(max(dot(normal, halfDir), 0.0), shininess);

  float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 4.0) * 0.8;

  // ── Material ───────────────────────────────────────────────────────────────
  vec3 silver = vec3(0.58, 0.60, 0.63);
  vec3 gold = vec3(0.75, 0.63, 0.38);
  vec3 baseColor = mix(silver, gold, u_warmth);
  vec3 specColor = mix(vec3(0.95, 0.97, 1.0), vec3(1.0, 0.92, 0.7), u_warmth * 0.5);

  vec3 circuitCol = baseColor * 0.1 + baseColor * diff * 0.7 + specColor * (spec + fresnel) * u_shine;
  circuitCol *= ao;

  // Board substrate — add subtle noise texture
  float boardNoise = noise(aUV * 200.0 * u_scale) * 0.015;
  vec3 boardDark = vec3(0.012 + boardNoise, 0.018 + boardNoise, 0.014 + boardNoise);
  vec3 boardColor = boardDark * (0.6 + diff1 * 0.4) * ao;

  // Solder mask subtle color (very dark green or black)
  float maskNoise = noise(aUV * 80.0 * u_scale) * 0.01;
  boardColor += vec3(0.0, maskNoise, 0.0);

  float isCircuit = smoothstep(0.01, 0.06, height);
  vec3 color = mix(boardColor, circuitCol, isCircuit);

  // Silkscreen text (subtle white markings on board areas)
  float silk = noise(aUV * 300.0 * u_scale);
  if (silk > 0.85 && isCircuit < 0.1) {
    color += vec3(0.03) * (silk - 0.85) * 6.0;
  }

  // ── Transparency ──────────────────────────────────────────────────────────
  float alpha = u_transparent ? smoothstep(0.02, 0.1, height) : 1.0;

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

// ── Main class ────────────────────────────────────────────────────────────────

export class CircuitBoard extends Algorithm {
  constructor(engine) {
    super(engine);
    this._prog = null;
    this._quad = null;
    this._gl   = null;
  }

  get metadata() {
    return {
      name: 'Circuit Board',
      eq:   'PCB heightmap + Blinn-Phong',
      cat:  'Data Art',
      desc: 'Procedural 3D PCB with raised metallic silver traces, IC chips, vias, and capacitors — lit with specular highlights.',
    };
  }

  get params() {
    return [
      { id: 'pcb_scale',   label: 'Scale',       min: 0.5,  max: 5,    step: 0.1  },
      { id: 'pcb_density', label: 'Density',      min: 0.2,  max: 1,    step: 0.05 },
      { id: 'pcb_layers',  label: 'Layers',       min: 1,    max: 3,    step: 1    },
      { id: 'pcb_shine',   label: 'Shine',        min: 0,    max: 1,    step: 0.05 },
      { id: 'pcb_light',   label: 'Light Angle',  min: 0,    max: 6.28, step: 0.1  },
      { id: 'pcb_warmth',  label: 'Warmth',       min: 0,    max: 1,    step: 0.05 },
    ];
  }

  get detailParam() {
    return { id: 'pcb_scale', min: 0.5, max: 5, step: 0.1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      // Mouse X → light angle full sweep
      s.pcb_light = mx * 6.28;
      // Mouse Y → scale (top = zoomed in, bottom = zoomed out)
      s.pcb_scale = 0.5 + (1.0 - my) * 4.5;
    };
  }

  animate(world) {
    const { state: s } = world;
    // Slowly rotate the light
    s.pcb_light = ((s.pcb_light ?? 0.8) + 0.004) % 6.2832;
  }

  randomize(state, set) {
    set('pcb_scale',   parseFloat((0.6 + Math.random() * 3.5).toFixed(1)));
    set('pcb_density', parseFloat((0.3 + Math.random() * 0.65).toFixed(2)));
    set('pcb_layers',  Math.random() > 0.5 ? (Math.random() > 0.5 ? 3 : 2) : 1);
    set('pcb_shine',   parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('pcb_light',   parseFloat((Math.random() * 6.28).toFixed(2)));
    set('pcb_warmth',  parseFloat((Math.random() * 0.6).toFixed(2)));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
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

    // Lazily compile shader (or recompile if context changed)
    if (!this._prog || this._gl !== gl) {
      this._gl   = gl;
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

    // Boolean uniform — not handled by Quad's float helper
    const trLoc = gl.getUniformLocation(prog, 'u_transparent');
    if (trLoc !== null) gl.uniform1i(trLoc, s.transparent ? 1 : 0);

    // Float + vec uniforms via Quad helper
    this._quad.render(gl, prog, {
      u_resolution: [pW, pH],
      u_scale:      s.pcb_scale   ?? 1.5,
      u_density:    s.pcb_density ?? 0.6,
      u_layers:     s.pcb_layers  ?? 2,
      u_shine:      s.pcb_shine   ?? 0.7,
      u_lightAngle: s.pcb_light   ?? 0.8,
      u_warmth:     s.pcb_warmth  ?? 0.0,
      u_time:       s.time        ?? 0,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);
  }

  collectSVG(world) {
    return null;
  }
}
