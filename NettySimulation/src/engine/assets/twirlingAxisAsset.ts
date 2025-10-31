// twirlingAxisAsset.ts — constructs a two-axis mesh with endcap spheres for twirling displays

import {
  AXIS_COLORS,
  DEFAULT_AXIS_RADIUS,
  type AxisDrawParams,
  type AxisProgram,
} from './axisAsset';

export interface TwirlingAxisMesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  alphaBuffer: WebGLBuffer;
  opacityBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  lineIndexBuffer: WebGLBuffer | null;
  indexCount: number;
  lineIndexCount: number;
}

interface TwirlingAxisGeometry {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  opacityFlags: Float32Array;
  indices: Uint16Array;
  lineIndices: Uint16Array;
}

const CYLINDER_SEGMENTS = 32;
const SPHERE_SEGMENTS = 24;
const SPHERE_RINGS = 16;
const BASE_AXIS_LENGTH = 2.0;
const BASE_AXIS_RADIUS = DEFAULT_AXIS_RADIUS / 4;
const BALL_RADIUS_SCALE = 1.5;

export function createTwirlingAxisMesh(gl: WebGLRenderingContext): TwirlingAxisMesh {
  const geometry = buildTwirlingAxisGeometry();
  return uploadTwirlingAxisMesh(gl, geometry);
}

export function disposeTwirlingAxisMesh(gl: WebGLRenderingContext, mesh: TwirlingAxisMesh | null): void {
  if (!mesh) {
    return;
  }
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.colorBuffer);
  gl.deleteBuffer(mesh.alphaBuffer);
  gl.deleteBuffer(mesh.opacityBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
  if (mesh.lineIndexBuffer) {
    gl.deleteBuffer(mesh.lineIndexBuffer);
  }
}

export function drawTwirlingAxis(
  gl: WebGLRenderingContext,
  axisProgram: AxisProgram,
  mesh: TwirlingAxisMesh,
  params: AxisDrawParams,
): void {
  gl.uniformMatrix4fv(axisProgram.uniformModel, false, params.modelMatrix);
  gl.uniformMatrix3fv(axisProgram.uniformNormalMatrix, false, params.normalMatrix);
  gl.uniform1f(axisProgram.uniformClipEnabled, params.clipEnabled ? 1.0 : 0.0);
  gl.uniform3fv(axisProgram.uniformClipCenter, params.clipCenter);
  gl.uniform1f(axisProgram.uniformClipRadius, params.clipRadius);
  gl.uniform1f(axisProgram.uniformOpacity, params.opacity);
  gl.uniform1f(axisProgram.uniformUseSolidColor, 0.0);
  gl.uniform1f(axisProgram.uniformUseSolidAlpha, 0.0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(axisProgram.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(axisProgram.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
  gl.vertexAttribPointer(axisProgram.attribColor, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribColor);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.alphaBuffer);
  gl.vertexAttribPointer(axisProgram.attribAlpha, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribAlpha);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.opacityBuffer);
  gl.vertexAttribPointer(axisProgram.attribOpacityFlag, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribOpacityFlag);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);

  if (mesh.lineIndexBuffer && mesh.lineIndexCount > 0) {
    gl.uniform1f(axisProgram.uniformUseSolidColor, 1.0);
    gl.uniform3f(axisProgram.uniformSolidColor, 0.0, 0.0, 0.0);
    gl.uniform1f(axisProgram.uniformUseSolidAlpha, 1.0);
    gl.uniform1f(axisProgram.uniformSolidAlpha, 1.0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.lineIndexBuffer);
    gl.drawElements(gl.LINES, mesh.lineIndexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.uniform1f(axisProgram.uniformUseSolidColor, 0.0);
    gl.uniform1f(axisProgram.uniformUseSolidAlpha, 0.0);
  }
}

function buildTwirlingAxisGeometry(): TwirlingAxisGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const alphas: number[] = [];
  const opacityFlags: number[] = [];
  const indices: number[] = [];
  const lineIndices: number[] = [];

  const length = BASE_AXIS_LENGTH;
  const radius = BASE_AXIS_RADIUS;
  const ballRadius = radius * BALL_RADIUS_SCALE;

  appendAxisLeg('x', length, radius, CYLINDER_SEGMENTS, AXIS_COLORS.x, positions, normals, colors, alphas, opacityFlags, indices, lineIndices);
  appendSphere([length / 2, 0, 0], ballRadius, AXIS_COLORS.x, positions, normals, colors, alphas, opacityFlags, indices);

  appendAxisLeg('y', length, radius, CYLINDER_SEGMENTS, AXIS_COLORS.y, positions, normals, colors, alphas, opacityFlags, indices, lineIndices);
  appendSphere([0, length / 2, 0], ballRadius, AXIS_COLORS.y, positions, normals, colors, alphas, opacityFlags, indices);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    alphas: new Float32Array(alphas),
    opacityFlags: new Float32Array(opacityFlags),
    indices: new Uint16Array(indices),
    lineIndices: new Uint16Array(lineIndices),
  };
}

