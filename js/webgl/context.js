/**
 * WebGL context utilities.
 * Provides helpers for context creation, shader compilation, textures, and FBOs.
 */

/**
 * Get a WebGL2 context (or WebGL1 fallback) from a canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {WebGL2RenderingContext|WebGLRenderingContext|null}
 */
export function initGL(canvas) {
  const opts = { antialias: false, alpha: true, premultipliedAlpha: false };

  let gl = canvas.getContext('webgl2', opts);
  if (gl) {
    gl._version = 2;
    return gl;
  }

  gl = canvas.getContext('webgl', opts) ||
       canvas.getContext('experimental-webgl', opts);
  if (gl) {
    gl._version = 1;
  }

  // Handle context loss
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    console.warn('[WebGL] Context lost.');
  });

  canvas.addEventListener('webglcontextrestored', () => {
    console.info('[WebGL] Context restored.');
  });

  return gl || null;
}

/**
 * Compile and link a WebGL program from vertex + fragment source strings.
 * @param {WebGLRenderingContext} gl
 * @param {string} vertSrc
 * @param {string} fragSrc
 * @returns {WebGLProgram|null}
 */
export function createProgram(gl, vertSrc, fragSrc) {
  const vert = _compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = _compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[WebGL] Program link error:', gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return null;
  }

  // Clean up compiled shaders (linked into program, no longer needed)
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return prog;
}

/**
 * Create an RGBA float texture of the given dimensions.
 * Falls back to UNSIGNED_BYTE on devices that lack float texture support.
 * @param {WebGLRenderingContext} gl
 * @param {number} width
 * @param {number} height
 * @returns {WebGLTexture}
 */
export function createTexture(gl, width, height) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // Attempt RGBA float; fall back to UNSIGNED_BYTE
  let internalFormat = gl.RGBA;
  let type = gl.UNSIGNED_BYTE;

  if (gl._version === 2) {
    // WebGL2 has standardised float textures
    internalFormat = gl.RGBA32F;
    type = gl.FLOAT;
  } else if (gl.getExtension('OES_texture_float')) {
    type = gl.FLOAT;
  }

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    gl.RGBA,
    type,
    null
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/**
 * Create a framebuffer object (FBO) attached to an existing texture.
 * @param {WebGLRenderingContext} gl
 * @param {WebGLTexture} texture
 * @returns {WebGLFramebuffer|null}
 */
export function createFramebuffer(gl, texture) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('[WebGL] Framebuffer incomplete, status:', status);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    return null;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeName = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
    console.error(`[WebGL] ${typeName} shader compile error:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
