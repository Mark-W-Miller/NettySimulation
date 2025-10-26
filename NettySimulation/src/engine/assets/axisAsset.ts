// axisAsset.ts — constructs cylinder meshes for each principal axis

export interface AxisMesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface AxisSet {
  x: AxisMesh;
  y: AxisMesh;
  z: AxisMesh;
}

const AXIS_COLORS: Record<'x' | 'y' | 'z', [number, number, number]> = {
  x: [0.2, 0.9, 0.5],
  y: [0.95, 0.93, 0.4],
  z: [0.38, 0.62, 1.0],
};

export function createAxisSet(gl: WebGLRenderingContext): AxisSet {
  return {
    x: createAxisMesh(gl, 'x'),
    y: createAxisMesh(gl, 'y'),
    z: createAxisMesh(gl, 'z'),
  };
}

export function disposeAxisSet(gl: WebGLRenderingContext, set: AxisSet | null): void {
  if (!set) {
    return;
  }

  disposeAxisMesh(gl, set.x);
  disposeAxisMesh(gl, set.y);
  disposeAxisMesh(gl, set.z);
}

function createAxisMesh(gl: WebGLRenderingContext, axis: 'x' | 'y' | 'z'): AxisMesh {
  const length = 3.6;
  const radius = 0.12;
  const segments = 32;
  const { positions, normals, colors, indices } = buildCylinderGeometry(axis, length, radius, segments, AXIS_COLORS[axis]);

  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();

  if (!positionBuffer || !normalBuffer || !colorBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for axis mesh.');
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

function disposeAxisMesh(gl: WebGLRenderingContext, mesh: AxisMesh | null): void {
  if (!mesh) {
    return;
  }

  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.colorBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

function buildCylinderGeometry(
  axis: 'x' | 'y' | 'z',
  length: number,
  radius: number,
  segments: number,
  color: [number, number, number],
): {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
} {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const halfLength = length / 2;

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    pushVertex(axis, halfLength, cos, sin, radius, positions, normals);
    colors.push(...color);
    pushVertex(axis, -halfLength, cos, sin, radius, positions, normals);
    colors.push(...color);
  }

  for (let i = 0; i < segments; i += 1) {
    const top1 = i * 2;
    const bottom1 = top1 + 1;
    const top2 = top1 + 2;
    const bottom2 = top1 + 3;

    indices.push(top1, bottom1, top2);
    indices.push(top2, bottom1, bottom2);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
  };
}

function pushVertex(
  axis: 'x' | 'y' | 'z',
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
    case 'z':
      positions.push(radius * cos, radius * sin, height);
      normals.push(cos, sin, 0);
      break;
  }
}
