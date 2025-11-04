// axisAsset.ts — constructs cylinder meshes for each principal axis

/**
 * GPU buffers required to render one axis (positive + negative halves).
 */
export interface AxisHalfMesh {
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

export interface AxisMesh {
  positive: AxisHalfMesh;
  negative: AxisHalfMesh;
}

/**
 * Convenience bundle for the three primary axes.
 */
export interface AxisSet {
  x: AxisMesh;
  y: AxisMesh;
  z: AxisMesh;
}

/**
 * Attribute and uniform handles for the axis shader program.
 */
export interface AxisProgram {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
  attribColor: number;
  attribAlpha: number;
  attribOpacityFlag: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformNormalMatrix: WebGLUniformLocation;
  uniformLightDirection: WebGLUniformLocation;
  uniformClipEnabled: WebGLUniformLocation;
  uniformClipCenter: WebGLUniformLocation;
  uniformClipRadius: WebGLUniformLocation;
  uniformOpacity: WebGLUniformLocation;
  uniformUseSolidColor: WebGLUniformLocation;
  uniformSolidColor: WebGLUniformLocation;
  uniformUseSolidAlpha: WebGLUniformLocation;
  uniformSolidAlpha: WebGLUniformLocation;
}

/**
 * Matrices and lighting state shared across draw calls within a frame.
 */
export interface AxisSharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  lightDirection: Float32Array;
}

/**
 * Per-axis draw configuration (model transform, clipping, opacity).
 */
export interface AxisDrawParams {
  modelMatrix: Float32Array;
  normalMatrix: Float32Array;
  clipEnabled: boolean;
  clipCenter: Float32Array;
  clipRadius: number;
  opacity: number;
}

export const AXIS_COLORS: Record<'x' | 'y' | 'z', [number, number, number]> = {
  x: [0.2, 0.9, 0.5],
  y: [0.95, 0.93, 0.4],
  z: [0.38, 0.62, 1.0],
};

/**
 * Optional overrides for how an axis cylinder is generated.
 *
 * - `length`: total span of the cylinder measured along its axis.
 * - `radius`: radius of the circular cross-section.
 * - `segments`: number of angular slices; more segments produce a smoother cylinder.
 * - `positiveAlpha`: base opacity applied to the vertices on the positive half.
 * - `negativeAlphaScale`: multiplier that softens the opacity of the negative half.
 * - `negativeColorScale`: multiplier that darkens the colour of the negative half.
 */
export interface AxisGeometryOptions {
  length?: number;
  radius?: number;
  segments?: number;
  positiveAlpha?: number;
  negativeAlphaScale?: number;
  negativeColorScale?: number;
}

/**
 * Baseline geometry values for the primary axes.
 */
const DEFAULT_AXIS_OPTIONS: Required<AxisGeometryOptions> = {
  length: 49.6,
  radius: 0.18,
  segments: 32,
  positiveAlpha: 1.0,
  negativeAlphaScale: 0.25,
  negativeColorScale: 0.5,
};

export const DEFAULT_AXIS_LENGTH = DEFAULT_AXIS_OPTIONS.length;
export const DEFAULT_AXIS_RADIUS = DEFAULT_AXIS_OPTIONS.radius;
export const DEFAULT_AXIS_NEGATIVE_ALPHA_SCALE = DEFAULT_AXIS_OPTIONS.negativeAlphaScale;
export const DEFAULT_AXIS_NEGATIVE_COLOR_SCALE = DEFAULT_AXIS_OPTIONS.negativeColorScale;

/**
 * Allocates buffers for the X, Y, and Z axes using the provided parameters.
 */
export function createAxisSet(gl: WebGLRenderingContext, options?: AxisGeometryOptions): AxisSet {
  const resolved: Required<AxisGeometryOptions> = {
    ...DEFAULT_AXIS_OPTIONS,
    ...options,
  };

  return {
    x: createAxisMesh(gl, 'x', resolved),
    y: createAxisMesh(gl, 'y', resolved),
    z: createAxisMesh(gl, 'z', resolved),
  };
}

/**
 * Releases all GPU resources for the supplied axis set.
 */
export function disposeAxisSet(gl: WebGLRenderingContext, set: AxisSet | null): void {
  if (!set) {
    return;
  }

  disposeAxisMesh(gl, set.x);
  disposeAxisMesh(gl, set.y);
  disposeAxisMesh(gl, set.z);
}

