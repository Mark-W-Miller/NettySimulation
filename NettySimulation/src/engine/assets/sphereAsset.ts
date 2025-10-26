// sphereAsset.ts — builds and disposes the Babylon-like sphere mesh buffers

export interface SphereMesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export function createSphereMesh(
  gl: WebGLRenderingContext,
  latitudeBands = 48,
  longitudeBands = 48,
): SphereMesh {
  const { positions, normals, colors, indices } = buildSphereGeometry(latitudeBands, longitudeBands);

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();

  if (!positionBuffer || !normalBuffer || !colorBuffer || !indexBuffer) {
    throw new Error('Failed to allocate sphere buffers.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return {
    positionBuffer,
    normalBuffer,
    colorBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeSphereMesh(gl: WebGLRenderingContext, mesh: SphereMesh | null): void {
  if (!mesh) {
    return;
  }

  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.colorBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

function buildSphereGeometry(latitudeBands: number, longitudeBands: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const lightColor: [number, number, number] = [0.62, 0.82, 1.0];
  const darkColor: [number, number, number] = [0.1, 0.24, 0.55];

  for (let lat = 0; lat <= latitudeBands; lat += 1) {
    const theta = (lat * Math.PI) / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longitudeBands; lon += 1) {
      const phi = (lon * 2 * Math.PI) / longitudeBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      const isLightSquare = (lat + lon) % 2 === 0;
      const color = isLightSquare ? lightColor : darkColor;

      positions.push(x, y, z);
      normals.push(x, y, z);
      colors.push(...color);
    }
  }

  const columns = longitudeBands + 1;

  for (let lat = 0; lat < latitudeBands; lat += 1) {
    for (let lon = 0; lon < longitudeBands; lon += 1) {
      const first = lat * columns + lon;
      const second = first + columns;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
  };
}
