// twirlAsset.ts — builds ring mesh and twirl-specific shader utilities

import type { SphereMesh } from './sphereAsset';

export type TwirlMesh = SphereMesh;

export interface TwirlProgram {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformNormalMatrix: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
}

export interface TwirlSharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
}

export interface TwirlDrawParams {
  modelMatrix: Float32Array;
  normalMatrix: Float32Array;
  baseColor: Float32Array;
}

export function createTwirlMesh(
  gl: WebGLRenderingContext,
  radialSegments = 96,
  longitudeBands = 48,
): TwirlMesh {
  const segmentCount = Math.max(32, radialSegments);
  const repeats = Math.max(1, Math.round(longitudeBands / 2));

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const rows = Math.max(16, Math.round(longitudeBands / 1.5));
  const halfHeight = 0.65;

  const baseIntensity = 0.9;
  const arrowIntensity = 0.02;
  const arrowWidth = 0.06;
  const ridgeExponent = 3.2;
  const slope = 0.28;

  const distanceToCenter = (value: number, center: number) => {
    const diff = Math.abs(value - center);
    return diff > 0.5 ? 1 - diff : diff;
  };

  const arrowMask = (value: number, center: number) => {
    const dist = distanceToCenter(value, center);
    if (dist >= arrowWidth) {
      return 0;
    }
    const t = 1 - dist / arrowWidth;
    return Math.pow(t, ridgeExponent);
  };

  for (let i = 0; i <= segmentCount; i += 1) {
    const theta = (i / segmentCount) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const phase = ((i / segmentCount) * repeats) % 1;

    for (let row = 0; row < rows; row += 1) {
      const t = row / (rows - 1);
      const y = halfHeight - t * (2 * halfHeight);
      const signedRow = 1 - t * 2; // 1 top -> -1 bottom
      const rowPhase = (phase + slope * signedRow + 1.0) % 1.0;

      const topMask = arrowMask(rowPhase, 0.25) + arrowMask(rowPhase, 0.75);
      const bottomMask = arrowMask(rowPhase, 0.0) + arrowMask(rowPhase, 0.5);
      const mask = signedRow >= 0 ? topMask : bottomMask;

      let intensity = baseIntensity;
      if (mask > 0) {
        const clampedMask = Math.min(mask, 1);
        intensity = arrowIntensity + (baseIntensity - arrowIntensity) * (1 - clampedMask);
      }

      positions.push(cos, y, sin);
      normals.push(cos, 0, sin);
      const finalIntensity = Math.max(arrowIntensity, Math.min(intensity, baseIntensity));
      colors.push(finalIntensity, finalIntensity, finalIntensity);
    }
  }

  for (let i = 0; i < segmentCount; i += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      const current = i * rows + row;
      const next = current + rows;

      indices.push(current, current + 1, next);
      indices.push(next, current + 1, next + 1);
    }
  }

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();

  if (!positionBuffer || !normalBuffer || !colorBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for twirl mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    positionBuffer,
    normalBuffer,
    colorBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeTwirlMesh(gl: WebGLRenderingContext, mesh: TwirlMesh | null): void {
  if (!mesh) {
    return;
  }
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.colorBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

export function createTwirlProgram(gl: WebGLRenderingContext): TwirlProgram {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;
    uniform vec4 uColor;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vBaseColor;
    varying float vAlpha;

    void main() {
      vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vBaseColor = uColor.rgb;
      vAlpha = uColor.a;
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vBaseColor;
    varying float vAlpha;

    void main() {
      gl_FragColor = vec4(vBaseColor, vAlpha);
    }
  `;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create twirl program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`Failed to link twirl program: ${info ?? 'unknown error'}`);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  const attribPosition = gl.getAttribLocation(program, 'aPosition');
  const attribNormal = gl.getAttribLocation(program, 'aNormal');
  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformNormalMatrix = getRequiredUniform(gl, program, 'uNormalMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  return {
    program,
    attribPosition,
    attribNormal,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformNormalMatrix,
    uniformColor,
  };
}

export function disposeTwirlProgram(gl: WebGLRenderingContext, twirlProgram: TwirlProgram | null): void {
  if (!twirlProgram) {
    return;
  }
  gl.deleteProgram(twirlProgram.program);
}

export function useTwirlProgram(gl: WebGLRenderingContext, program: TwirlProgram): void {
  gl.useProgram(program.program);
}

export function setTwirlSharedUniforms(
  gl: WebGLRenderingContext,
  program: TwirlProgram,
  uniforms: TwirlSharedUniforms,
): void {
  gl.uniformMatrix4fv(program.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(program.uniformProjection, false, uniforms.projectionMatrix);
}

export function drawTwirl(
  gl: WebGLRenderingContext,
  program: TwirlProgram,
  mesh: TwirlMesh,
  params: TwirlDrawParams,
): void {
  gl.uniformMatrix4fv(program.uniformModel, false, params.modelMatrix);
  gl.uniformMatrix3fv(program.uniformNormalMatrix, false, params.normalMatrix);
  gl.uniform4fv(program.uniformColor, params.baseColor);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
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
