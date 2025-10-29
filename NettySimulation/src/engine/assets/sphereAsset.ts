// sphereAsset.ts — builds and disposes the Babylon-like sphere mesh buffers

export interface SphereMesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface SphereProgram {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
  attribColor: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformNormalMatrix: WebGLUniformLocation;
  uniformLightDirection: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
  uniformUseVertexColor: WebGLUniformLocation;
  uniformClipEnabled: WebGLUniformLocation;
  uniformClipCenter: WebGLUniformLocation;
  uniformClipRadius: WebGLUniformLocation;
  uniformShadingIntensity: WebGLUniformLocation;
  uniformPlaneVector: WebGLUniformLocation;
}

export interface SphereSharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  lightDirection: Float32Array;
}

export interface SphereDrawParams {
  modelMatrix: Float32Array;
  normalMatrix: Float32Array;
  shadingIntensity: number;
  planeVector: Float32Array;
  baseColor: Float32Array;
  vertexColorWeight: number;
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

export function createSphereProgram(gl: WebGLRenderingContext): SphereProgram {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;
    uniform float uUseVertexColor;
    uniform vec3 uColor;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vColor;

    void main() {
      vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vColor = mix(uColor, aColor, uUseVertexColor);
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
    uniform float uShadingIntensity;
    uniform vec3 uPlaneVector;

    void main() {
      vec3 normal = normalize(vNormal);
      float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
      float ambient = 0.25;

      if (uClipEnabled > 0.5) {
        float distanceToCenter = distance(vWorldPosition, uClipCenter);
        if (distanceToCenter < uClipRadius) {
          discard;
        }
      }

      vec3 baseColor = vColor * (ambient + (1.0 - ambient) * diffuse);

      // Treat the spin axis as the shading reference; if it is degenerate, fall back to base lighting.
      float axisLength = length(uPlaneVector);
      if (axisLength < 0.0001) {
        gl_FragColor = vec4(baseColor, 1.0);
        return;
      }

      vec3 spinAxis = normalize(uPlaneVector);
      vec3 surfaceDirection = normalize(vWorldPosition);

      // Alignment with the spin axis: 0 at the equator, 1 at either pole. We shade symmetrically.
      float alignment = abs(dot(surfaceDirection, spinAxis));

      // Ease the coverage so that poles brighten slowly and transitions stay smooth while dragging the slider.
      float intensity = clamp(uShadingIntensity, 0.0, 1.0);
      float coverage = pow(intensity, 1.4);
      float coverageEdge = clamp(coverage, 0.0, 1.0);
      float softness = mix(0.04, 0.22, intensity);
      float edgeMax = min(coverageEdge + softness, 1.0);

      // Smoothly light a band that widens from the equator towards the poles as intensity increases.
      float band = 1.0 - smoothstep(coverageEdge, edgeMax, alignment);

      // Narrow bands should pop with more brightness while broader hemispheres stay softer.
      float brightnessBoost = mix(2.6, 0.45, intensity);
      float brightness = band * pow(intensity, 0.55) * brightnessBoost;
      brightness = clamp(brightness, 0.0, 1.0);

      vec3 shaded = baseColor * brightness;
      gl_FragColor = vec4(clamp(shaded, 0.0, 1.0), 1.0);
    }
  `;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create WebGL program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`Failed to link WebGL program: ${info ?? 'unknown error'}`);
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
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  const uniformUseVertexColor = getRequiredUniform(gl, program, 'uUseVertexColor');
  const uniformClipEnabled = getRequiredUniform(gl, program, 'uClipEnabled');
  const uniformClipCenter = getRequiredUniform(gl, program, 'uClipCenter');
  const uniformClipRadius = getRequiredUniform(gl, program, 'uClipRadius');
  const uniformShadingIntensity = getRequiredUniform(gl, program, 'uShadingIntensity');
  const uniformPlaneVector = getRequiredUniform(gl, program, 'uPlaneVector');

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
    uniformColor,
    uniformUseVertexColor,
    uniformClipEnabled,
    uniformClipCenter,
    uniformClipRadius,
    uniformShadingIntensity,
    uniformPlaneVector,
  };
}

export function disposeSphereProgram(gl: WebGLRenderingContext, sphereProgram: SphereProgram | null): void {
  if (!sphereProgram) {
    return;
  }
  gl.deleteProgram(sphereProgram.program);
}

export function useSphereProgram(gl: WebGLRenderingContext, sphereProgram: SphereProgram): void {
  gl.useProgram(sphereProgram.program);
}

export function setSphereSharedUniforms(
  gl: WebGLRenderingContext,
  sphereProgram: SphereProgram,
  uniforms: SphereSharedUniforms,
): void {
  gl.uniformMatrix4fv(sphereProgram.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(sphereProgram.uniformProjection, false, uniforms.projectionMatrix);
  gl.uniform3fv(sphereProgram.uniformLightDirection, uniforms.lightDirection);
}

export function drawSphere(
  gl: WebGLRenderingContext,
  sphereProgram: SphereProgram,
  mesh: SphereMesh,
  params: SphereDrawParams,
): void {
  gl.uniformMatrix4fv(sphereProgram.uniformModel, false, params.modelMatrix);
  gl.uniformMatrix3fv(sphereProgram.uniformNormalMatrix, false, params.normalMatrix);
  gl.uniform1f(sphereProgram.uniformShadingIntensity, params.shadingIntensity);
  gl.uniform3fv(sphereProgram.uniformPlaneVector, params.planeVector);
  gl.uniform3fv(sphereProgram.uniformColor, params.baseColor);
  gl.uniform1f(sphereProgram.uniformUseVertexColor, clamp01(params.vertexColorWeight));
  gl.uniform1f(sphereProgram.uniformClipEnabled, 0.0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(sphereProgram.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(sphereProgram.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(sphereProgram.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(sphereProgram.attribNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
  gl.vertexAttribPointer(sphereProgram.attribColor, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(sphereProgram.attribColor);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.disable(gl.CULL_FACE);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.enable(gl.CULL_FACE);
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
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
