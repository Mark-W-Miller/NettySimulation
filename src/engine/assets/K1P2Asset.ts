// K1P2Asset.ts — filled figure-eight blade asset with per-lobe twist and width controls

export interface K1P2Mesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  lobeSignBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
  outlinePositionBuffer: WebGLBuffer;
  outlineLobeSignBuffer: WebGLBuffer;
  outlineOffsets: number[];
  outlineCounts: number[];
  interiorPositionBuffer: WebGLBuffer;
  interiorLobeSignBuffer: WebGLBuffer;
  interiorLineCount: number;
  baseTipDistance: number;
  baseLobeWidth: number;
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
  uniformBackColor: WebGLUniformLocation;
  uniformSize: WebGLUniformLocation;
  uniformLobeWidth: WebGLUniformLocation;
  uniformLobeRotation: WebGLUniformLocation;
}

export interface K1P2OutlineProgram {
  program: WebGLProgram;
  attribPosition: number;
  attribLobeSign: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
  uniformSize: WebGLUniformLocation;
  uniformLobeWidth: WebGLUniformLocation;
  uniformLobeRotation: WebGLUniformLocation;
}

export interface K1P2SharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
}

export interface K1P2DrawParams {
  modelMatrix: Float32Array;
  color: Float32Array; // vec4 RGBA
  backColor: Float32Array; // vec4 RGBA
  size: number;
  lobeWidth: number;
  lobeRotation: number;
}

const ORIGIN_EPSILON = 1e-4;

