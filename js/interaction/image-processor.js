/**
 * Image Processor — loads an image as a WebGL texture and applies
 * distortion effects via fragment shaders.
 *
 * Each distortion is a GLSL fragment shader that reads from u_image
 * and writes transformed pixels.
 */

import { createProgram } from '../webgl/context.js';
import { Quad } from '../webgl/quad.js';
import { NOISE_2D, FBM, ROTATION } from '../webgl/shader-lib.js';

// ── Shared vertex shader ────────────────────────────────────────────────────

const VERT = /* glsl */`
attribute vec2 a_position;
uniform float u_mirror;
varying vec2 v_uv;
void main() {
  vec2 uv = a_position * 0.5 + 0.5;
  // Flip Y for WebGL texture orientation, mirror X for webcam
  v_uv = vec2(u_mirror > 0.5 ? 1.0 - uv.x : uv.x, 1.0 - uv.y);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ── Distortion fragment shaders ─────────────────────────────────────────────

const DISTORTIONS = {

  none: {
    name: 'Original',
    params: [],
    frag: null,
  },

  pixelsort: {
    name: 'Pixel Sort',
    params: [
      { id: 'ip_sort_threshold', label: 'Threshold', min: 0, max: 1, step: 0.01, default: 0.3 },
      { id: 'ip_sort_direction', label: 'Direction', min: 0, max: 1, step: 1, default: 0 },
      { id: 'ip_sort_intensity', label: 'Intensity', min: 1, max: 100, step: 1, default: 30 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_direction;
uniform float u_intensity;

float brightness(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = v_uv;
  vec4 original = texture2D(u_image, uv);
  float bright = brightness(original.rgb);

  if (bright > u_threshold) {
    // Sort by scanning along direction and finding brighter pixels
    vec2 dir = u_direction < 0.5 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 texel = dir / u_resolution;
    vec4 sorted = original;
    float sortedBright = bright;

    for (float i = 1.0; i <= 100.0; i += 1.0) {
      if (i > u_intensity) break;
      vec2 sampleUV = uv + texel * i;
      if (sampleUV.x > 1.0 || sampleUV.y > 1.0) break;
      vec4 s = texture2D(u_image, sampleUV);
      float sb = brightness(s.rgb);
      if (sb > sortedBright && sb > u_threshold) {
        sorted = s;
        sortedBright = sb;
      }
    }
    gl_FragColor = sorted;
  } else {
    gl_FragColor = original;
  }
}
`,
    uniforms: (s) => ({
      u_threshold: s.ip_sort_threshold ?? 0.3,
      u_direction: s.ip_sort_direction ?? 0,
      u_intensity: s.ip_sort_intensity ?? 30,
    }),
  },

  threshold: {
    name: 'Threshold',
    params: [
      { id: 'ip_thresh_level', label: 'Level', min: 0, max: 1, step: 0.01, default: 0.5 },
      { id: 'ip_thresh_smooth', label: 'Smoothness', min: 0, max: 0.2, step: 0.005, default: 0.02 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_level;
uniform float u_smooth;

void main() {
  vec4 col = texture2D(u_image, v_uv);
  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
  float val = smoothstep(u_level - u_smooth, u_level + u_smooth, lum);
  gl_FragColor = vec4(vec3(val), col.a);
}
`,
    uniforms: (s) => ({
      u_level: s.ip_thresh_level ?? 0.5,
      u_smooth: s.ip_thresh_smooth ?? 0.02,
    }),
  },

  edge: {
    name: 'Edge Detection',
    params: [
      { id: 'ip_edge_strength', label: 'Strength', min: 0.5, max: 5, step: 0.1, default: 1.5 },
      { id: 'ip_edge_invert', label: 'Invert', min: 0, max: 1, step: 1, default: 0 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_strength;
uniform float u_invert;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 t = 1.0 / u_resolution;
  // Sobel filter
  float tl = lum(texture2D(u_image, v_uv + vec2(-t.x, -t.y)).rgb);
  float tc = lum(texture2D(u_image, v_uv + vec2( 0.0, -t.y)).rgb);
  float tr = lum(texture2D(u_image, v_uv + vec2( t.x, -t.y)).rgb);
  float ml = lum(texture2D(u_image, v_uv + vec2(-t.x,  0.0)).rgb);
  float mr = lum(texture2D(u_image, v_uv + vec2( t.x,  0.0)).rgb);
  float bl = lum(texture2D(u_image, v_uv + vec2(-t.x,  t.y)).rgb);
  float bc = lum(texture2D(u_image, v_uv + vec2( 0.0,  t.y)).rgb);
  float br = lum(texture2D(u_image, v_uv + vec2( t.x,  t.y)).rgb);

  float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
  float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
  float edge = length(vec2(gx, gy)) * u_strength;
  edge = clamp(edge, 0.0, 1.0);
  if (u_invert > 0.5) edge = 1.0 - edge;
  gl_FragColor = vec4(vec3(edge), 1.0);
}
`,
    uniforms: (s) => ({
      u_strength: s.ip_edge_strength ?? 1.5,
      u_invert: s.ip_edge_invert ?? 0,
    }),
  },

  polar: {
    name: 'Polar Coordinates',
    params: [
      { id: 'ip_polar_twist', label: 'Twist', min: 0, max: 6.28, step: 0.05, default: 0 },
      { id: 'ip_polar_zoom', label: 'Zoom', min: 0.2, max: 3, step: 0.05, default: 1 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_twist;
uniform float u_zoom;

#define PI 3.14159265359

void main() {
  vec2 uv = v_uv - 0.5;
  float r = length(uv) * 2.0 * u_zoom;
  float a = atan(uv.y, uv.x) / (2.0 * PI) + 0.5;
  a = fract(a + u_twist / (2.0 * PI));
  vec2 polarUV = vec2(a, r);
  polarUV = clamp(polarUV, 0.0, 1.0);
  gl_FragColor = texture2D(u_image, polarUV);
}
`,
    uniforms: (s) => ({
      u_twist: s.ip_polar_twist ?? 0,
      u_zoom: s.ip_polar_zoom ?? 1,
    }),
  },

  feedback: {
    name: 'Feedback / Echo',
    params: [
      { id: 'ip_feedback_decay', label: 'Decay', min: 0.5, max: 0.99, step: 0.01, default: 0.85 },
      { id: 'ip_feedback_offset', label: 'Offset', min: 0, max: 0.03, step: 0.001, default: 0.005 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform sampler2D u_prev;
uniform float u_decay;
uniform float u_offset;
uniform float u_hasPrev;

void main() {
  vec4 current = texture2D(u_image, v_uv);
  if (u_hasPrev < 0.5) {
    gl_FragColor = current;
    return;
  }
  vec2 offsetUV = v_uv + vec2(u_offset, u_offset * 0.5);
  offsetUV = clamp(offsetUV, 0.0, 1.0);
  vec4 prev = texture2D(u_prev, offsetUV);
  gl_FragColor = mix(current, prev, u_decay);
}
`,
    uniforms: (s) => ({
      u_decay: s.ip_feedback_decay ?? 0.85,
      u_offset: s.ip_feedback_offset ?? 0.005,
    }),
  },

  fractalWarp: {
    name: 'Fractal Warp',
    params: [
      { id: 'ip_fwarp_cr', label: 'Real(c)', min: -2, max: 2, step: 0.01, default: -0.7 },
      { id: 'ip_fwarp_ci', label: 'Imag(c)', min: -2, max: 2, step: 0.01, default: 0.27 },
      { id: 'ip_fwarp_amount', label: 'Warp Amount', min: 0, max: 0.5, step: 0.01, default: 0.1 },
      { id: 'ip_fwarp_iter', label: 'Iterations', min: 1, max: 20, step: 1, default: 5 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_cr;
uniform float u_ci;
uniform float u_amount;
uniform float u_iter;

void main() {
  vec2 uv = v_uv;
  // Map UV to complex plane
  vec2 z = (uv - 0.5) * 4.0;
  vec2 c = vec2(u_cr, u_ci);

  // Run a few Julia iterations to get displacement
  float iter = 0.0;
  for (int i = 0; i < 20; i++) {
    if (float(i) >= u_iter) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
  }

  // Use the final z position as displacement
  vec2 displacement = z * u_amount * 0.01;
  vec2 sampledUV = uv + displacement;
  sampledUV = clamp(sampledUV, 0.0, 1.0);
  gl_FragColor = texture2D(u_image, sampledUV);
}
`,
    uniforms: (s) => ({
      u_cr: s.ip_fwarp_cr ?? -0.7,
      u_ci: s.ip_fwarp_ci ?? 0.27,
      u_amount: s.ip_fwarp_amount ?? 0.1,
      u_iter: s.ip_fwarp_iter ?? 5,
    }),
  },

  pixelMelt: {
    name: 'Pixel Melt',
    params: [
      { id: 'ip_melt_amount',    label: 'Melt Amount', min: 0, max: 1,   step: 0.01, default: 0.3 },
      { id: 'ip_melt_speed',     label: 'Speed',       min: 0, max: 3,   step: 0.05, default: 1   },
      { id: 'ip_melt_direction', label: 'Direction',   min: 0, max: 3,   step: 1,    default: 0   },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_speed;
uniform float u_direction;
uniform float u_time;

${NOISE_2D}
${FBM}

void main() {
  vec2 uv = v_uv;

  // Sample brightness to drive melt amount — darker areas drip more
  float bright = dot(texture2D(u_image, uv).rgb, vec3(0.299, 0.587, 0.114));

  // Animated noise along the axis perpendicular to melt direction
  float noiseCoord;
  if (u_direction < 0.5 || u_direction > 1.5) {
    noiseCoord = uv.x; // vertical melt uses horizontal noise
  } else {
    noiseCoord = uv.y; // horizontal melt uses vertical noise
  }
  float noise = fbm(vec2(noiseCoord * 20.0, u_time * u_speed)) * u_amount * 0.5;

  float melt = (1.0 - bright) * u_amount + noise;

  if (u_direction < 0.5) {
    uv.y -= melt; // down
  } else if (u_direction < 1.5) {
    uv.y += melt; // up
  } else if (u_direction < 2.5) {
    uv.x -= melt; // left
  } else {
    uv.x += melt; // right
  }

  uv = clamp(uv, 0.0, 1.0);
  gl_FragColor = texture2D(u_image, uv);
}
`,
    uniforms: (s) => ({
      u_amount:    s.ip_melt_amount    ?? 0.3,
      u_speed:     s.ip_melt_speed     ?? 1,
      u_direction: s.ip_melt_direction ?? 0,
      u_time:      s.time              ?? 0,
    }),
  },

  channelDrift: {
    name: 'Channel Drift',
    params: [
      { id: 'ip_cd_amount',  label: 'Amount',  min: 0,    max: 0.1,  step: 0.002, default: 0.02 },
      { id: 'ip_cd_angle',   label: 'Angle',   min: 0,    max: 6.28, step: 0.1,   default: 0    },
      { id: 'ip_cd_animate', label: 'Animate', min: 0,    max: 1,    step: 1,     default: 1    },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_angle;
uniform float u_animate;
uniform float u_time;

void main() {
  float angle = u_angle + (u_animate > 0.5 ? u_time * 0.5 : 0.0);

  // Red offset along angle
  vec2 rOffset = vec2(cos(angle), sin(angle)) * u_amount;
  // Blue offset 120 degrees (2*PI/3) ahead
  vec2 bOffset = vec2(cos(angle + 2.09439510239), sin(angle + 2.09439510239)) * u_amount;

  float r = texture2D(u_image, clamp(v_uv + rOffset, 0.0, 1.0)).r;
  float g = texture2D(u_image, v_uv).g;
  float b = texture2D(u_image, clamp(v_uv + bOffset, 0.0, 1.0)).b;
  float a = texture2D(u_image, v_uv).a;

  gl_FragColor = vec4(r, g, b, a);
}
`,
    uniforms: (s) => ({
      u_amount:  s.ip_cd_amount  ?? 0.02,
      u_angle:   s.ip_cd_angle   ?? 0,
      u_animate: s.ip_cd_animate ?? 1,
      u_time:    s.time          ?? 0,
    }),
  },

  recursiveZoom: {
    name: 'Recursive Zoom',
    params: [
      { id: 'ip_rz_depth',   label: 'Depth',    min: 1,    max: 5,    step: 1,    default: 3  },
      { id: 'ip_rz_scale',   label: 'Scale',    min: 0.2,  max: 0.8,  step: 0.05, default: 0.5 },
      { id: 'ip_rz_offsetX', label: 'Offset X', min: -0.5, max: 0.5,  step: 0.05, default: 0  },
      { id: 'ip_rz_offsetY', label: 'Offset Y', min: -0.5, max: 0.5,  step: 0.05, default: 0  },
      { id: 'ip_rz_rotate',  label: 'Rotate',   min: 0,    max: 6.28, step: 0.1,  default: 0  },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_depth;
uniform float u_scale;
uniform float u_offsetX;
uniform float u_offsetY;
uniform float u_rotate;

void main() {
  vec2 uv = v_uv;
  vec4 col = texture2D(u_image, uv);

  for (int i = 0; i < 5; i++) {
    if (float(i) >= u_depth) break;

    // Zoom into the image: pull UV towards (0.5 + offset) by dividing by scale
    uv = (uv - 0.5 - vec2(u_offsetX, u_offsetY)) / u_scale + 0.5;

    // Optional per-level rotation
    if (u_rotate > 0.01) {
      float c = cos(u_rotate);
      float s = sin(u_rotate);
      vec2 centered = uv - 0.5;
      uv = vec2(centered.x * c - centered.y * s,
                centered.x * s + centered.y * c) + 0.5;
    }

    // Only sample if the transformed UV is inside [0,1]
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      col = texture2D(u_image, uv);
    }
  }

  gl_FragColor = col;
}
`,
    uniforms: (s) => ({
      u_depth:   s.ip_rz_depth   ?? 3,
      u_scale:   s.ip_rz_scale   ?? 0.5,
      u_offsetX: s.ip_rz_offsetX ?? 0,
      u_offsetY: s.ip_rz_offsetY ?? 0,
      u_rotate:  s.ip_rz_rotate  ?? 0,
    }),
  },

  crtMonitor: {
    name: 'CRT Monitor',
    params: [
      { id: 'ip_crt_curve',     label: 'Curvature',    min: 0, max: 0.5,  step: 0.02,  default: 0.15  },
      { id: 'ip_crt_scanlines', label: 'Scanlines',    min: 0, max: 1,    step: 0.05,  default: 0.5   },
      { id: 'ip_crt_phosphor',  label: 'Phosphor',     min: 0, max: 1,    step: 0.05,  default: 0.4   },
      { id: 'ip_crt_bleed',     label: 'Color Bleed',  min: 0, max: 0.01, step: 0.001, default: 0.003 },
      { id: 'ip_crt_vignette',  label: 'Vignette',     min: 0, max: 1,    step: 0.05,  default: 0.5   },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_curve;
uniform float u_scanlines;
uniform float u_phosphor;
uniform float u_bleed;
uniform float u_vignette;

#define PI 3.14159265359

void main() {
  // Barrel distortion — pulls corners inward for CRT screen curve
  vec2 uv = v_uv - 0.5;
  float r2 = dot(uv, uv);
  uv *= 1.0 + u_curve * r2;
  uv += 0.5;

  // Pixels outside the curved screen area are black (bezel)
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Color bleeding — sample R, G, B at slight horizontal offsets
  float r = texture2D(u_image, clamp(uv + vec2( u_bleed, 0.0), 0.0, 1.0)).r;
  float g = texture2D(u_image, uv).g;
  float b = texture2D(u_image, clamp(uv - vec2( u_bleed, 0.0), 0.0, 1.0)).b;
  vec3 col = vec3(r, g, b);

  // Scanlines — darken horizontal gaps between phosphor rows
  float scanline = sin(uv.y * u_resolution.y * PI) * 0.5 + 0.5;
  col *= 1.0 - u_scanlines * (1.0 - scanline) * 0.5;

  // Phosphor RGB sub-pixel mask — each column is slightly tinted
  float px = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(1.0);
  if (px < 1.0) {
    mask = vec3(1.0, 1.0 - u_phosphor * 0.5, 1.0 - u_phosphor * 0.5);
  } else if (px < 2.0) {
    mask = vec3(1.0 - u_phosphor * 0.5, 1.0, 1.0 - u_phosphor * 0.5);
  } else {
    mask = vec3(1.0 - u_phosphor * 0.5, 1.0 - u_phosphor * 0.5, 1.0);
  }
  col *= mask;

  // Vignette — darken screen edges
  float vig = 1.0 - r2 * u_vignette * 4.0;
  col *= max(0.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`,
    uniforms: (s) => ({
      u_curve:     s.ip_crt_curve     ?? 0.15,
      u_scanlines: s.ip_crt_scanlines ?? 0.5,
      u_phosphor:  s.ip_crt_phosphor  ?? 0.4,
      u_bleed:     s.ip_crt_bleed     ?? 0.003,
      u_vignette:  s.ip_crt_vignette  ?? 0.5,
    }),
  },

  needlework: {
    name: 'Needlework',
    params: [
      { id: 'ip_nw_dotsize',   label: 'Dot Size',   min: 2,  max: 24, step: 1,    default: 6  },
      { id: 'ip_nw_spacing',   label: 'Spacing',    min: 0,  max: 8,  step: 0.5,  default: 1  },
      { id: 'ip_nw_threshold', label: 'Threshold',  min: 0,  max: 1,  step: 0.01, default: 0.4 },
      { id: 'ip_nw_contrast',  label: 'Contrast',   min: 1,  max: 5,  step: 0.1,  default: 1  },
      { id: 'ip_nw_mirror',    label: 'Mirror',     min: 0,  max: 1,  step: 1,    default: 0  },
      { id: 'ip_nw_invert',    label: 'Invert',     min: 0,  max: 1,  step: 1,    default: 0  },
    ],
    // No GLSL shader — rendered via Canvas 2D in the custom render path
    frag: null,
    canvas2d: true,
    uniforms: () => ({}),
  },

  asciiDistort: {
    name: 'ASCII',
    params: [
      { id: 'ip_ascii_size',   label: 'Cell Size', min: 4,  max: 16, step: 1,   default: 8 },
      { id: 'ip_ascii_levels', label: 'Levels',    min: 2,  max: 10, step: 1,   default: 5 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_cellsize;
uniform float u_levels;

float brightness(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 px = v_uv * u_resolution;

  // Snap to cell grid — sample the center of the cell
  vec2 cell = floor(px / u_cellsize);
  vec2 cellCenter = (cell + 0.5) * u_cellsize;
  vec2 sampleUV = clamp(cellCenter / u_resolution, 0.0, 1.0);

  float bright = brightness(texture2D(u_image, sampleUV).rgb);

  // Quantize brightness to N levels
  float level = floor(bright * u_levels) / u_levels;

  // Local position within cell (0..1)
  vec2 local = (px - cell * u_cellsize) / u_cellsize;
  vec2 localC = local - 0.5; // centered

  // Map level to a dot density pattern that approximates character density
  // Level 0 = space (no fill), level 1 = full block
  float density = level;

  // Draw a square whose fill area = density
  float halfFill = sqrt(density) * 0.5;
  float inBlock = step(abs(localC.x), halfFill) * step(abs(localC.y), halfFill);

  // Thin grid line between cells for readability
  float lineW = 0.04;
  float onBorder = 1.0 - step(lineW, local.x) * step(lineW, local.y) *
                         step(local.x, 1.0 - lineW) * step(local.y, 1.0 - lineW);

  float val = clamp(inBlock - onBorder * 0.5, 0.0, 1.0);
  gl_FragColor = vec4(vec3(val), 1.0);
}
`,
    uniforms: (s) => ({
      u_cellsize: s.ip_ascii_size   ?? 8,
      u_levels:   s.ip_ascii_levels ?? 5,
    }),
  },

  vhs: {
    name: 'VHS Tape',
    params: [
      { id: 'ip_vhs_chroma',    label: 'Chroma Bleed', min: 0,    max: 1,    step: 0.02,  default: 0.55 },
      { id: 'ip_vhs_tracking',  label: 'Tracking',     min: 0,    max: 1,    step: 0.05,  default: 0.3  },
      { id: 'ip_vhs_grain',     label: 'Tape Grain',   min: 0,    max: 1,    step: 0.02,  default: 0.18 },
      { id: 'ip_vhs_softness',  label: 'Softness',     min: 0,    max: 1,    step: 0.05,  default: 0.4  },
    ],
    // Real VHS encodes color as YIQ. Luma (Y) is broadcast at full bandwidth,
    // chroma (I, Q) is subsampled to ~25% horizontal — that's what makes
    // colors smear sideways while edges stay sharp. Then add tape grain on
    // chroma only, gentle scanline modulation on luma, occasional tracking
    // jitter on horizontal scan position.
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_chroma;
uniform float u_tracking;
uniform float u_grain;
uniform float u_softness;
uniform float u_time;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 rgb2yiq(vec3 c) {
  return vec3(
    dot(c, vec3(0.299,    0.587,    0.114)),
    dot(c, vec3(0.595716,-0.274453,-0.321263)),
    dot(c, vec3(0.211456,-0.522591, 0.311135))
  );
}
vec3 yiq2rgb(vec3 c) {
  return vec3(
    c.x + 0.9563*c.y + 0.6210*c.z,
    c.x - 0.2721*c.y - 0.6474*c.z,
    c.x - 1.1070*c.y + 1.7046*c.z
  );
}

void main() {
  // Tracking errors — horizontal scan-line jitter that drifts vertically
  // with tape time. Concentrated in occasional bands, not constant noise.
  float band = smoothstep(0.985, 1.0, fract(v_uv.y * 8.0 - u_time * 0.05));
  float bandJitter = (hash(vec2(floor(v_uv.y * 240.0), floor(u_time * 20.0))) - 0.5)
                     * 0.04 * band * u_tracking;
  vec2 uv = vec2(v_uv.x + bandJitter, v_uv.y);

  // Sample luma at full resolution
  float yLuma = rgb2yiq(texture2D(u_image, uv).rgb).x;

  // Sample chroma at low horizontal resolution (chroma subsampling)
  float chromaWidth = mix(1.0, 0.18, u_chroma);
  float chromaPx = u_resolution.x * chromaWidth;
  vec2 cuv = vec2(floor(uv.x * chromaPx) / chromaPx, uv.y);
  vec3 chromaSrc = vec3(0.0);
  // Average a few horizontal taps for soft chroma bleed
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i) * 1.5 / u_resolution.x, 0.0);
    chromaSrc += texture2D(u_image, clamp(cuv + o, 0.0, 1.0)).rgb;
  }
  chromaSrc /= 3.0;
  vec3 yiqC = rgb2yiq(chromaSrc);

  // Combine: high-res luma + low-res chroma
  vec3 yiq = vec3(yLuma, yiqC.y, yiqC.z);

  // Soft luma blur — tape transfer isn't perfectly sharp
  if (u_softness > 0.01) {
    float blurred = 0.0;
    float w = 0.0;
    for (int i = -2; i <= 2; i++) {
      float weight = 1.0 - abs(float(i)) * 0.25;
      blurred += rgb2yiq(texture2D(u_image, clamp(uv + vec2(float(i) * 0.7 / u_resolution.x, 0.0), 0.0, 1.0)).rgb).x * weight;
      w += weight;
    }
    yiq.x = mix(yiq.x, blurred / w, u_softness);
  }

  // Subtle scanline modulation on luma — half-pixel sine, very low amplitude
  yiq.x *= 1.0 - 0.06 * (sin(v_uv.y * u_resolution.y * 3.14159) * 0.5 + 0.5);

  // Tape grain — noise on chroma channels (color speckle, not luma snow)
  float n1 = hash(uv * u_resolution + u_time * 47.0);
  float n2 = hash(uv * u_resolution + u_time * 53.0 + 13.0);
  yiq.y += (n1 - 0.5) * u_grain * 0.25;
  yiq.z += (n2 - 0.5) * u_grain * 0.25;
  // Faint luma snow as well
  yiq.x += (hash(uv * u_resolution + u_time * 60.0) - 0.5) * u_grain * 0.05;

  vec3 col = yiq2rgb(yiq);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
    uniforms: (s) => ({
      u_chroma:   s.ip_vhs_chroma   ?? 0.55,
      u_tracking: s.ip_vhs_tracking ?? 0.3,
      u_grain:    s.ip_vhs_grain    ?? 0.18,
      u_softness: s.ip_vhs_softness ?? 0.4,
      u_time:     s.time            ?? 0,
    }),
  },

  vaporwave: {
    name: 'Vaporwave',
    params: [
      { id: 'ip_vw_lift',       label: 'Lift Shadows',  min: 0,    max: 1,    step: 0.02, default: 0.4 },
      { id: 'ip_vw_warmth',     label: 'Highlight Pink',min: 0,    max: 1,    step: 0.02, default: 0.5 },
      { id: 'ip_vw_aberration', label: 'Aberration',    min: 0,    max: 0.02, step: 0.001,default: 0.004 },
      { id: 'ip_vw_grain',      label: 'Grain',         min: 0,    max: 0.15, step: 0.005,default: 0.04 },
    ],
    // Pastel grading instead of stickered perspective grid. Shadows lifted
    // toward deep teal, midtones desaturated and pulled warm, highlights
    // rolled off into soft pink. Subtle RGB shift + film grain on top.
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_lift;
uniform float u_warmth;
uniform float u_aberration;
uniform float u_grain;
uniform float u_time;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  // RGB chromatic shift — pull red right, blue left
  vec2 ab = vec2(u_aberration, 0.0);
  float r = texture2D(u_image, clamp(v_uv + ab, 0.0, 1.0)).r;
  float g = texture2D(u_image, v_uv).g;
  float b = texture2D(u_image, clamp(v_uv - ab, 0.0, 1.0)).b;
  vec3 col = vec3(r, g, b);

  float luma = dot(col, vec3(0.299, 0.587, 0.114));

  // Lift shadows toward deep teal (low end of tone curve)
  vec3 shadowTone = vec3(0.10, 0.14, 0.22);
  float shadowMask = 1.0 - smoothstep(0.0, 0.45, luma);
  col = mix(col, mix(col, shadowTone, 0.6), shadowMask * u_lift);

  // Roll highlights into soft pink (high end of tone curve)
  vec3 highlightTone = vec3(1.0, 0.78, 0.86);
  float highMask = smoothstep(0.55, 0.92, luma);
  col = mix(col, col * highlightTone, highMask * u_warmth);

  // Pull midtones slightly warm + desaturated (the vaporwave "soft" feel)
  float midMask = smoothstep(0.2, 0.5, luma) * (1.0 - smoothstep(0.5, 0.8, luma));
  vec3 midTone = mix(vec3(luma), col, 0.78); // gentle desaturation
  col = mix(col, midTone, midMask * 0.6);

  // Film grain
  float n = (hash(v_uv * u_resolution + u_time * 13.0) - 0.5) * u_grain;
  col += n;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
    uniforms: (s) => ({
      u_lift:       s.ip_vw_lift       ?? 0.4,
      u_warmth:     s.ip_vw_warmth     ?? 0.5,
      u_aberration: s.ip_vw_aberration ?? 0.004,
      u_grain:      s.ip_vw_grain      ?? 0.04,
      u_time:       s.time             ?? 0,
    }),
  },

  heatmap: {
    name: 'Thermal',
    params: [
      { id: 'ip_th_intensity', label: 'Intensity', min: 0, max: 1, step: 0.02, default: 1.0 },
      { id: 'ip_th_contrast',  label: 'Contrast',  min: 0.5, max: 3, step: 0.05, default: 1.4 },
      { id: 'ip_th_invert',    label: 'Invert',    min: 0, max: 1, step: 1,    default: 0   },
    ],
    // Smooth analytic palette (no banding). Shape is the classic FLIR
    // thermal curve: cool blue/violet at low T, magenta in the midband,
    // hot red->orange->yellow->white at the top. Built from continuous
    // smoothstep blends rather than 6 hard segments.
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_intensity;
uniform float u_contrast;
uniform float u_invert;

vec3 thermal(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c;
  // Red rises late, peaks at 0.7, stays high. Plus a small toe in the violet midband.
  c.r = smoothstep(0.30, 0.65, t)
      + 0.55 * smoothstep(0.10, 0.30, t) * (1.0 - smoothstep(0.30, 0.55, t));
  // Green rises last (orange->yellow->white)
  c.g = smoothstep(0.55, 0.95, t);
  // Blue falls off through the spectrum, peaks early, fades out by mid
  c.b = smoothstep(0.0, 0.18, t)
      - 0.85 * smoothstep(0.18, 0.55, t)
      + smoothstep(0.85, 1.0, t); // tip back up at the top for white
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec3 src = texture2D(u_image, v_uv).rgb;
  float luma = dot(src, vec3(0.299, 0.587, 0.114));
  // Contrast curve — pivot around 0.5 so highs get hotter, lows get colder
  luma = clamp(0.5 + (luma - 0.5) * u_contrast, 0.0, 1.0);
  if (u_invert > 0.5) luma = 1.0 - luma;
  vec3 t = thermal(luma);
  gl_FragColor = vec4(mix(src, t, u_intensity), 1.0);
}
`,
    uniforms: (s) => ({
      u_intensity: s.ip_th_intensity ?? 1.0,
      u_contrast:  s.ip_th_contrast  ?? 1.4,
      u_invert:    s.ip_th_invert    ?? 0,
    }),
  },

  posterize: {
    name: 'Posterize',
    params: [
      { id: 'ip_po_levels',   label: 'Levels',     min: 2, max: 12, step: 1,    default: 5   },
      { id: 'ip_po_saturate', label: 'Saturation', min: 0, max: 2,  step: 0.05, default: 1.3 },
      { id: 'ip_po_dither',   label: 'Dither',     min: 0, max: 1,  step: 0.05, default: 0.5 },
    ],
    // Color quantization with a 4×4 ordered-dither (Bayer) — banding turns
    // into a pleasing retro-print stipple instead of harsh edges. Set
    // Dither to 0 for clean flat regions, to 1 for full risograph feel.
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_levels;
uniform float u_saturate;
uniform float u_dither;

float bayer4(vec2 p) {
  // 4x4 Bayer matrix, normalized to [-0.5, 0.5)
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int idx = x + y * 4;
  float v = 0.0;
  if      (idx == 0)  v =  0.0;
  else if (idx == 1)  v =  8.0;
  else if (idx == 2)  v =  2.0;
  else if (idx == 3)  v = 10.0;
  else if (idx == 4)  v = 12.0;
  else if (idx == 5)  v =  4.0;
  else if (idx == 6)  v = 14.0;
  else if (idx == 7)  v =  6.0;
  else if (idx == 8)  v =  3.0;
  else if (idx == 9)  v = 11.0;
  else if (idx == 10) v =  1.0;
  else if (idx == 11) v =  9.0;
  else if (idx == 12) v = 15.0;
  else if (idx == 13) v =  7.0;
  else if (idx == 14) v = 13.0;
  else                v =  5.0;
  return (v / 16.0) - 0.5;
}

void main() {
  vec3 col = texture2D(u_image, v_uv).rgb;
  // Saturation curve around luma
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, u_saturate);
  col = clamp(col, 0.0, 1.0);
  // Per-pixel dither offset (per channel — adds noise, hides banding)
  vec2 px = v_uv * u_resolution;
  float d = bayer4(px) * u_dither / max(u_levels, 2.0);
  col += vec3(d);
  // Quantize to N levels
  float steps = max(u_levels - 1.0, 1.0);
  col = floor(col * u_levels) / steps;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
    uniforms: (s) => ({
      u_levels:   s.ip_po_levels   ?? 5,
      u_saturate: s.ip_po_saturate ?? 1.3,
      u_dither:   s.ip_po_dither   ?? 0.5,
    }),
  },

};

// ── ImageProcessor class ────────────────────────────────────────────────────

class ImageProcessor {
  constructor() {
    /** @type {HTMLImageElement|HTMLVideoElement|null} */
    this._source = null;
    this._sourceType = null; // 'image' | 'video'
    this._texture = null;
    this._prevTexture = null;
    this._prevFBO = null;
    this._programs = {};
    this._quad = null;
    this._gl = null;
    this._glCanvas = null;
    this._hasPrevFrame = false;
  }

  /** Load an image file as the processor source */
  loadImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._source = img;
        this._sourceType = 'image';
        this._hasPrevFrame = false;
        resolve(img);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /** Load a video file as the processor source */
  loadVideo(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.loop = true;
      video.onloadeddata = () => {
        video.play();
        this._source = video;
        this._sourceType = 'video';
        this._hasPrevFrame = false;
        resolve(video);
      };
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    });
  }

  /** Set a video element as the processor source (for camera) */
  setVideoSource(video) {
    this._source = video;
    this._sourceType = 'video';
    this._hasPrevFrame = false;
  }

  /** Play / pause an uploaded video. No-op for camera streams or images. */
  setPlaying(playing) {
    if (!this._source || this._source.tagName !== 'VIDEO') return;
    if (this._source.srcObject) return; // live camera stream — leave alone
    if (playing) {
      const p = this._source.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      this._source.pause();
    }
  }

  /** Remove current source */
  clear() {
    this._source = null;
    this._sourceType = null;
    this._hasPrevFrame = false;
  }

  hasSource() {
    return !!this._source;
  }

  /**
   * Returns the rectangle (in canvas CSS pixels) where the source image is
   * actually rendered after fit-to-canvas + user scale + offset. Returns
   * null if no source. Used by the engine to clip algorithm/post-process
   * output to the image bounds so effects don't bleed onto the empty
   * background.
   */
  getRenderedBounds(W, H, state) {
    if (!this._source) return null;
    const iw = this._source.videoWidth || this._source.naturalWidth || this._source.width;
    const ih = this._source.videoHeight || this._source.naturalHeight || this._source.height;
    if (!iw || !ih) return null;
    const scale = (state.ip_scale || 1);
    const fitScale = Math.min(W / iw, H / ih) * scale;
    const dw = iw * fitScale;
    const dh = ih * fitScale;
    const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
    const dy = (H - dh) / 2 + (state.ip_offsetY || 0);
    return { x: dx, y: dy, w: dw, h: dh };
  }

  /** Get all available distortion definitions */
  static getDistortions() {
    return DISTORTIONS;
  }

  /** Get distortion definition by key */
  static getDistortion(key) {
    return DISTORTIONS[key] || null;
  }

  /** Get list of distortion keys */
  static getDistortionKeys() {
    return Object.keys(DISTORTIONS);
  }

  /**
   * Render the processed image to the given 2D context.
   * Uses the engine's WebGL canvas for GPU processing.
   */
  /**
   * Draw source image centered with aspect ratio preserved.
   * Uses ip_scale state for user-controlled scaling.
   */
  _drawFitted(ctx, W, H, state) {
    if (!this._source) return;
    try {
      const iw = this._source.videoWidth || this._source.naturalWidth || this._source.width;
      const ih = this._source.videoHeight || this._source.naturalHeight || this._source.height;
      if (!iw || !ih) return;
      const scale = (state.ip_scale || 1);
      // Fit to canvas preserving aspect ratio, then apply user scale
      const fitScale = Math.min(W / iw, H / ih) * scale;
      const dw = iw * fitScale;
      const dh = ih * fitScale;
      const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
      const dy = (H - dh) / 2 + (state.ip_offsetY || 0);
      // Mirror only live camera streams (selfie view). Uploaded videos
      // and images render with their natural orientation.
      const isCameraStream = !!this._source.srcObject;
      if (isCameraStream) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this._source, W - dx - dw, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(this._source, dx, dy, dw, dh);
      }
    } catch(e) {}
  }

  /**
   * Render needlework effect via Canvas 2D — guaranteed round dots.
   * Samples the source image on a grid and draws circles.
   */
  _renderNeedlework(ctx, W, H, state) {
    const src = this._source;
    if (!src) return;

    const dotSize   = state.ip_nw_dotsize   ?? 6;
    const spacing   = state.ip_nw_spacing   ?? 1;
    const threshold = state.ip_nw_threshold ?? 0.4;
    const contrast  = state.ip_nw_contrast  ?? 1;
    const mirror    = Number(state.ip_nw_mirror ?? 0) >= 1;
    const inv       = Number(state.ip_nw_invert ?? 0) >= 1;

    const iw = src.videoWidth || src.naturalWidth || src.width;
    const ih = src.videoHeight || src.naturalHeight || src.height;
    if (!iw || !ih) return;

    const cellSize = dotSize + spacing;
    const radius = dotSize / 2;

    // Fitted rect on canvas
    const scale = (state.ip_scale || 1);
    const fitScale = Math.min(W / iw, H / ih) * scale;
    const dw = iw * fitScale;
    const dh = ih * fitScale;
    const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
    const dy = (H - dh) / 2 + (state.ip_offsetY || 0);

    // How many cells fit across the fitted image?
    const imgCols = Math.floor(dw / cellSize);
    const imgRows = Math.floor(dh / cellSize);
    if (imgCols <= 0 || imgRows <= 0) return;

    // Render source at exactly imgCols × imgRows so each pixel = one cell
    let pixels;
    try {
      const off = document.createElement('canvas');
      off.width = imgCols;
      off.height = imgRows;
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      offCtx.fillStyle = '#fff';
      offCtx.fillRect(0, 0, imgCols, imgRows);
      offCtx.drawImage(src, 0, 0, imgCols, imgRows);
      pixels = offCtx.getImageData(0, 0, imgCols, imgRows).data;
    } catch (e) {
      this._drawFitted(ctx, W, H, state);
      return;
    }

    // Build brightness grid with contrast boost
    const bright = new Float32Array(imgCols * imgRows);
    for (let i = 0; i < imgCols * imgRows; i++) {
      const idx = i * 4;
      let b = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
      // Contrast: push values away from 0.5 toward 0 or 1
      if (contrast > 1) {
        b = (b - 0.5) * contrast + 0.5;
        b = Math.max(0, Math.min(1, b));
      }
      bright[i] = b;
    }

    // If mirror: force left/right symmetry by averaging then mirroring
    if (mirror) {
      const halfCols = Math.ceil(imgCols / 2);
      for (let row = 0; row < imgRows; row++) {
        for (let col = 0; col < halfCols; col++) {
          const mirrorCol = imgCols - 1 - col;
          if (mirrorCol === col) continue;
          const leftIdx = row * imgCols + col;
          const rightIdx = row * imgCols + mirrorCol;
          // Use the darker value (for invert: catches lines on either side)
          const val = Math.min(bright[leftIdx], bright[rightIdx]);
          bright[leftIdx] = val;
          bright[rightIdx] = val;
        }
      }
    }

    // Center the dot grid within the fitted image area
    const gridW = imgCols * cellSize;
    const gridH = imgRows * cellSize;
    const offsetX = dx + (dw - gridW) / 2;
    const offsetY = dy + (dh - gridH) / 2;

    ctx.beginPath();
    for (let row = 0; row < imgRows; row++) {
      for (let col = 0; col < imgCols; col++) {
        const b = bright[row * imgCols + col];
        const placeDot = inv ? (b <= threshold) : (b >= threshold);
        if (!placeDot) continue;

        const cx = offsetX + (col + 0.5) * cellSize;
        const cy = offsetY + (row + 0.5) * cellSize;
        ctx.moveTo(cx + radius, cy);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  render(engine, ctx, W, H, state) {
    if (!this._source) return;

    // If no effect selected or effect is 'none', just draw the image fitted
    const effect = state.ip_effect || 'none';
    if (effect === 'none') {
      this._drawFitted(ctx, W, H, state);
      return;
    }

    // Needlework uses Canvas 2D (no WebGL) for guaranteed round dots
    if (effect === 'needlework') {
      this._renderNeedlework(ctx, W, H, state);
      return;
    }

    // Try WebGL rendering, fall back to fitted 2D draw
    const glCanvas = engine.getGLCanvas();
    const gl = engine.getGL();
    if (!gl) {
      this._drawFitted(ctx, W, H, state);
      return;
    }

    const distortion = DISTORTIONS[effect];
    if (!distortion) {
      this._drawFitted(ctx, W, H, state);
      return;
    }

    // Ensure quad
    if (!this._quad || this._gl !== gl) {
      this._gl = gl;
      this._glCanvas = glCanvas;
      this._quad = new Quad(gl);
    }

    // Compile shader if needed
    if (!this._programs[effect]) {
      this._programs[effect] = createProgram(gl, VERT, distortion.frag);
    }
    const prog = this._programs[effect];
    if (!prog) return;

    // Upload source image as texture
    if (!this._texture) {
      this._texture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._source);
    } catch (e) {
      // Video may not be ready
      return;
    }

    const pW = glCanvas.width;
    const pH = glCanvas.height;
    gl.viewport(0, 0, pW, pH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);

    // Mirror X for webcam (video sources)
    const mirrorLoc = gl.getUniformLocation(prog, 'u_mirror');
    // Mirror only live camera streams (selfie view). Uploaded videos render unflipped.
    const isCameraStream = !!(this._source && this._source.srcObject);
    if (mirrorLoc !== null) gl.uniform1f(mirrorLoc, isCameraStream ? 1.0 : 0.0);

    // Bind image texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    const imgLoc = gl.getUniformLocation(prog, 'u_image');
    if (imgLoc !== null) gl.uniform1i(imgLoc, 0);

    // For feedback effect, handle previous frame texture
    if (effect === 'feedback') {
      this._setupFeedback(gl, prog, pW, pH);
    }

    // Set resolution uniform
    const resLoc = gl.getUniformLocation(prog, 'u_resolution');
    if (resLoc !== null) gl.uniform2f(resLoc, pW, pH);

    // Set effect-specific uniforms
    const uniforms = distortion.uniforms(state);
    this._quad.render(gl, prog, uniforms);

    // For feedback, capture current frame
    if (effect === 'feedback') {
      this._captureFeedback(gl, pW, pH);
    }

    // Composite to 2D canvas with scale/offset
    const iw = this._source.videoWidth || this._source.naturalWidth || this._source.width;
    const ih = this._source.videoHeight || this._source.naturalHeight || this._source.height;
    const userScale = state.ip_scale || 1;
    const fitScale = Math.min(W / (iw || W), H / (ih || H)) * userScale;
    const dw = (iw || W) * fitScale;
    const dh = (ih || H) * fitScale;
    const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
    const dy = (H - dh) / 2 + (state.ip_offsetY || 0);
    ctx.drawImage(glCanvas, dx, dy, dw, dh);
  }

  _setupFeedback(gl, prog, w, h) {
    // Create previous frame texture + FBO if needed
    if (!this._prevTexture) {
      this._prevTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._prevTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    // Bind prev texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._prevTexture);
    const prevLoc = gl.getUniformLocation(prog, 'u_prev');
    if (prevLoc !== null) gl.uniform1i(prevLoc, 1);

    const hasPrevLoc = gl.getUniformLocation(prog, 'u_hasPrev');
    if (hasPrevLoc !== null) gl.uniform1f(hasPrevLoc, this._hasPrevFrame ? 1.0 : 0.0);

    // Reset active texture to 0
    gl.activeTexture(gl.TEXTURE0);
  }

  _captureFeedback(gl, w, h) {
    if (!this._prevTexture) return;
    // Copy current framebuffer to prevTexture
    gl.bindTexture(gl.TEXTURE_2D, this._prevTexture);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._hasPrevFrame = true;
  }
}

export const imageProcessor = new ImageProcessor();
