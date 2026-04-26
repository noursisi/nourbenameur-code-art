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

// ── Hash / noise ─────────────────────────────────────────────────────────────

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1(float n) {
  return fract(sin(n) * 43758.5453);
}

// ── Trace presence helpers ────────────────────────────────────────────────────

float hTrace(vec2 cell, float density) {
  return step(1.0 - density, hash(cell * 1.31 + vec2(0.7, 2.4)));
}

float vTrace(vec2 cell, float density) {
  return step(1.0 - density, hash(cell * 2.17 + vec2(1.3, 0.9)));
}

// ── Smooth step for trace edges (anti-aliased width) ─────────────────────────

float traceEdge(float dist, float width, float aa) {
  return smoothstep(width + aa, width - aa, dist);
}

// ── Circuit height at a given UV and scale ────────────────────────────────────
//   Returns: 0.0 = board, 0.3 = trace, 0.4 = via/pad, 0.5 = large pad, 0.7 = chip

float circuitHeight(vec2 uv, float scale, float density) {
  vec2 gridUV = uv * scale;
  vec2 cell   = floor(gridUV);
  vec2 local  = fract(gridUV);

  float height    = 0.0;
  float traceW    = 0.06 + (1.0 - density) * 0.04; // narrower traces when dense
  float aa        = 0.008;

  float hT = hTrace(cell, density);
  float vT = vTrace(cell, density);

  // Horizontal trace through vertical centre of cell
  if (hT > 0.5) {
    float d = abs(local.y - 0.5);
    height = max(height, traceEdge(d, traceW, aa) * 0.3);
  }

  // Vertical trace through horizontal centre of cell
  if (vT > 0.5) {
    float d = abs(local.x - 0.5);
    height = max(height, traceEdge(d, traceW, aa) * 0.3);
  }

  // Junction pad at crossing
  if (hT > 0.5 && vT > 0.5) {
    float d = length(local - 0.5);
    height = max(height, traceEdge(d, traceW * 2.2, aa) * 0.45);
  }

  // Endpoint pad: appears at trace ends (no crossing, cell boundary logic)
  if (hT > 0.5 && vT < 0.5) {
    // Pad at left or right end based on neighbour
    float leftNeigh  = vTrace(cell + vec2(-1.0, 0.0), density);
    float rightNeigh = vTrace(cell + vec2( 1.0, 0.0), density);
    if (leftNeigh < 0.5 && local.x < 0.18) {
      float d = length(local - vec2(0.0, 0.5));
      height = max(height, traceEdge(d, traceW * 1.8, aa) * 0.4);
    }
    if (rightNeigh < 0.5 && local.x > 0.82) {
      float d = length(local - vec2(1.0, 0.5));
      height = max(height, traceEdge(d, traceW * 1.8, aa) * 0.4);
    }
  }

  // Via holes (small ring: raised outer, sunken inner)
  float viaRand = hash(cell * 3.71 + vec2(5.4, 8.1));
  if (viaRand > 0.82) {
    vec2  viaPos = vec2(0.5) + (vec2(hash(cell * 4.1), hash(cell * 5.3 + 1.0)) - 0.5) * 0.3;
    float d      = length(local - viaPos);
    float outer  = traceEdge(d, traceW * 2.0, aa);
    float inner  = traceEdge(d, traceW * 0.9, aa);
    height = max(height, outer * 0.45 - inner * 0.45);
    // Annular ring highlight
    height = max(height, outer * 0.5 * (1.0 - inner));
  }

  // IC chips (rare, large rectangles with pin rows)
  float chipRand = hash(cell * 0.37 + vec2(99.0, 44.0));
  if (chipRand > 0.93) {
    vec2  chipLocal = local - 0.5;
    float chipW     = 0.38;
    float chipH     = 0.22;
    if (abs(chipLocal.x) < chipW && abs(chipLocal.y) < chipH) {
      // Body
      height = max(height, 0.65);
      // Silk-screen border (slightly raised edge line)
      float edgeX = abs(chipLocal.x) - chipW + 0.025;
      float edgeY = abs(chipLocal.y) - chipH + 0.025;
      if (max(edgeX, edgeY) > 0.0) {
        height = max(height, 0.70);
      }
      // Pin rows along top and bottom
      float pinSpacing = 0.11;
      float pinWidth   = 0.035;
      bool  inTopRow   = chipLocal.y > chipH - 0.06;
      bool  inBotRow   = chipLocal.y < -chipH + 0.06;
      if (inTopRow || inBotRow) {
        float px = mod(chipLocal.x + chipW, pinSpacing);
        if (px < pinWidth) height = max(height, 0.5);
      }
    }
    // Pads outside chip body (exposed leads)
    vec2 padZone = vec2(chipW + 0.06, chipH);
    if (abs(chipLocal.x) < padZone.x && abs(chipLocal.x) > chipW - 0.01
        && abs(chipLocal.y) < padZone.y - 0.04) {
      float px = mod(chipLocal.y + chipH, 0.11);
      if (px < 0.04) height = max(height, 0.42);
    }
  }

  // Capacitors / resistors (small rounded rectangles)
  float compRand = hash(cell * 1.93 + vec2(17.3, 33.7));
  if (compRand > 0.88 && chipRand < 0.93) {
    vec2 cOff   = vec2(hash(cell * 2.3) - 0.5, hash(cell * 3.1 + 1.0) - 0.5) * 0.3;
    vec2 cLocal = local - 0.5 - cOff;
    float cW    = 0.09;
    float cH    = 0.045;
    // Rounded rect distance
    vec2 q = abs(cLocal) - vec2(cW, cH);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    height = max(height, traceEdge(d, 0.0, aa) * 0.55);
    // End caps (metallic solder pads)
    float capDist = abs(cLocal.x) - cW + 0.02;
    if (capDist < 0.0 && abs(cLocal.y) < cH + 0.01) {
      height = max(height, 0.42);
    }
  }

  return height;
}

