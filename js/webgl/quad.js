/**
 * Quad — fullscreen quad renderer for WebGL post-processing and generative shaders.
 * Creates a simple two-triangle VAO covering clip space [-1, 1].
 */

export class Quad {
  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   */
  constructor(gl) {
    this.gl = gl;
    this._vao = null;
    this._vbo = null;
    this._init();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  _init() {
    const gl = this.gl;

    // Two triangles covering clip space:
    // (-1,-1)  (1,-1)  (1,1)
    // (-1,-1)  (1,1)  (-1,1)
    const verts = new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1, -1,
       1,  1,
      -1,  1,
    ]);

    this._vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // WebGL2: use VAO
    if (gl._version === 2 && typeof gl.createVertexArray === 'function') {
      this._vao = gl.createVertexArray();
      gl.bindVertexArray(this._vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  /**
   * Bind a program, set uniforms, and draw the fullscreen quad.
   * @param {WebGLRenderingContext} gl
   * @param {WebGLProgram} program
   * @param {Object} uniforms  — { name: value, ... }
   */
  render(gl, program, uniforms = {}) {
    gl.useProgram(program);

    // Set all uniforms
    for (const [name, value] of Object.entries(uniforms)) {
      setUniform(gl, program, name, value);
    }

    if (this._vao && gl._version === 2 && typeof gl.bindVertexArray === 'function') {
      gl.bindVertexArray(this._vao);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
      const loc = gl.getAttribLocation(program, 'a_position');
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      }
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (this._vao && gl._version === 2 && typeof gl.bindVertexArray === 'function') {
      gl.bindVertexArray(null);
    }
  }

  /**
   * Release GPU resources.
   */
  destroy() {
    const gl = this.gl;
    if (this._vao && typeof gl.deleteVertexArray === 'function') gl.deleteVertexArray(this._vao);
    if (this._vbo) gl.deleteBuffer(this._vbo);
    this._vao = null;
    this._vbo = null;
  }
}

/**
 * Set a uniform on a program by auto-detecting the value type.
 * Supported: number (float/int/bool), [x,y] (vec2), [x,y,z] (vec3), [x,y,z,w] (vec4).
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string} name
 * @param {number|boolean|number[]} value
 */
export function setUniform(gl, program, name, value) {
  const loc = gl.getUniformLocation(program, name);
  if (loc === null) return; // uniform not used in shader — silent skip

  if (typeof value === 'boolean') {
    gl.uniform1i(loc, value ? 1 : 0);
  } else if (typeof value === 'number') {
    // Distinguish int vs float by checking if it's flagged
    // Use float by default (most common for generative shaders)
    gl.uniform1f(loc, value);
  } else if (Array.isArray(value) || (value && value.length !== undefined)) {
    switch (value.length) {
      case 2: gl.uniform2fv(loc, value); break;
      case 3: gl.uniform3fv(loc, value); break;
      case 4: gl.uniform4fv(loc, value); break;
      default:
        console.warn(`[Quad] setUniform: unsupported array length ${value.length} for '${name}'`);
    }
  } else {
    console.warn(`[Quad] setUniform: unsupported value type for '${name}'`, value);
  }
}
