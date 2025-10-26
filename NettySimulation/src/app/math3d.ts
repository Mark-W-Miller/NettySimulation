// math3d.ts — shared 3D math utilities for the NettySimulation app

export type Vec3 = [number, number, number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lengthVec3(vec: Vec3): number {
  return Math.hypot(vec[0], vec[1], vec[2]);
}

export function normalizeTuple(vec: Vec3): Vec3 {
  const len = lengthVec3(vec) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function scaleVec3(vec: Vec3, scalar: number): Vec3 {
  return [vec[0] * scalar, vec[1] * scalar, vec[2] * scalar];
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sphericalToCartesian(
  radius: number,
  azimuth: number,
  elevation: number,
  target: Vec3,
): Vec3 {
  const x = radius * Math.cos(elevation) * Math.sin(azimuth) + target[0];
  const y = radius * Math.sin(elevation) + target[1];
  const z = radius * Math.cos(elevation) * Math.cos(azimuth) + target[2];
  return [x, y, z];
}

export function mat4Identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

export function mat3Identity(): Float32Array {
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
}

export function mat4FromYRotation(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

export function mat4Perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

export function mat4LookAt(
  eye: Vec3,
  target: Vec3,
  up: Vec3,
): Float32Array {
  const [ex, ey, ez] = eye;
  const [tx, ty, tz] = target;

  let zx = ex - tx;
  let zy = ey - ty;
  let zz = ez - tz;
  let len = Math.hypot(zx, zy, zz);
  if (len === 0) {
    zx = 0;
    zy = 0;
    zz = 1;
    len = 1;
  }
  zx /= len;
  zy /= len;
  zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz);
  if (len === 0) {
    xx = 0;
    xy = 0;
    xz = 0;
  } else {
    xx /= len;
    xy /= len;
    xz /= len;
  }

  let yx = zy * xz - zz * xy;
  let yy = zz * xx - zx * xz;
  let yz = zx * xy - zy * xx;

  len = Math.hypot(yx, yy, yz);
  if (len > 0) {
    yx /= len;
    yy /= len;
    yz /= len;
  }

  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez),
    1,
  ]);
}

export function mat3FromMat4(mat: Float32Array): Float32Array {
  return new Float32Array([
    mat[0], mat[1], mat[2],
    mat[4], mat[5], mat[6],
    mat[8], mat[9], mat[10],
  ]);
}

export function normalizeVec3(vec: Vec3): Float32Array {
  const [x, y, z] = vec;
  const length = Math.hypot(x, y, z) || 1;
  return new Float32Array([x / length, y / length, z / length]);
}