// ── Multi-scale height field ──────────────────────────────────────────────────

float getHeight(vec2 uv) {
  float scale    = u_scale;
  float density  = u_density;

  float h = 0.0;
  // Large feature layer
  h = max(h, circuitHeight(uv,               8.0 * scale,  density));
  // Medium detail layer
  h = max(h, circuitHeight(uv + vec2(0.37, 0.13), 24.0 * scale, density) * 0.80);
  // Fine detail layer (only when layers > 1)
  if (u_layers > 1.5) {
    h = max(h, circuitHeight(uv + vec2(0.71, 0.55), 60.0 * scale, density * 0.85) * 0.60);
  }
  // Ultra-fine (only when layers == 3)
  if (u_layers > 2.5) {
    h = max(h, circuitHeight(uv + vec2(0.19, 0.83), 140.0 * scale, density * 0.7) * 0.45);
  }

  return h;
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv     = v_uv;
  // Correct for aspect ratio so the board pattern isn't squashed
  float aspect = u_resolution.x / u_resolution.y;
  vec2 aUV     = vec2(uv.x * aspect, uv.y);

  float height = getHeight(aUV);

  // ── Normal from finite differences ─────────────────────────────────────────
  float eps = 1.0 / u_resolution.y;
  float hL  = getHeight(aUV - vec2(eps * aspect, 0.0));
  float hR  = getHeight(aUV + vec2(eps * aspect, 0.0));
  float hD  = getHeight(aUV - vec2(0.0, eps));
  float hU  = getHeight(aUV + vec2(0.0, eps));

  // Scale the xy gradient relative to the height step so normals look steep
  float bumpScale = 8.0;
  vec3 normal = normalize(vec3((hL - hR) * bumpScale, (hD - hU) * bumpScale, 0.12));

  // ── Lighting ────────────────────────────────────────────────────────────────
  float la       = u_lightAngle;
  vec3 lightDir  = normalize(vec3(cos(la), sin(la), 0.85));
  vec3 lightDir2 = normalize(vec3(-cos(la) * 0.5, -sin(la) * 0.5, 0.4)); // fill light
  vec3 viewDir   = vec3(0.0, 0.0, 1.0);

  // Primary light
  float diff1    = max(dot(normal, lightDir),  0.0);
  // Fill light (opposite, dimmer)
  float diff2    = max(dot(normal, lightDir2), 0.0) * 0.25;
  float diff     = diff1 + diff2;

  // Blinn-Phong specular (primary only)
  vec3  halfDir  = normalize(lightDir + viewDir);
  float shininess= 64.0 + u_shine * 192.0;
  float spec1    = pow(max(dot(normal, halfDir), 0.0), shininess);

  // Fresnel-like rim — amplify spec at grazing angles in XY
  float fresnel  = 1.0 - abs(dot(viewDir, normal));
  fresnel        = pow(fresnel, 3.0) * 0.6;

  // ── Material colours ────────────────────────────────────────────────────────
  // Silver base colour, blended toward gold by warmth
  vec3 silverBase = vec3(0.55, 0.57, 0.60);
  vec3 goldBase   = vec3(0.72, 0.62, 0.38);
  vec3 baseColor  = mix(silverBase, goldBase, u_warmth);

  // Specular colour also warms slightly
  vec3 specColor  = mix(vec3(0.92, 0.94, 0.97), vec3(0.98, 0.90, 0.72), u_warmth * 0.5);

  // Circuit element colour (traces, pads, chips)
  vec3 ambient    = baseColor * 0.12;
  vec3 diffuse    = baseColor * diff * 0.65;
  vec3 specular   = specColor * (spec1 + fresnel) * u_shine;

  vec3 circuitCol = ambient + diffuse + specular;

  // Board substrate — very dark (FR4 green-black, or near-black)
  vec3 boardDark  = vec3(0.015, 0.022, 0.018);
  vec3 boardColor = boardDark + boardDark * diff1 * 0.35;

  // Blend board and circuit by height
  float isCircuit = smoothstep(0.01, 0.08, height);
  vec3  color     = mix(boardColor, circuitCol, isCircuit);

  // Very subtle board surface micro-texture variation
  float microBump = (hL - hR) * 0.12 + (hD - hU) * 0.12;
  color          += boardDark * microBump * (1.0 - isCircuit);

  // ── Transparency ─────────────────────────────────────────────────────────────
  float alpha;
  if (u_transparent) {
    // Board areas = transparent, circuit elements = opaque
    alpha = smoothstep(0.02, 0.12, height);
  } else {
    alpha = 1.0;
  }

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
