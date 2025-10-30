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

export interface AxisProgram {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
  attribColor: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformNormalMatrix: WebGLUniformLocation;
  uniformLightDirection: WebGLUniformLocation;
  uniformClipEnabled: WebGLUniformLocation;
  uniformClipCenter: WebGLUniformLocation;
  uniformClipRadius: WebGLUniformLocation;
  uniformOpacity: WebGLUniformLocation;
}

export interface AxisSharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  lightDirection: Float32Array;
}

export interface AxisDrawParams {
  modelMatrix: Float32Array;
  normalMatrix: Float32Array;
  clipEnabled: boolean;
  clipCenter: Float32Array;
  clipRadius: number;
  opacity: number;
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

export function createAxisProgram(gl: WebGLRenderingContext): AxisProgram {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vColor;

    void main() {
      vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vColor = aColor;
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vColor;

    uniform vec3 uLightDirection;
    uniform float uClipEnabled;
    uniform vec3 uClipCenter;
    uniform float uClipRadius;
    uniform float uOpacity;

    void main() {
      if (uClipEnabled > 0.5) {
        float distanceToCenter = distance(vWorldPosition, uClipCenter);
        if (distanceToCenter < uClipRadius) {
          discard;
        }
      }

      vec3 normal = normalize(vNormal);
      float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
      float ambient = 0.35;
      vec3 shaded = vColor * (ambient + (1.0 - ambient) * diffuse);
      gl_FragColor = vec4(clamp(shaded, 0.0, 1.0), clamp(uOpacity, 0.0, 1.0));
    }
  `;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create axis program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`Failed to link axis program: ${info ?? 'unknown error'}`);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  const attribPosition = gl.getAttribLocation(program, 'aPosition');
  const attribNormal = gl.getAttribLocation(program, 'aNormal');
  const attribColor = gl.getAttribLocation(program, 'aColor');

  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformNormalMatrix = getRequiredUniform(gl, program, 'uNormalMatrix');
  const uniformLightDirection = getRequiredUniform(gl, program, 'uLightDirection');
  const uniformClipEnabled = getRequiredUniform(gl, program, 'uClipEnabled');
  const uniformClipCenter = getRequiredUniform(gl, program, 'uClipCenter');
  const uniformClipRadius = getRequiredUniform(gl, program, 'uClipRadius');
  const uniformOpacity = getRequiredUniform(gl, program, 'uOpacity');

  return {
    program,
    attribPosition,
    attribNormal,
    attribColor,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformNormalMatrix,
    uniformLightDirection,
    uniformClipEnabled,
    uniformClipCenter,
    uniformClipRadius,
    uniformOpacity,
  };
}

export function disposeAxisProgram(gl: WebGLRenderingContext, axisProgram: AxisProgram | null): void {
  if (!axisProgram) {
    return;
  }
  gl.deleteProgram(axisProgram.program);
}

export function useAxisProgram(gl: WebGLRenderingContext, axisProgram: AxisProgram): void {
  gl.useProgram(axisProgram.program);
}

export function setAxisSharedUniforms(
  gl: WebGLRenderingContext,
  axisProgram: AxisProgram,
  uniforms: AxisSharedUniforms,
): void {
  gl.uniformMatrix4fv(axisProgram.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(axisProgram.uniformProjection, false, uniforms.projectionMatrix);
  gl.uniform3fv(axisProgram.uniformLightDirection, uniforms.lightDirection);
}

export function drawAxis(
  gl: WebGLRenderingContext,
  axisProgram: AxisProgram,
  mesh: AxisMesh,
  params: AxisDrawParams,
): void {
  gl.uniformMatrix4fv(axisProgram.uniformModel, false, params.modelMatrix);
  gl.uniformMatrix3fv(axisProgram.uniformNormalMatrix, false, params.normalMatrix);
  gl.uniform1f(axisProgram.uniformClipEnabled, params.clipEnabled ? 1.0 : 0.0);
  gl.uniform3fv(axisProgram.uniformClipCenter, params.clipCenter);
  gl.uniform1f(axisProgram.uniformClipRadius, params.clipRadius);
  gl.uniform1f(axisProgram.uniformOpacity, params.opacity);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(axisProgram.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(axisProgram.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
  gl.vertexAttribPointer(axisProgram.attribColor, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(axisProgram.attribColor);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
}

function createAxisMesh(gl: WebGLRenderingContext, axis: 'x' | 'y' | 'z'): AxisMesh {
  const length = 6.2;
  const radius = 0.045;
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
  const positiveRadius = radius;
  const negativeRadius = radius * 0.55;
  const darken = 0.35;

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    pushVertex(axis, halfLength, cos, sin, positiveRadius, positions, normals);
    colors.push(...color);
    pushVertex(axis, -halfLength, cos, sin, negativeRadius, positions, normals);
    colors.push(color[0] * darken, color[1] * darken, color[2] * darken);
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
