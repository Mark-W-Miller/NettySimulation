// twirl8Asset.ts — simple line-ring (circle) asset oriented around a principal axis

export interface Twirl8Mesh {
  positionBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface Twirl8Program {
  program: WebGLProgram;
  attribPosition: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
}

export interface Twirl8SharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
}

export interface Twirl8DrawParams {
  modelMatrix: Float32Array;
  color: Float32Array; // vec4 RGBA
}

export function createTwirl8Mesh(gl: WebGLRenderingContext, segments = 128): Twirl8Mesh {
  const segs = Math.max(16, Math.floor(segments));
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < segs; i += 1) {
    const t = (i / segs) * Math.PI * 2;
    const x = Math.cos(t);
    const y = Math.sin(t);
    positions.push(x, y, 0);
    indices.push(i);
  }
  // Close the loop
  indices.push(0);

  const positionBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for twirl-8 mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    positionBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeTwirl8Mesh(gl: WebGLRenderingContext, mesh: Twirl8Mesh | null): void {
  if (!mesh) return;
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

export function createTwirl8Program(gl: WebGLRenderingContext): Twirl8Program {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main() {
      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `;

  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create twirl-8 program.');
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(`Failed to link twirl-8 program: ${info ?? 'unknown error'}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const attribPosition = gl.getAttribLocation(program, 'aPosition');
  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');

  return {
    program,
    attribPosition,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformColor,
  };
}

export function disposeTwirl8Program(gl: WebGLRenderingContext, program: Twirl8Program | null): void {
  if (!program) return;
  gl.deleteProgram(program.program);
}

export function useTwirl8Program(gl: WebGLRenderingContext, program: Twirl8Program): void {
  gl.useProgram(program.program);
}

export function setTwirl8SharedUniforms(
  gl: WebGLRenderingContext,
  program: Twirl8Program,
  uniforms: Twirl8SharedUniforms,
): void {
  gl.uniformMatrix4fv(program.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(program.uniformProjection, false, uniforms.projectionMatrix);
}

export function drawTwirl8(
  gl: WebGLRenderingContext,
  program: Twirl8Program,
  mesh: Twirl8Mesh,
  params: Twirl8DrawParams,
): void {
  gl.uniformMatrix4fv(program.uniformModel, false, params.modelMatrix);
  gl.uniform4fv(program.uniformColor, params.color);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

  const wasBlend = gl.isEnabled(gl.BLEND);
  if (!wasBlend) gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);
  gl.drawElements(gl.LINE_STRIP, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.enable(gl.CULL_FACE);
  if (!wasBlend) gl.disable(gl.BLEND);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create WebGL shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failure: ${info ?? 'unknown error'}`);
  }
  return shader;
}

function getRequiredUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Uniform ${name} is missing.`);
  }
  return location;
}