export function createK1P2Mesh(gl: WebGLRenderingContext, segments = 128): K1P2Mesh {
  const segs = Math.max(32, Math.floor(segments));
  const sampleCount = Math.max(16, Math.floor(segs / 2));

  const upperBoundary: Array<[number, number]> = [];
  const lowerBoundary: Array<[number, number]> = [];
  let maxAbsX = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

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
    maxAbsX = Math.max(maxAbsX, Math.abs(x));
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
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
    maxAbsX = Math.max(maxAbsX, Math.abs(x));
    minY = Math.min(minY, -y);
    maxY = Math.max(maxY, -y);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const lobeSigns: number[] = [];
  const indices: number[] = [];
  const outlinePositions: number[] = [];
  const outlineLobeSigns: number[] = [];
  const outlineOffsets: number[] = [];
  const outlineCounts: number[] = [];
  const interiorPositions: number[] = [];
  const interiorLobeSigns: number[] = [];
  const baseTipDistance = Math.max(ORIGIN_EPSILON, maxAbsX);
  const baseLobeWidth = Math.max(ORIGIN_EPSILON, maxY - minY);

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

  const buildOutlineLoop = (points: Array<[number, number]>, lobe: 1 | -1) => {
    if (points.length === 0) {
      return;
    }
    const offset = outlinePositions.length / 3;
    outlineOffsets.push(offset);
    outlineCounts.push(points.length + 2);
    // start at origin
    outlinePositions.push(0, 0, 0);
    outlineLobeSigns.push(lobe);
    for (const [x, y] of points) {
      outlinePositions.push(x, y, 0);
      outlineLobeSigns.push(lobe);
    }
    // return to origin
    outlinePositions.push(0, 0, 0);
    outlineLobeSigns.push(lobe);
  };

  buildOutlineLoop(upperBoundary, 1);
  buildOutlineLoop(lowerBoundary, -1);

  const addRadialSpokes = (points: Array<[number, number]>, lobe: 1 | -1) => {
    if (points.length === 0) {
      return;
    }

    const addedKeys = new Set<string>();
    const step = Math.max(1, Math.floor(points.length / 8));
    const spokeOffset = 0.04;

    const addSpokeForPoint = (x: number, y: number) => {
      if (Math.abs(x) < ORIGIN_EPSILON && Math.abs(y) < ORIGIN_EPSILON) {
        return;
      }
      const key = `${Math.round(x * 1000)}:${Math.round(y * 1000)}`;
      if (addedKeys.has(key)) {
        return;
      }
      addedKeys.add(key);

      const length = Math.hypot(x, y);
      if (length < ORIGIN_EPSILON) {
        return;
      }
      const perpX = -y / length;
      const perpY = x / length;

      const pushLine = (sx: number, sy: number, ex: number, ey: number) => {
        interiorPositions.push(sx, sy, 0, ex, ey, 0);
        interiorLobeSigns.push(lobe, lobe);
      };

      pushLine(0, 0, x, y);
      pushLine(perpX * spokeOffset, perpY * spokeOffset, x + perpX * spokeOffset, y + perpY * spokeOffset);
      pushLine(-perpX * spokeOffset, -perpY * spokeOffset, x - perpX * spokeOffset, y - perpY * spokeOffset);
    };

    for (let i = 0; i < points.length; i += step) {
      const [x, y] = points[i];
      addSpokeForPoint(x, y);
    }

    const [firstX, firstY] = points[0];
    addSpokeForPoint(firstX, firstY);
    const [lastX, lastY] = points[points.length - 1];
    addSpokeForPoint(lastX, lastY);
  };

  addRadialSpokes(upperBoundary, 1);
  addRadialSpokes(lowerBoundary, -1);

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const lobeSignBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const outlinePositionBuffer = gl.createBuffer();
  const outlineLobeSignBuffer = gl.createBuffer();
  const interiorPositionBuffer = gl.createBuffer();
  const interiorLobeSignBuffer = gl.createBuffer();
  if (
    !positionBuffer ||
    !normalBuffer ||
    !lobeSignBuffer ||
    !indexBuffer ||
    !outlinePositionBuffer ||
    !outlineLobeSignBuffer ||
    !interiorPositionBuffer ||
    !interiorLobeSignBuffer
  ) {
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

  gl.bindBuffer(gl.ARRAY_BUFFER, outlinePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outlinePositions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, outlineLobeSignBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outlineLobeSigns), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, interiorPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(interiorPositions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, interiorLobeSignBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(interiorLobeSigns), gl.STATIC_DRAW);

  return {
    positionBuffer,
    normalBuffer,
    lobeSignBuffer,
    indexBuffer,
    indexCount: indices.length,
    outlinePositionBuffer,
    outlineLobeSignBuffer,
    outlineOffsets,
    outlineCounts,
    interiorPositionBuffer,
    interiorLobeSignBuffer,
    interiorLineCount: interiorPositions.length / 6,
    baseTipDistance,
    baseLobeWidth,
  };
}

export function disposeK1P2Mesh(gl: WebGLRenderingContext, mesh: K1P2Mesh | null): void {
  if (!mesh) return;
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.lobeSignBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
  gl.deleteBuffer(mesh.outlinePositionBuffer);
  gl.deleteBuffer(mesh.outlineLobeSignBuffer);
  gl.deleteBuffer(mesh.interiorPositionBuffer);
  gl.deleteBuffer(mesh.interiorLobeSignBuffer);
}

export function createK1P2Program(gl: WebGLRenderingContext): K1P2Program {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aLobeSign;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uSize;
    uniform float uLobeWidth;
    uniform float uLobeRotation;

    varying vec3 vNormal;
    varying vec3 vLocalPosition;
    varying float vLobeWidth;

    vec3 rotateAroundAxis(vec3 v, vec3 axis, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return c * v + s * cross(axis, v) + (1.0 - c) * axis * dot(axis, v);
    }

    void main() {
      vec3 pos = aPosition;
      vec3 normal = aNormal;

      pos.x *= uSize;
      pos.y *= uLobeWidth;

      vLocalPosition = pos;
      vLobeWidth = uLobeWidth;

      float angle = uLobeRotation * aLobeSign;
      vec3 axis = vec3(1.0, 0.0, 0.0);
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
    uniform vec4 uBackColor;
    varying vec3 vNormal;
    varying vec3 vLocalPosition;
    varying float vLobeWidth;
    void main() {
      vec3 lightDir = normalize(vec3(0.2, 0.4, 1.0));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
      float ambient = 0.25;
      float lighting = ambient + diffuse * 0.75;
      bool isFront = gl_FrontFacing;
      vec3 baseColor = isFront ? uColor.rgb : uBackColor.rgb;
      float alpha = isFront ? uColor.a : uBackColor.a;

      if (isFront) {
        float halfWidth = max(0.0001, vLobeWidth);
        float dotRadius = halfWidth * 0.075;
        vec2 local = vec2(vLocalPosition.x, vLocalPosition.y - (halfWidth * 0.65));
        float dist = length(local);
        float mask = smoothstep(dotRadius, dotRadius - (dotRadius * 0.35), dist);
        vec3 dotColor = mix(baseColor, vec3(1.0, 0.95, 0.85), 0.75);
        baseColor = mix(dotColor, baseColor, mask);
      }

      gl_FragColor = vec4(baseColor * lighting, alpha);
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
  const uniformBackColor = getRequiredUniform(gl, program, 'uBackColor');
  const uniformSize = getRequiredUniform(gl, program, 'uSize');
  const uniformLobeWidth = getRequiredUniform(gl, program, 'uLobeWidth');
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
    uniformBackColor,
    uniformSize,
    uniformLobeWidth,
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
  gl.uniform4fv(program.uniformBackColor, params.backColor);
  const sizeScale =
    mesh.baseTipDistance > ORIGIN_EPSILON ? params.size / mesh.baseTipDistance : params.size;
  const widthScale =
    mesh.baseLobeWidth > ORIGIN_EPSILON ? params.lobeWidth / mesh.baseLobeWidth : params.lobeWidth;
  gl.uniform1f(program.uniformSize, sizeScale);
  gl.uniform1f(program.uniformLobeWidth, widthScale);
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

export function createK1P2OutlineProgram(gl: WebGLRenderingContext): K1P2OutlineProgram {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute float aLobeSign;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uSize;
    uniform float uLobeWidth;
    uniform float uLobeRotation;

    vec3 rotateAroundAxis(vec3 v, vec3 axis, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return c * v + s * cross(axis, v) + (1.0 - c) * axis * dot(axis, v);
    }

    void main() {
      vec3 pos = aPosition;
      pos.x *= uSize;
      pos.y *= uLobeWidth;

      float angle = uLobeRotation * aLobeSign;
      vec3 axis = vec3(1.0, 0.0, 0.0);
      if (length(axis) > 0.0001) {
        pos = rotateAroundAxis(pos, axis, angle);
      }

      vec4 worldPosition = uModelMatrix * vec4(pos, 1.0);
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
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
    throw new Error('Failed to create K1P2 outline program.');
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(`Failed to link K1P2 outline program: ${info ?? 'unknown error'}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const attribPosition = gl.getAttribLocation(program, 'aPosition');
  const attribLobeSign = gl.getAttribLocation(program, 'aLobeSign');
  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  const uniformSize = getRequiredUniform(gl, program, 'uSize');
  const uniformLobeWidth = getRequiredUniform(gl, program, 'uLobeWidth');
  const uniformLobeRotation = getRequiredUniform(gl, program, 'uLobeRotation');

  return {
    program,
    attribPosition,
    attribLobeSign,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformColor,
    uniformSize,
    uniformLobeWidth,
    uniformLobeRotation,
  };
}

export function disposeK1P2OutlineProgram(
  gl: WebGLRenderingContext,
  program: K1P2OutlineProgram | null,
): void {
  if (!program) return;
  gl.deleteProgram(program.program);
}

export function useK1P2OutlineProgram(gl: WebGLRenderingContext, program: K1P2OutlineProgram): void {
  gl.useProgram(program.program);
}

export function setK1P2OutlineSharedUniforms(
  gl: WebGLRenderingContext,
  program: K1P2OutlineProgram,
  uniforms: K1P2SharedUniforms,
): void {
  gl.uniformMatrix4fv(program.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(program.uniformProjection, false, uniforms.projectionMatrix);
}

export function drawK1P2Outline(
  gl: WebGLRenderingContext,
  program: K1P2OutlineProgram,
  mesh: K1P2Mesh,
  params: K1P2DrawParams,
): void {
  gl.uniformMatrix4fv(program.uniformModel, false, params.modelMatrix);
  gl.uniform4fv(program.uniformColor, params.color);
  const sizeScale =
    mesh.baseTipDistance > ORIGIN_EPSILON ? params.size / mesh.baseTipDistance : params.size;
  const widthScale =
    mesh.baseLobeWidth > ORIGIN_EPSILON ? params.lobeWidth / mesh.baseLobeWidth : params.lobeWidth;
  gl.uniform1f(program.uniformSize, sizeScale);
  gl.uniform1f(program.uniformLobeWidth, widthScale);
  gl.uniform1f(program.uniformLobeRotation, params.lobeRotation);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.outlinePositionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.outlineLobeSignBuffer);
  gl.vertexAttribPointer(program.attribLobeSign, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribLobeSign);

  const wasBlend = gl.isEnabled(gl.BLEND);
  if (!wasBlend) gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);

  for (let i = 0; i < mesh.outlineCounts.length; i += 1) {
    const offset = mesh.outlineOffsets[i];
    const count = mesh.outlineCounts[i];
    gl.drawArrays(gl.LINE_STRIP, offset, count);
  }

  if (mesh.interiorLineCount > 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.interiorPositionBuffer);
    gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.interiorLobeSignBuffer);
    gl.vertexAttribPointer(program.attribLobeSign, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribLobeSign);

    gl.drawArrays(gl.LINES, 0, mesh.interiorLineCount * 2);
  }

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
