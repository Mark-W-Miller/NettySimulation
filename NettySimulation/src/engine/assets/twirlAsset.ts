// twirlAsset.ts — generates a translucent spinning ring mesh

import type { SphereMesh } from './sphereAsset';

export type TwirlMesh = SphereMesh;

export function createTwirlMesh(
  gl: WebGLRenderingContext,
  radialSegments = 96,
  patternRepeats = 24,
): TwirlMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const rows = 2;
  const halfHeight = 0.5;

  for (let i = 0; i <= radialSegments; i += 1) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Pattern intensity oscillates to mimic < and > markings.
    const patternPhase = (i / radialSegments) * patternRepeats;
    const pattern = Math.abs(((patternPhase % 1) - 0.5) * 2); // triangle wave 0 -> 1 -> 0
    const intensity = 0.35 + 0.45 * (1 - pattern); // brighter at arrow tips

    for (let row = 0; row < rows; row += 1) {
      const y = row === 0 ? halfHeight : -halfHeight;
      positions.push(cos, y, sin);
      normals.push(cos, 0, sin);
      colors.push(intensity, intensity, intensity);
    }
  }

  for (let i = 0; i < radialSegments; i += 1) {
    const top0 = i * rows;
    const bottom0 = top0 + 1;
    const top1 = top0 + rows;
    const bottom1 = top1 + 1;

    indices.push(top0, bottom0, top1);
    indices.push(top1, bottom0, bottom1);
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
