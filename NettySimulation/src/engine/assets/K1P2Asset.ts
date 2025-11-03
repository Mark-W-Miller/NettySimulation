// K1P2Asset.ts — filled figure-eight blade asset with per-lobe twist and width controls

export interface K1P2Mesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  lobeSignBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface K1P2Program {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
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

const ORIGIN_EPSILON = 1e-4;

export function createK1P2Mesh(gl: WebGLRenderingContext, segments = 128): K1P2Mesh {
  const segs = Math.max(32, Math.floor(segments));
  const sampleCount = Math.max(16, Math.floor(segs / 2));

  const upperBoundary: Array<[number, number]> = [];
  const lowerBoundary: Array<[number, number]> = [];

  for (let i = 1; i < sampleCount; i += 1) {
    const t = (i / sampleCount) * Math.PI;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const widthShape = 0.65 + 0.35 * Math.abs(sinT);
    const heightShape = 0.55 + 0.45 * Math.abs(sinT);
    const x = sinT * widthShape;
    const y = sinT * cosT * heightShape;
    if (Math.abs(x) < ORIGIN_EPSILON && Math.abs(y) < ORIGIN_EPSILON) {
      continue;
    }
    upperBoundary.push([x, y]);
  }

  for (let i = sampleCount - 1; i > 0; i -= 1) {
    const t = (i / sampleCount) * Math.PI;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const widthShape = 0.65 + 0.35 * Math.abs(sinT);
    const heightShape = 0.55 + 0.45 * Math.abs(sinT);
    const x = sinT * widthShape;
    const y = sinT * cosT * heightShape;
    if (Math.abs(x) < ORIGIN_EPSILON && Math.abs(y) < ORIGIN_EPSILON) {
      continue;
    }
    lowerBoundary.push([-x, -y]);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const lobeSigns: number[] = [];
  const indices: number[] = [];

  const addVertex = (x: number, y: number, z: number, lobe: 1 | -1) => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    normals.push(0, 0, 1);
    lobeSigns.push(lobe);
    return index;
  };

  const buildLobe = (points: Array<[number, number]>, lobe: 1 | -1) => {
    if (points.length < 2) {
      return;
    }
    const originIndex = addVertex(0, 0, 0, lobe);
    const pointIndices: number[] = [];
    for (const [x, y] of points) {
      pointIndices.push(addVertex(x, y, 0, lobe));
    }
    const count = pointIndices.length;
    for (let i = 0; i < count; i += 1) {
      const curr = pointIndices[i];
      const next = pointIndices[(i + 1) % count];
      indices.push(originIndex, curr, next);
    }
  };

  buildLobe(upperBoundary, 1);
  buildLobe(lowerBoundary, -1);

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const lobeSignBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !normalBuffer || !lobeSignBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for K1P2 mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, lobeSignBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lobeSigns), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    positionBuffer,
    normalBuffer,
    lobeSignBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeK1P2Mesh(gl: WebGLRenderingContext, mesh: K1P2Mesh | null): void {
  if (!mesh) return;
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.lobeSignBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

export function createK1P2Program(gl: WebGLRenderingContext): K1P2Program {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aLobeSign;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uWidth;
    uniform float uLobeRotation;

    varying vec3 vNormal;

    vec3 rotateAroundAxis(vec3 v, vec3 axis, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return c * v + s * cross(axis, v) + (1.0 - c) * axis * dot(axis, v);
    }

    void main() {
      vec3 pos = aPosition;
      vec3 normal = aNormal;

      pos.xy *= uWidth;

      float angle = uLobeRotation * aLobeSign;
      vec3 axis = normalize(vec3(aPosition.xy, 0.0));
      if (length(axis) > 0.0001) {
        pos = rotateAroundAxis(pos, axis, angle);
        normal = rotateAroundAxis(normal, axis, angle);
      }

      vec4 worldPosition = uModelMatrix * vec4(pos, 1.0);
      vec3 worldNormal = normalize((uModelMatrix * vec4(normal, 0.0)).xyz);

      vNormal = worldNormal;
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 uColor;
    varying vec3 vNormal;
    void main() {
      vec3 lightDir = normalize(vec3(0.2, 0.4, 1.0));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
      float ambient = 0.25;
      float lighting = ambient + diffuse * 0.75;
      gl_FragColor = vec4(uColor.rgb * lighting, uColor.a);
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
  const attribNormal = gl.getAttribLocation(program, 'aNormal');
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
    attribNormal,
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

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.lobeSignBuffer);
  gl.vertexAttribPointer(program.attribLobeSign, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribLobeSign);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

  const wasBlend = gl.isEnabled(gl.BLEND);
  if (!wasBlend) gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
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
