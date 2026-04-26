/**
 * Circuit Board — Realistic PCB rendered via WebGL fragment shader.
 * Multi-scale copper traces, solder pads, vias, IC footprints,
 * SMD components, silkscreen texture, and solder mask with
 * Blinn-Phong metallic lighting. Canvas 2D silkscreen text overlay.
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
uniform float u_scale;
uniform float u_density;
uniform float u_layers;
uniform float u_shine;
uniform float u_lightAngle;
uniform float u_warmth;

// ── Hash / noise ────────────────────────────────────────────────────────────

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec2 hash2(vec2 p) {
  return vec2(hash(p), hash(p + 127.1));
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

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// ── Grid cell trace pattern ─────────────────────────────────────────────────
// Returns: x = trace presence (0 or 1), y = trace width factor

vec2 traceCell(vec2 cellId, vec2 cellUV, float gridScale) {
  float h = hash(cellId * 0.731 + gridScale);
  float h2 = hash(cellId * 1.37 + gridScale + 77.0);
  float h3 = hash(cellId * 2.19 + gridScale + 153.0);

  // Decide trace routing pattern for this cell
  float pattern = floor(h * 8.0);
  float traceW = 0.04 + h2 * 0.12; // trace width varies
  float result = 0.0;

  // Horizontal trace
  if (pattern < 2.0) {
    float yOff = 0.2 + h3 * 0.6;
    result = step(abs(cellUV.y - yOff), traceW);
  }
  // Vertical trace
  else if (pattern < 4.0) {
    float xOff = 0.2 + h3 * 0.6;
    result = step(abs(cellUV.x - xOff), traceW);
  }
  // L-bend: horizontal then vertical
  else if (pattern < 5.5) {
    float yOff = 0.3 + h3 * 0.4;
    float xOff = 0.3 + h2 * 0.4;
    float horiz = step(abs(cellUV.y - yOff), traceW) * step(cellUV.x, xOff + traceW);
    float vert = step(abs(cellUV.x - xOff), traceW) * step(yOff - traceW, cellUV.y);
    result = max(horiz, vert);
  }
  // T-junction
  else if (pattern < 6.5) {
    float horiz = step(abs(cellUV.y - 0.5), traceW);
    float vert = step(abs(cellUV.x - 0.5), traceW) * step(0.5, cellUV.y);
    result = max(horiz, vert);
  }
  // Cross
  else if (pattern < 7.2) {
    float horiz = step(abs(cellUV.y - 0.5), traceW * 0.7);
    float vert = step(abs(cellUV.x - 0.5), traceW * 0.7);
    result = max(horiz, vert);
  }
  // Empty cell (lower density)
  else {
    result = 0.0;
  }

  return vec2(result, traceW);
}

// ── Solder pad (circle) ─────────────────────────────────────────────────────

float solderPad(vec2 uv, vec2 center, float radius) {
  float d = length(uv - center);
  return smoothstep(radius + 0.003, radius - 0.003, d);
}

// ── Via hole (annular ring) ─────────────────────────────────────────────────

float viaHole(vec2 uv, vec2 center, float outerR, float innerR) {
  float d = length(uv - center);
  float ring = smoothstep(outerR + 0.002, outerR - 0.002, d);
  float hole = smoothstep(innerR - 0.002, innerR + 0.002, d);
  return ring * hole;
}

float viaDark(vec2 uv, vec2 center, float innerR) {
  float d = length(uv - center);
  return smoothstep(innerR + 0.003, innerR - 0.001, d);
}

// ── IC footprint (QFP package) ──────────────────────────────────────────────

float icBody(vec2 uv, vec2 center, vec2 halfSize) {
  vec2 d = abs(uv - center) - halfSize;
  return step(max(d.x, d.y), 0.0);
}

float icPins(vec2 uv, vec2 center, vec2 halfSize, float pinPitch, float pinLen, float pinW) {
  float pins = 0.0;
  // Top and bottom edges
  vec2 rel = uv - center;
  float inX = step(abs(rel.x), halfSize.x);
  // Bottom pins
  float atBottom = step(halfSize.y, rel.y) * step(rel.y, halfSize.y + pinLen) * inX;
  float pinMod = mod(rel.x + halfSize.x, pinPitch);
  float pinMask = step(pinMod, pinW);
  pins = max(pins, atBottom * pinMask);
  // Top pins
  float atTop = step(-halfSize.y - pinLen, rel.y) * step(rel.y, -halfSize.y) * inX;
  pins = max(pins, atTop * pinMask);
  // Left and right pins
  float inY = step(abs(rel.y), halfSize.y);
  float pinModY = mod(rel.y + halfSize.y, pinPitch);
  float pinMaskY = step(pinModY, pinW);
  float atRight = step(halfSize.x, rel.x) * step(rel.x, halfSize.x + pinLen) * inY;
  pins = max(pins, atRight * pinMaskY);
  float atLeft = step(-halfSize.x - pinLen, rel.x) * step(rel.x, -halfSize.x) * inY;
  pins = max(pins, atLeft * pinMaskY);
  return pins;
}

// ── SMD pads (resistor/capacitor footprint) ─────────────────────────────────

float smdPads(vec2 uv, vec2 center, float padW, float padH, float gap) {
  vec2 d = uv - center;
  float pad1 = step(abs(d.x + gap * 0.5 + padW * 0.5), padW * 0.5) * step(abs(d.y), padH * 0.5);
  float pad2 = step(abs(d.x - gap * 0.5 - padW * 0.5), padW * 0.5) * step(abs(d.y), padH * 0.5);
  return max(pad1, pad2);
}

// ── Silkscreen texture marks ────────────────────────────────────────────────

float silkscreenMarks(vec2 uv, float scale) {
  float marks = 0.0;
  vec2 grid = floor(uv * scale);
  float h = hash(grid * 3.71);
  if (h > 0.85) {
    vec2 local = fract(uv * scale);
    // Tiny rectangles in rows simulating text
    float row = floor(local.y * 4.0);
    float col = floor(local.x * 8.0);
    float ch = hash(vec2(row, col) + grid * 17.0);
    if (ch > 0.5) {
      marks = step(0.15, local.x) * step(local.x, 0.85) *
              step(0.2, fract(local.y * 4.0)) * step(fract(local.y * 4.0), 0.7);
      marks *= 0.3;
    }
  }
  return marks;
}

// ── Main rendering ──────────────────────────────────────────────────────────

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * u_scale;

  // ── Accumulate layers ───────────────────────────────────────────────────
  float copperMask = 0.0;    // 1 where copper exists
  float padMask = 0.0;       // solder pads
  float viaMask = 0.0;       // via annular rings
  float viaHoleMask = 0.0;   // via dark centers
  float icMask = 0.0;        // IC body
  float pinMask = 0.0;       // IC pins
  float smdMask = 0.0;       // SMD pads
  float silkMask = 0.0;      // silkscreen marks
  float heightMap = 0.0;     // for normal computation

  int layerCount = int(u_layers);

  // ── Layer 1: Fine traces (dense, thin) ──────────────────────────────────
  {
    float gs = 18.0 * u_density;
    vec2 gp = p * gs;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    vec2 tr = traceCell(cellId, cellUV, 1.0);
    copperMask = max(copperMask, tr.x * 0.7);
    // Pads at cell corners
    float h = hash(cellId * 0.53);
    if (h > 0.7) {
      padMask = max(padMask, solderPad(cellUV, vec2(0.5), 0.08));
    }
  }

  // ── Layer 2: Medium traces ──────────────────────────────────────────────
  {
    float gs = 10.0 * u_density;
    vec2 gp = p * gs + 3.7;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    vec2 tr = traceCell(cellId, cellUV, 2.0);
    copperMask = max(copperMask, tr.x * 0.85);
    float h = hash(cellId * 1.17 + 31.0);
    if (h > 0.75) {
      padMask = max(padMask, solderPad(cellUV, vec2(0.5), 0.1));
    }
    // Vias
    float hv = hash(cellId * 2.31 + 59.0);
    if (hv > 0.88) {
      viaMask = max(viaMask, viaHole(cellUV, vec2(0.5), 0.09, 0.04));
      viaHoleMask = max(viaHoleMask, viaDark(cellUV, vec2(0.5), 0.04));
    }
  }

  // ── Layer 3: Wide bus traces ────────────────────────────────────────────
  {
    float gs = 5.0 * u_density;
    vec2 gp = p * gs + 7.3;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    float h = hash(cellId * 0.91 + 41.0);
    float h2 = hash(cellId * 1.41 + 67.0);
    // Wide horizontal or vertical bus
    if (h > 0.5) {
      float yOff = 0.3 + h2 * 0.4;
      float w = 0.06 + h * 0.06;
      copperMask = max(copperMask, step(abs(cellUV.y - yOff), w));
    }
    if (h < 0.6) {
      float xOff = 0.3 + h2 * 0.4;
      float w = 0.05 + h2 * 0.05;
      copperMask = max(copperMask, step(abs(cellUV.x - xOff), w));
    }
    // Large pads at junctions
    if (hash(cellId + 13.0) > 0.8) {
      padMask = max(padMask, solderPad(cellUV, vec2(0.5), 0.14));
    }
  }

  // ── Layer 4: Ultra-fine traces (barely visible, adds density) ───────────
  {
    float gs = 30.0 * u_density;
    vec2 gp = p * gs + 11.1;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    vec2 tr = traceCell(cellId, cellUV, 4.0);
    copperMask = max(copperMask, tr.x * 0.5);
  }

  // ── Layer 5: Diagonal / power plane fill ────────────────────────────────
  if (layerCount >= 2) {
    float gs = 7.0 * u_density;
    vec2 gp = p * gs + 19.7;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    float h = hash(cellId * 3.17 + 83.0);
    if (h > 0.7) {
      // Ground plane with clearance holes
      float plane = 1.0;
      // Clearance around center
      float clearance = smoothstep(0.15, 0.2, length(cellUV - 0.5));
      copperMask = max(copperMask, plane * clearance * 0.4);
    }
  }

  // ── IC footprints ─────────────────────────────────────────────────────
  {
    float gs = 3.5 * u_density;
    vec2 gp = p * gs + 5.3;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    float h = hash(cellId * 7.13 + 97.0);
    if (h > 0.82) {
      vec2 center = vec2(0.5);
      vec2 halfSz = vec2(0.18 + hash(cellId + 3.0) * 0.1, 0.18 + hash(cellId + 7.0) * 0.1);
      float body = icBody(cellUV, center, halfSz);
      icMask = max(icMask, body);
      float pins = icPins(cellUV, center, halfSz, 0.06, 0.05, 0.025);
      pinMask = max(pinMask, pins);
      // Pin 1 marker dot
      float dot1 = solderPad(cellUV, center - halfSz + vec2(0.04, 0.04), 0.015);
      silkMask = max(silkMask, dot1 * 0.5);
    }
  }

  // ── SMD components ────────────────────────────────────────────────────
  {
    float gs = 14.0 * u_density;
    vec2 gp = p * gs + 23.1;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    float h = hash(cellId * 5.37 + 111.0);
    if (h > 0.72) {
      float h2 = hash(cellId * 3.91);
      vec2 center = vec2(0.5);
      float padW = 0.08 + h2 * 0.04;
      float padH = 0.06 + h * 0.03;
      float gap = 0.08 + h2 * 0.06;
      // Rotate some horizontally
      vec2 uv2 = (h > 0.85) ? cellUV.yx : cellUV;
      smdMask = max(smdMask, smdPads(uv2, center, padW, padH, gap));
    }
  }

  // ── More vias scattered ───────────────────────────────────────────────
  {
    float gs = 12.0 * u_density;
    vec2 gp = p * gs + 37.9;
    vec2 cellId = floor(gp);
    vec2 cellUV = fract(gp);
    float h = hash(cellId * 11.3 + 131.0);
    if (h > 0.9) {
      viaMask = max(viaMask, viaHole(cellUV, vec2(0.5), 0.07, 0.03));
      viaHoleMask = max(viaHoleMask, viaDark(cellUV, vec2(0.5), 0.03));
    }
  }

  // ── Silkscreen marks ──────────────────────────────────────────────────
  silkMask = max(silkMask, silkscreenMarks(p, 8.0 * u_density));
  silkMask = max(silkMask, silkscreenMarks(p + 47.0, 15.0 * u_density) * 0.6);

  // ── Build height map ──────────────────────────────────────────────────
  heightMap = copperMask * 0.3 + padMask * 0.5 + viaMask * 0.6 +
              pinMask * 0.4 + smdMask * 0.45 - viaHoleMask * 0.3 +
              icMask * 0.15;

  // ── Normal from height (finite differences) ───────────────────────────
  float eps = 1.0 / u_resolution.x * 2.0;
  // We approximate by offsetting UV — not perfect but good enough for lighting
  vec2 pR = vec2(p.x + eps, p.y);
  vec2 pU = vec2(p.x, p.y + eps);

  // Quick height samples at offset positions (simplified: use noise as proxy)
  float hR = heightMap + (noise(pR * 60.0) - noise(p * 60.0)) * 0.1;
  float hU = heightMap + (noise(pU * 60.0) - noise(p * 60.0)) * 0.1;

  vec3 normal = normalize(vec3(
    (heightMap - hR) * 20.0,
    (heightMap - hU) * 20.0,
    0.5
  ));

  // ── Lighting (Blinn-Phong) ────────────────────────────────────────────
  float la = u_lightAngle;
  vec3 lightDir = normalize(vec3(cos(la) * 0.8, sin(la) * 0.8, 0.6));
  vec3 fillLight = normalize(vec3(-cos(la) * 0.4, -sin(la) * 0.4, 0.3));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);

  float diff = max(dot(normal, lightDir), 0.0) + max(dot(normal, fillLight), 0.0) * 0.15;
  float spec = pow(max(dot(normal, halfVec), 0.0), 64.0 + u_shine * 192.0);
  // Fresnel rim
  float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0) * 0.4;
  float ambient = 0.15;

  // ── Substrate (PCB board color) ───────────────────────────────────────
  // Warmth: 0 = green board, 1 = black board
  vec3 boardGreen = vec3(0.04, 0.10, 0.04);
  vec3 boardBlack = vec3(0.03, 0.03, 0.03);
  vec3 substrate = mix(boardGreen, boardBlack, u_warmth);

  // Subtle FR4 fiberglass texture
  float boardNoise = fbm(p * 120.0, 3) * 0.08;
  substrate += boardNoise * vec3(0.02, 0.04, 0.02) * (1.0 - u_warmth);
  substrate += boardNoise * vec3(0.03) * u_warmth;

  // ── Copper color ──────────────────────────────────────────────────────
  vec3 copperBase = mix(vec3(0.50, 0.52, 0.55), vec3(0.72, 0.45, 0.20), u_warmth);
  vec3 copperBright = mix(vec3(0.75, 0.78, 0.82), vec3(0.85, 0.65, 0.30), u_warmth);
  vec3 copperColor = mix(copperBase, copperBright, diff * 0.5);
  vec3 specTint = mix(vec3(0.95, 0.97, 1.0), vec3(1.0, 0.85, 0.5), u_warmth);
  copperColor += (spec + fresnel) * u_shine * specTint; // specular + fresnel

  // ── Solder mask (green translucent over copper) ───────────────────────
  vec3 maskGreen = mix(vec3(0.05, 0.18, 0.06), vec3(0.06, 0.06, 0.06), u_warmth);
  vec3 maskOverCopper = mix(maskGreen, copperColor * 0.3, 0.2); // green tinted copper

  // ── Pad color (exposed copper, brighter) ──────────────────────────────
  vec3 padColor = copperColor * 1.2 + spec * u_shine * specTint * 0.6;

  // ── Via color ─────────────────────────────────────────────────────────
  vec3 viaColor = copperBright * (diff * 0.6 + 0.4) + spec * u_shine * 0.8;
  vec3 viaCenterColor = vec3(0.02, 0.02, 0.02); // dark hole

  // ── IC body color ─────────────────────────────────────────────────────
  vec3 icColor = vec3(0.04, 0.04, 0.06); // dark epoxy
  float icSpec = pow(max(dot(normal, halfVec), 0.0), 16.0) * 0.15;
  icColor += icSpec;
  // subtle text marking on IC
  float icText = step(0.6, hash(floor(p * 50.0)));
  icColor += icText * 0.03;

  // ── Pin color ─────────────────────────────────────────────────────────
  vec3 pinColor = vec3(0.75, 0.75, 0.75) * (diff * 0.5 + 0.5); // tin/silver
  pinColor += spec * u_shine * 0.6;

  // ── SMD pad color ─────────────────────────────────────────────────────
  vec3 smdColor = copperColor * 1.1 + spec * u_shine * specTint * 0.5;

  // ── Silkscreen color ──────────────────────────────────────────────────
  vec3 silkColor = mix(vec3(0.75, 0.82, 0.72), vec3(0.85, 0.85, 0.85), u_warmth);

  // ── Compose final color ───────────────────────────────────────────────
  vec3 color = substrate;

  // Solder mask over board (adds slight green reflection)
  float maskLight = ambient + diff * 0.2;
  float maskSpec = pow(max(dot(normal, halfVec), 0.0), 12.0) * 0.08 * u_shine;
  color = color * maskLight + maskSpec * maskGreen;

  // Copper traces under solder mask (visible as slightly brighter regions)
  color = mix(color, maskOverCopper, copperMask * 0.6);

  // Exposed pads (no solder mask)
  color = mix(color, padColor, padMask);

  // Vias
  color = mix(color, viaColor, viaMask);
  color = mix(color, viaCenterColor, viaHoleMask);

  // IC bodies
  color = mix(color, icColor, icMask * 0.95);

  // IC pins
  color = mix(color, pinColor, pinMask);

  // SMD pads
  color = mix(color, smdColor, smdMask);

  // Silkscreen on top
  color = mix(color, silkColor, silkMask * 0.8);

  // ── Subtle vignette ───────────────────────────────────────────────────
  float vig = 1.0 - length((v_uv - 0.5) * 1.3) * 0.3;
  color *= vig;

  // ── Micro-noise for texture ───────────────────────────────────────────
  float grain = (hash(v_uv * u_resolution + 0.5) - 0.5) * 0.02;
  color += grain;

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Silkscreen labels for 2D overlay ─────────────────────────────────────────

const SILK_LABELS = [
  'C301', 'C302', 'C101', 'C102', 'C47', 'C48', 'C220', 'C15',
  'R15', 'R22', 'R33', 'R100', 'R47', 'R68', 'R220', 'R4K7',
  'U1', 'U2', 'U3', 'U4', 'U5', 'U7', 'U8', 'U12',
  'ATmega328P', 'STM32F4', 'LM7805', 'NE555', 'MAX232', 'TL072',
  'Q1', 'Q2', 'Q3', 'D1', 'D2', 'D3', 'D4', 'D5',
  'L1', 'L2', 'FB1', 'FB2', 'J1', 'J2', 'J3', 'JP1',
  'SW1', 'SW2', 'LED1', 'LED2', 'LED3', 'TP1', 'TP2', 'TP3',
  'GND', 'VCC', '3V3', '5V', '12V', 'VREF', 'AGND',
  '10uF', '100nF', '1K', '4.7K', '10K', '100R', '47pF',
  'REV 2.1', 'PCB-001', '2024', 'MADE IN', 'RoHS',
];

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xFFFFFFFF; };
}

// ── Main class ───────────────────────────────────────────────────────────────

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
      eq: 'PCB traces',
      cat: 'Data Art',
      desc: 'Realistic circuit board with copper traces, solder pads, vias, IC packages, and silkscreen — rendered via WebGL with Blinn-Phong metallic lighting.',
    };
  }

  get params() {
    return [
      { id: 'pcb_scale',   label: 'Scale',     min: 0.5, max: 3,    step: 0.1  },
      { id: 'pcb_density', label: 'Density',    min: 0.2, max: 1,    step: 0.05 },
      { id: 'pcb_layers',  label: 'Layers',     min: 1,   max: 3,    step: 1    },
      { id: 'pcb_shine',   label: 'Shine',      min: 0,   max: 1,    step: 0.05 },
      { id: 'pcb_light',   label: 'Light',      min: 0,   max: 6.28, step: 0.1  },
      { id: 'pcb_warmth',  label: 'Warmth',     min: 0,   max: 1,    step: 0.05 },
    ];
  }

  get detailParam() { return { id: 'pcb_scale', min: 0.5, max: 3, step: 0.1 }; }

  get cursorMap() {
    return (mx, my, s) => {
      s.pcb_light = mx * 6.28;
      s.pcb_shine = 1.0 - my;
    };
  }

  animate(world) { const { state: s } = world;
    const t = s.time * 0.15;
    s.pcb_light = t % 6.28;
  }

  randomize(state, set) {
    set('pcb_scale',   parseFloat((0.6 + Math.random() * 2).toFixed(1)));
    set('pcb_density', parseFloat((0.3 + Math.random() * 0.65).toFixed(2)));
    set('pcb_layers',  Math.floor(1 + Math.random() * 3));
    set('pcb_shine',   parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('pcb_light',   parseFloat((Math.random() * 6.28).toFixed(2)));
    set('pcb_warmth',  parseFloat((Math.random() * 0.8).toFixed(2)));
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
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.disable(gl.BLEND);

    const prog = this._prog;
    gl.useProgram(prog);

    this._quad.render(gl, prog, {
      u_resolution:  [pW, pH],
      u_scale:       s.pcb_scale ?? 1.5,
      u_density:     s.pcb_density ?? 0.6,
      u_layers:      s.pcb_layers ?? 2,
      u_shine:       s.pcb_shine ?? 0.7,
      u_lightAngle:  s.pcb_light ?? 0.8,
      u_warmth:      s.pcb_warmth ?? 0.0,
    });

    ctx.drawImage(glCanvas, 0, 0, W, H);

    // ── Canvas 2D silkscreen text overlay ────────────────────────────────
    this._drawSilkscreenLabels(ctx, W, H, s);
  }

  _drawSilkscreenLabels(ctx, W, H, s) {
    const warmth = s.pcb_warmth ?? 0.0;
    const scale = s.pcb_scale ?? 1.5;
    const density = s.pcb_density ?? 0.6;
    const seed = Math.round((s.pcb_scale ?? 1.5) * 100 + (s.pcb_density ?? 0.6) * 1000);
    const rng = makeLCG(seed * 7919 + 31337);

    // Silkscreen color: greenish-white on green boards, white on black boards
    const r = Math.round(190 + warmth * 30);
    const g = Math.round(210 - warmth * 20);
    const b = Math.round(185 + warmth * 40);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;

    const count = Math.floor(25 + density * 30);
    const baseFontSize = Math.max(6, Math.min(11, W / 120 / scale));

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    for (let i = 0; i < count; i++) {
      const label = SILK_LABELS[Math.floor(rng() * SILK_LABELS.length)];
      const x = rng() * W;
      const y = rng() * H;
      const fontSize = baseFontSize * (0.7 + rng() * 0.6);
      const rotated = rng() > 0.7;

      ctx.save();
      ctx.translate(x, y);
      if (rotated) ctx.rotate(-Math.PI / 2);
      ctx.font = `${fontSize}px monospace`;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  collectSVG() { return null; }
}
