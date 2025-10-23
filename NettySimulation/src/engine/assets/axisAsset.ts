// axisAsset.ts — constructs the XYZ axis mesh buffers for the WebGL scene

export interface AxisMesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export function createAxisMesh(gl: WebGLRenderingContext): AxisMesh {
  const axisLength = 3.6;
  const axisThickness = 0.18;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const addPrism = (
    axis: 'x' | 'y' | 'z',
    range: [number, number],
    color: [number, number, number],
  ) => {
    const [minRange, maxRange] = range;
    const half = axisThickness / 2;

    const bounds = {
      minX: axis === 'x' ? minRange : -half,
      maxX: axis === 'x' ? maxRange : half,
      minY: axis === 'y' ? minRange : -half,
      maxY: axis === 'y' ? maxRange : half,
      minZ: axis === 'z' ? minRange : -half,
      maxZ: axis === 'z' ? maxRange : half,
    };

    const verts: Array<[number, number, number]> = [
      [bounds.minX, bounds.minY, bounds.minZ],
      [bounds.maxX, bounds.minY, bounds.minZ],
      [bounds.maxX, bounds.maxY, bounds.minZ],
      [bounds.minX, bounds.maxY, bounds.minZ],
      [bounds.minX, bounds.minY, bounds.maxZ],
      [bounds.maxX, bounds.minY, bounds.maxZ],
      [bounds.maxX, bounds.maxY, bounds.maxZ],
      [bounds.minX, bounds.maxY, bounds.maxZ],
    ];

    const faces: Array<{ indices: [number, number, number, number]; normal: [number, number, number] }> = [
      { indices: [0, 1, 2, 3], normal: [0, 0, -1] },
      { indices: [5, 4, 7, 6], normal: [0, 0, 1] },
      { indices: [4, 0, 3, 7], normal: [-1, 0, 0] },
      { indices: [1, 5, 6, 2], normal: [1, 0, 0] },
      { indices: [3, 2, 6, 7], normal: [0, 1, 0] },
      { indices: [4, 5, 1, 0], normal: [0, -1, 0] },
    ];

    for (const face of faces) {
      const baseIndex = positions.length / 3;
      for (const idx of face.indices) {
        const [vx, vy, vz] = verts[idx];
        positions.push(vx, vy, vz);
        normals.push(...face.normal);
        colors.push(...color);
      }
      indices.push(
        baseIndex,
        baseIndex + 1,
        baseIndex + 2,
        baseIndex,
        baseIndex + 2,
        baseIndex + 3,
      );
    }
  };

  addPrism('x', [0, axisLength], [0.2, 0.9, 0.5]);
  addPrism('x', [-axisLength, 0], [0.12, 0.6, 0.32]);
  addPrism('y', [0, axisLength], [0.96, 0.94, 0.4]);
  addPrism('y', [-axisLength, 0], [0.68, 0.66, 0.18]);
  addPrism('z', [0, axisLength], [0.38, 0.62, 1.0]);
  addPrism('z', [-axisLength, 0], [0.24, 0.4, 0.76]);

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();

  if (!positionBuffer || !normalBuffer || !colorBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for axis mesh.');
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

export function disposeAxisMesh(gl: WebGLRenderingContext, mesh: AxisMesh | null): void {
  if (!mesh) {
    return;
  }

  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.colorBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}
