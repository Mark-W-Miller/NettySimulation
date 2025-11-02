// K1P2Asset.ts — simple line-ring (figure-eight) asset oriented around a principal axis

export interface K1P2Mesh {
  positionBuffer: WebGLBuffer;
  lobeSignBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface K1P2Program {
  program: WebGLProgram;
  attribPosition: number;
  attribLobeSign: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
  uniformWidth: WebGLUniformLocation;
  uniformLobeRotation: WebGLUniformLocation;
}

export interface K1P2SharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
}

export interface K1P2DrawParams {
  modelMatrix: Float32Array;
  color: Float32Array; // vec4 RGBA
  width: number;
  lobeRotation: number;
}

export function createK1P2Mesh(gl: WebGLRenderingContext, segments = 128): K1P2Mesh {
  const segs = Math.max(32, Math.floor(segments));
  const positions: number[] = [];
  const lobeSigns: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < segs; i += 1) {
    const t = (i / segs) * Math.PI * 2;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const denom = 1 + sinT * sinT;
    const x = (sinT / denom) * Math.SQRT2;
    const y = (sinT * cosT / denom) * Math.SQRT2;
    positions.push(x, y, 0);
    lobeSigns.push(x >= 0 ? 1 : -1);
    indices.push(i);
  }
  indices.push(0);

  const positionBuffer = gl.createBuffer();
  const lobeSignBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !lobeSignBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for K1P2 mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, lobeSignBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lobeSigns), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    positionBuffer,
    lobeSignBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeK1P2Mesh(gl: WebGLRenderingContext, mesh: K1P2Mesh | null): void {
  if (!mesh) return;
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.lobeSignBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

export function createK1P2Program(gl: WebGLRenderingContext): K1P2Program {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute float aLobeSign;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uWidth;
    uniform float uLobeRotation;
    void main() {
      vec3 pos = aPosition;
      pos.y *= uWidth;

      float angle = aLobeSign * uLobeRotation;
      float c = cos(angle);
      float s = sin(angle);
      float rotatedY = pos.y * c - pos.z * s;
      float rotatedZ = pos.y * s + pos.z * c;
      pos.y = rotatedY;
      pos.z = rotatedZ;

      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);
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
    throw new Error('Failed to create K1P2 program.');
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(`Failed to link K1P2 program: ${info ?? 'unknown error'}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const attribPosition = gl.getAttribLocation(program, 'aPosition');
  const attribLobeSign = gl.getAttribLocation(program, 'aLobeSign');
  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  const uniformWidth = getRequiredUniform(gl, program, 'uWidth');
  const uniformLobeRotation = getRequiredUniform(gl, program, 'uLobeRotation');

  return {
    program,
    attribPosition,
    attribLobeSign,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformColor,
    uniformWidth,
    uniformLobeRotation,
  };
}

export function disposeK1P2Program(gl: WebGLRenderingContext, program: K1P2Program | null): void {
  if (!program) return;
  gl.deleteProgram(program.program);
}

export function useK1P2Program(gl: WebGLRenderingContext, program: K1P2Program): void {
  gl.useProgram(program.program);
}

export function setK1P2SharedUniforms(
  gl: WebGLRenderingContext,
  program: K1P2Program,
  uniforms: K1P2SharedUniforms,
): void {
  gl.uniformMatrix4fv(program.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(program.uniformProjection, false, uniforms.projectionMatrix);
}

export function drawK1P2(
  gl: WebGLRenderingContext,
  program: K1P2Program,
  mesh: K1P2Mesh,
  params: K1P2DrawParams,
): void {
  gl.uniformMatrix4fv(program.uniformModel, false, params.modelMatrix);
  gl.uniform4fv(program.uniformColor, params.color);
  gl.uniform1f(program.uniformWidth, params.width);
  gl.uniform1f(program.uniformLobeRotation, params.lobeRotation);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.lobeSignBuffer);
  gl.vertexAttribPointer(program.attribLobeSign, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribLobeSign);

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