/**
 * Compiles and links the axis shader program, returning cached locations.
 */
export function createAxisProgram(gl: WebGLRenderingContext): AxisProgram {
  /**
   * Vertex shader
   *  - Positions each axis vertex in clip space
   *  - Passes world-space position/normal for lighting
   *  - Forwards the per-vertex RGB colour and alpha written into the mesh buffer
   *
   * Fragment shader
   *  - Applies a simple lambert/ambient lighting mix to the per-vertex colour
   *  - Multiplies the interpolated vertex alpha by the user-controlled opacity
   *    uniform so UI sliders can fade the entire axis set
   *  - Supports optional clipping used elsewhere in the app
   */
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    attribute float aAlpha;
    attribute float aOpacityFlag;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;
    uniform float uUseSolidColor;
    uniform vec3 uSolidColor;
    uniform float uUseSolidAlpha;
    uniform float uSolidAlpha;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vOpacityFlag;

    void main() {
      vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vec3 baseColor = mix(aColor, uSolidColor, clamp(uUseSolidColor, 0.0, 1.0));
      vColor = baseColor;
      float baseAlpha = mix(aAlpha, uSolidAlpha, clamp(uUseSolidAlpha, 0.0, 1.0));
      vAlpha = baseAlpha;
      vOpacityFlag = aOpacityFlag;
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vOpacityFlag;

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
      float opacityScale = mix(1.0, uOpacity, clamp(vOpacityFlag, 0.0, 1.0));
      float alpha = clamp(vAlpha * opacityScale, 0.0, 1.0);
      gl_FragColor = vec4(clamp(shaded, 0.0, 1.0), alpha);
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
  const attribAlpha = gl.getAttribLocation(program, 'aAlpha');
  const attribOpacityFlag = gl.getAttribLocation(program, 'aOpacityFlag');

  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformNormalMatrix = getRequiredUniform(gl, program, 'uNormalMatrix');
  const uniformLightDirection = getRequiredUniform(gl, program, 'uLightDirection');
  const uniformClipEnabled = getRequiredUniform(gl, program, 'uClipEnabled');
  const uniformClipCenter = getRequiredUniform(gl, program, 'uClipCenter');
  const uniformClipRadius = getRequiredUniform(gl, program, 'uClipRadius');
  const uniformOpacity = getRequiredUniform(gl, program, 'uOpacity');
  const uniformUseSolidColor = getRequiredUniform(gl, program, 'uUseSolidColor');
  const uniformSolidColor = getRequiredUniform(gl, program, 'uSolidColor');
  const uniformUseSolidAlpha = getRequiredUniform(gl, program, 'uUseSolidAlpha');
  const uniformSolidAlpha = getRequiredUniform(gl, program, 'uSolidAlpha');

  return {
    program,
    attribPosition,
    attribNormal,
    attribColor,
    attribAlpha,
    attribOpacityFlag,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformNormalMatrix,
    uniformLightDirection,
    uniformClipEnabled,
    uniformClipCenter,
    uniformClipRadius,
    uniformOpacity,
    uniformUseSolidColor,
    uniformSolidColor,
    uniformUseSolidAlpha,
    uniformSolidAlpha,
  };
}

export function disposeAxisProgram(gl: WebGLRenderingContext, axisProgram: AxisProgram | null): void {
  if (!axisProgram) {
    return;
  }
  gl.deleteProgram(axisProgram.program);
}

/**
 * Makes the axis shader active for subsequent draw calls.
 */
export function useAxisProgram(gl: WebGLRenderingContext, axisProgram: AxisProgram): void {
  gl.useProgram(axisProgram.program);
}

/**
 * Updates matrices and lighting shared by every axis rendered in the frame.
 */
export function setAxisSharedUniforms(
  gl: WebGLRenderingContext,
  axisProgram: AxisProgram,
  uniforms: AxisSharedUniforms,
): void {
  gl.uniformMatrix4fv(axisProgram.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(axisProgram.uniformProjection, false, uniforms.projectionMatrix);
  gl.uniform3fv(axisProgram.uniformLightDirection, uniforms.lightDirection);
}

/**
 * Draws a single axis mesh with the supplied transform and opacity state.
 */
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
  gl.uniform1f(axisProgram.uniformUseSolidColor, 0.0);
  gl.uniform1f(axisProgram.uniformUseSolidAlpha, 0.0);

  drawAxisHalf(gl, axisProgram, mesh.positive);
  drawAxisHalf(gl, axisProgram, mesh.negative);
}

function drawAxisHalf(gl: WebGLRenderingContext, axisProgram: AxisProgram, mesh: AxisHalfMesh): void {
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

function createAxisMesh(
  gl: WebGLRenderingContext,
  axis: 'x' | 'y' | 'z',
  options: Required<AxisGeometryOptions>,
): AxisMesh {
  const { length, radius, segments, positiveAlpha, negativeAlphaScale, negativeColorScale } = options;

  const positiveGeometry = buildAxisHalfGeometry(
    axis,
    0,
    length / 2,
    radius,
    segments,
    AXIS_COLORS[axis],
    positiveAlpha,
    1,
  );

  const negativeGeometry = buildAxisHalfGeometry(
    axis,
    0,
    -length / 2,
    radius,
    segments,
    AXIS_COLORS[axis],
    positiveAlpha * negativeAlphaScale,
    negativeColorScale,
  );

  const positive = uploadAxisHalfMesh(gl, positiveGeometry);
  const negative = uploadAxisHalfMesh(gl, negativeGeometry);

  return {
    positive,
    negative,
  };
}

interface AxisHalfGeometry {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  opacityFlags: Float32Array;
  indices: Uint16Array;
  lineIndices: Uint16Array;
}

function uploadAxisHalfMesh(gl: WebGLRenderingContext, geometry: AxisHalfGeometry): AxisHalfMesh {
  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const alphaBuffer = gl.createBuffer();
  const opacityBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const lineIndexBuffer = geometry.lineIndices.length > 0 ? gl.createBuffer() : null;

  if (!positionBuffer || !normalBuffer || !colorBuffer || !alphaBuffer || !opacityBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for axis mesh.');
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

/**
 * Disposes the buffers that back an individual axis mesh.
 */
function disposeAxisMesh(gl: WebGLRenderingContext, mesh: AxisMesh | null): void {
  if (!mesh) {
    return;
  }

  disposeAxisHalfMesh(gl, mesh.positive);
  disposeAxisHalfMesh(gl, mesh.negative);
}

function disposeAxisHalfMesh(gl: WebGLRenderingContext, mesh: AxisHalfMesh | null): void {
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

/**
 * Builds the vertex attributes for a cylindrical section stretching from
 * `startHeight` to `endHeight` along the supplied axis.
 */
function buildAxisHalfGeometry(
  axis: 'x' | 'y' | 'z',
  startHeight: number,
  endHeight: number,
  radius: number,
  segments: number,
  color: [number, number, number],
  alpha: number,
  colorScale: number,
): AxisHalfGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const alphas: number[] = [];
  const opacityFlags: number[] = [];
  const indices: number[] = [];
  const lineIndices: number[] = [];

  const scaledColor = [
    Math.max(0, Math.min(1, color[0] * colorScale)),
    Math.max(0, Math.min(1, color[1] * colorScale)),
    Math.max(0, Math.min(1, color[2] * colorScale)),
  ];

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    pushVertex(axis, endHeight, cos, sin, radius, positions, normals);
    colors.push(scaledColor[0], scaledColor[1], scaledColor[2]);
    alphas.push(alpha);
    opacityFlags.push(1);
    pushVertex(axis, startHeight, cos, sin, radius, positions, normals);
    colors.push(scaledColor[0], scaledColor[1], scaledColor[2]);
    alphas.push(alpha);
    opacityFlags.push(1);
  }

  for (let i = 0; i < segments; i += 1) {
    const top1 = i * 2;
    const bottom1 = top1 + 1;
    const top2 = top1 + 2;
    const bottom2 = top1 + 3;

    indices.push(top1, bottom1, top2);
    indices.push(top2, bottom1, bottom2);

    const nextTop = ((i + 1) % segments) * 2;
    const nextBottom = nextTop + 1;
    lineIndices.push(top1, bottom1);
    lineIndices.push(top1, nextTop);
    lineIndices.push(bottom1, nextBottom);
  }

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