function appendAxisLeg(
  axis: 'x' | 'y',
  length: number,
  radius: number,
  segments: number,
  color: [number, number, number],
  positions: number[],
  normals: number[],
  colors: number[],
  alphas: number[],
  opacityFlags: number[],
  indices: number[],
  lineIndices: number[],
): void {
  const baseIndex = positions.length / 3;
  const startHeight = 0;
  const endHeight = length / 2;

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    pushAxisVertex(axis, endHeight, cos, sin, radius, positions, normals);
    colors.push(color[0], color[1], color[2]);
    alphas.push(1);
    opacityFlags.push(1);

    pushAxisVertex(axis, startHeight, cos, sin, radius, positions, normals);
    colors.push(color[0], color[1], color[2]);
    alphas.push(1);
    opacityFlags.push(1);
  }

  for (let i = 0; i < segments; i += 1) {
    const top1 = baseIndex + i * 2;
    const bottom1 = top1 + 1;
    const top2 = top1 + 2;
    const bottom2 = top1 + 3;

    indices.push(top1, bottom1, top2);
    indices.push(top2, bottom1, bottom2);

    const nextTop = baseIndex + ((i + 1) % segments) * 2;
    const nextBottom = nextTop + 1;
    lineIndices.push(top1, bottom1);
    lineIndices.push(top1, nextTop);
    lineIndices.push(bottom1, nextBottom);
  }
}

function appendSphere(
  center: [number, number, number],
  radius: number,
  color: [number, number, number],
  positions: number[],
  normals: number[],
  colors: number[],
  alphas: number[],
  opacityFlags: number[],
  indices: number[],
): void {
  const baseIndex = positions.length / 3;

  for (let ring = 0; ring <= SPHERE_RINGS; ring += 1) {
    const v = ring / SPHERE_RINGS;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let segment = 0; segment <= SPHERE_SEGMENTS; segment += 1) {
      const u = segment / SPHERE_SEGMENTS;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const nx = sinTheta * cosPhi;
      const ny = cosTheta;
      const nz = sinTheta * sinPhi;

      positions.push(center[0] + radius * nx, center[1] + radius * ny, center[2] + radius * nz);
      normals.push(nx, ny, nz);
      colors.push(color[0], color[1], color[2]);
      alphas.push(1);
      opacityFlags.push(0);
    }
  }

  const stride = SPHERE_SEGMENTS + 1;
  for (let ring = 0; ring < SPHERE_RINGS; ring += 1) {
    for (let segment = 0; segment < SPHERE_SEGMENTS; segment += 1) {
      const first = baseIndex + ring * stride + segment;
      const second = first + stride;

      indices.push(first, second, first + 1);
      indices.push(first + 1, second, second + 1);
    }
  }
}

function uploadTwirlingAxisMesh(gl: WebGLRenderingContext, geometry: TwirlingAxisGeometry): TwirlingAxisMesh {
  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const alphaBuffer = gl.createBuffer();
  const opacityBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const lineIndexBuffer = geometry.lineIndices.length > 0 ? gl.createBuffer() : null;

  if (!positionBuffer || !normalBuffer || !colorBuffer || !alphaBuffer || !opacityBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for twirling axis mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.colors, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.alphas, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, opacityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.opacityFlags, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  if (lineIndexBuffer) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.lineIndices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  }

  return {
    positionBuffer,
    normalBuffer,
    colorBuffer,
    alphaBuffer,
    opacityBuffer,
    indexBuffer,
    lineIndexBuffer,
    indexCount: geometry.indices.length,
    lineIndexCount: geometry.lineIndices.length,
  };
}

function pushAxisVertex(
  axis: 'x' | 'y',
  height: number,
  cos: number,
  sin: number,
  radius: number,
  positions: number[],
  normals: number[],
): void {
  switch (axis) {
    case 'x':
      positions.push(height, radius * cos, radius * sin);
      normals.push(0, cos, sin);
      break;
    case 'y':
      positions.push(radius * cos, height, radius * sin);
      normals.push(cos, 0, sin);
      break;
  }
}
