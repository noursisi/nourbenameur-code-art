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
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
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

  displacement: {
    name: 'Displacement Map',
    params: [
      { id: 'ip_displace_amount', label: 'Amount', min: 0, max: 0.3, step: 0.005, default: 0.05 },
      { id: 'ip_displace_scale', label: 'Scale', min: 1, max: 20, step: 0.5, default: 4 },
      { id: 'ip_displace_speed', label: 'Speed', min: 0, max: 2, step: 0.05, default: 0.3 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_scale;
uniform float u_time;

${NOISE_2D}
${FBM}

void main() {
  vec2 uv = v_uv;
  float n1 = fbm(uv * u_scale + u_time * 0.5);
  float n2 = fbm(uv * u_scale + vec2(5.2, 1.3) + u_time * 0.5);
  uv += vec2(n1, n2) * u_amount;
  uv = clamp(uv, 0.0, 1.0);
  gl_FragColor = texture2D(u_image, uv);
}
`,
    uniforms: (s) => ({
      u_amount: s.ip_displace_amount ?? 0.05,
      u_scale: s.ip_displace_scale ?? 4,
      u_time: s.time ?? 0,
    }),
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

  kaleidoscope: {
    name: 'Kaleidoscope',
    params: [
      { id: 'ip_kal_segments', label: 'Segments', min: 2, max: 24, step: 1, default: 6 },
      { id: 'ip_kal_rotation', label: 'Rotation', min: 0, max: 6.28, step: 0.05, default: 0 },
      { id: 'ip_kal_zoom', label: 'Zoom', min: 0.2, max: 3, step: 0.05, default: 1 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_segments;
uniform float u_rotation;
uniform float u_zoom;

#define PI 3.14159265359

void main() {
  vec2 uv = (v_uv - 0.5) * u_zoom;

  float angle = atan(uv.y, uv.x) + u_rotation;
  float r = length(uv);

  float segAngle = 2.0 * PI / u_segments;
  angle = mod(angle, segAngle);
  // Mirror
  if (angle > segAngle * 0.5) angle = segAngle - angle;

  vec2 kUV = vec2(cos(angle), sin(angle)) * r + 0.5;
  kUV = clamp(kUV, 0.0, 1.0);
  gl_FragColor = texture2D(u_image, kUV);
}
`,
    uniforms: (s) => ({
      u_segments: s.ip_kal_segments ?? 6,
      u_rotation: s.ip_kal_rotation ?? 0,
      u_zoom: s.ip_kal_zoom ?? 1,
    }),
  },

  wave: {
    name: 'Wave Distortion',
    params: [
      { id: 'ip_wave_amp', label: 'Amplitude', min: 0, max: 0.1, step: 0.002, default: 0.02 },
      { id: 'ip_wave_freq', label: 'Frequency', min: 1, max: 40, step: 0.5, default: 10 },
      { id: 'ip_wave_speed', label: 'Speed', min: 0, max: 5, step: 0.1, default: 1 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_amp;
uniform float u_freq;
uniform float u_speed;
uniform float u_time;

void main() {
  vec2 uv = v_uv;
  uv.x += sin(uv.y * u_freq + u_time * u_speed) * u_amp;
  uv.y += cos(uv.x * u_freq + u_time * u_speed * 0.7) * u_amp;
  uv = clamp(uv, 0.0, 1.0);
  gl_FragColor = texture2D(u_image, uv);
}
`,
    uniforms: (s) => ({
      u_amp: s.ip_wave_amp ?? 0.02,
      u_freq: s.ip_wave_freq ?? 10,
      u_speed: s.ip_wave_speed ?? 1,
      u_time: s.time ?? 0,
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

  voronoiMosaic: {
    name: 'Voronoi Mosaic',
    params: [
      { id: 'ip_vmosaic_cells', label: 'Cells', min: 5, max: 100, step: 1, default: 30 },
      { id: 'ip_vmosaic_edge', label: 'Edge Width', min: 0, max: 0.05, step: 0.001, default: 0.01 },
    ],
    frag: /* glsl */`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_cells;
uniform float u_edge;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  vec2 cell = uv * u_cells;
  vec2 iCell = floor(cell);
  vec2 fCell = fract(cell);

  float minDist = 10.0;
  vec2 minPoint = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(iCell + neighbor);
      vec2 diff = neighbor + point - fCell;
      float dist = length(diff);
      if (dist < minDist) {
        minDist = dist;
        minPoint = (iCell + neighbor + point) / u_cells;
      }
    }
  }

  // Sample image at the cell center
  vec4 col = texture2D(u_image, clamp(minPoint, 0.0, 1.0));

  // Edge darkening
  float edgeFactor = smoothstep(0.0, u_edge * u_cells, minDist);
  col.rgb *= mix(0.2, 1.0, edgeFactor);

  gl_FragColor = col;
}
`,
    uniforms: (s) => ({
      u_cells: s.ip_vmosaic_cells ?? 30,
      u_edge: s.ip_vmosaic_edge ?? 0.01,
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

  /** Set a video element as the processor source (for camera) */
  setVideoSource(video) {
    this._source = video;
    this._sourceType = 'video';
    this._hasPrevFrame = false;
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
  render(engine, ctx, W, H, state) {
    if (!this._source) return;

    // If no effect selected or effect is 'none', just draw the image as-is
    const effect = state.ip_effect || 'none';
    if (effect === 'none') {
      try { ctx.drawImage(this._source, 0, 0, W, H); } catch(e) {}
      return;
    }

    // Try WebGL rendering, fall back to simple 2D canvas draw
    const glCanvas = engine.getGLCanvas();
    const gl = engine.getGL();
    if (!gl) {
      try { ctx.drawImage(this._source, 0, 0, W, H); } catch(e) {}
      return;
    }

    const distortion = DISTORTIONS[effect];
    if (!distortion) {
      try { ctx.drawImage(this._source, 0, 0, W, H); } catch(e) {}
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

    // Composite to 2D canvas
    ctx.drawImage(glCanvas, 0, 0, W, H);
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
