// twirlAsset.ts — builds ring mesh and twirl-specific shader utilities

import type { SphereMesh } from './sphereAsset';

export type TwirlMesh = SphereMesh;

export interface TwirlProgram {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
  attribColor: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformNormalMatrix: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
  uniformLightDirection: WebGLUniformLocation;
  uniformPlaneVector: WebGLUniformLocation;
  uniformShadingIntensity: WebGLUniformLocation;
  uniformBeltHalfAngle: WebGLUniformLocation;
  uniformPulseScale: WebGLUniformLocation;
  uniformPatternRepeats: WebGLUniformLocation;
  uniformPatternOffset: WebGLUniformLocation;
  uniformOpacityIntensity: WebGLUniformLocation;
  uniformClipEnabled: WebGLUniformLocation;
  uniformClipCenter: WebGLUniformLocation;
  uniformClipRadius: WebGLUniformLocation;
}

export interface TwirlSharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  lightDirection: Float32Array;
}

export interface TwirlDrawParams {
  modelMatrix: Float32Array;
  normalMatrix: Float32Array;
  baseColor: Float32Array;
  planeVector: Float32Array;
  shadingIntensity: number;
  beltHalfAngle: number;
  pulseScale: number;
  patternRepeats: number;
  patternOffset: number;
  opacityIntensity: number;
  clipEnabled: boolean;
  clipCenter: Float32Array;
  clipRadius: number;
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
    varying vec3 vVertexTint;
    varying float vAlpha;

    void main() {
      vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vBaseColor = uColor.rgb;
      vVertexTint = aColor;
      vAlpha = uColor.a;
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vBaseColor;
    varying vec3 vVertexTint;
    varying float vAlpha;

    uniform vec3 uLightDirection;
    uniform vec3 uPlaneVector;
    uniform float uShadingIntensity;
    uniform float uBeltHalfAngle;
    uniform float uPulseScale;
    uniform float uPatternRepeats;
    uniform float uPatternOffset;
    uniform float uOpacityIntensity;
    uniform float uClipEnabled;
    uniform vec3 uClipCenter;
    uniform float uClipRadius;

    const float PI = 3.14159265358979323846264;

    vec3 buildTangent(vec3 normal) {
      vec3 ref = abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      return normalize(cross(ref, normal));
    }

    void main() {
      if (uClipEnabled > 0.5) {
        float distanceToCenter = distance(vWorldPosition, uClipCenter);
        if (distanceToCenter < uClipRadius) {
          discard;
        }
      }

      vec3 normal = normalize(vNormal);
      vec3 surfaceDir = normalize(vWorldPosition);

      vec3 plane = uPlaneVector;
      float planeLength = length(plane);
      if (planeLength < 0.00001) {
        plane = normal;
        planeLength = 1.0;
      }
      plane /= planeLength;

      vec3 tangent = buildTangent(plane);
      vec3 bitangent = normalize(cross(plane, tangent));

      float alignment = dot(surfaceDir, plane);

      float pulse = clamp(uPulseScale, 0.0, 1.0);
      float baseBelt = max(0.01, uBeltHalfAngle);
      float beltAngle = baseBelt * mix(0.65, 1.3, pulse);
      float feather = beltAngle * 0.4;
      float bandStrength = 1.0 - smoothstep(beltAngle, beltAngle + feather, abs(alignment));
      float mirroredAlignment = dot(surfaceDir, -plane);
      float rearBand = 1.0 - smoothstep(beltAngle, beltAngle + feather, abs(mirroredAlignment));
      bandStrength = max(bandStrength, rearBand);

      float uCoord = dot(surfaceDir, tangent);
      float vCoord = dot(surfaceDir, bitangent);
      float angle = atan(vCoord, uCoord);
      float repeats = max(1.0, uPatternRepeats);
      float angleNorm = fract((angle + PI) / (2.0 * PI) + uPatternOffset);
      float triangle = abs(fract(angleNorm * repeats) - 0.5) * 2.0;
      float ridge = smoothstep(0.15, 0.85, triangle);

      vec3 lightDir = normalize(uLightDirection);
      float diffuse = max(dot(normal, lightDir), 0.0);
      float ambient = 0.35;
      vec3 litBase = vBaseColor * (ambient + (1.0 - ambient) * diffuse);

      float intensity = clamp(uShadingIntensity, 0.0, 1.0);
      vec3 tintBlend = mix(litBase, vVertexTint, 0.15);
      float bandBoost = mix(0.45, 1.1, intensity);
      float ridgeBoost = mix(0.7, 1.35, ridge);
      vec3 shaded = clamp(tintBlend * bandBoost * ridgeBoost * (bandStrength + 0.05), 0.0, 1.0);

      float opacityControl = clamp(uOpacityIntensity, 0.0, 1.0);
      float fade = clamp((beltAngle + feather - abs(alignment)) / (beltAngle + feather), 0.0, 1.0);
      float alpha = vAlpha * bandStrength * mix(pow(fade, 1.5), fade, opacityControl);

      if (alpha < 0.02) {
        discard;
      }

      gl_FragColor = vec4(shaded, clamp(alpha, 0.0, 1.0));
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
  const attribColor = gl.getAttribLocation(program, 'aColor');

  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformNormalMatrix = getRequiredUniform(gl, program, 'uNormalMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  const uniformLightDirection = getRequiredUniform(gl, program, 'uLightDirection');
  const uniformPlaneVector = getRequiredUniform(gl, program, 'uPlaneVector');
  const uniformShadingIntensity = getRequiredUniform(gl, program, 'uShadingIntensity');
  const uniformBeltHalfAngle = getRequiredUniform(gl, program, 'uBeltHalfAngle');
  const uniformPulseScale = getRequiredUniform(gl, program, 'uPulseScale');
  const uniformPatternRepeats = getRequiredUniform(gl, program, 'uPatternRepeats');
  const uniformPatternOffset = getRequiredUniform(gl, program, 'uPatternOffset');
  const uniformOpacityIntensity = getRequiredUniform(gl, program, 'uOpacityIntensity');
  const uniformClipEnabled = getRequiredUniform(gl, program, 'uClipEnabled');
  const uniformClipCenter = getRequiredUniform(gl, program, 'uClipCenter');
  const uniformClipRadius = getRequiredUniform(gl, program, 'uClipRadius');
  return {
    program,
    attribPosition,
    attribNormal,
    attribColor,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformNormalMatrix,
    uniformColor,
    uniformLightDirection,
    uniformPlaneVector,
    uniformShadingIntensity,
    uniformBeltHalfAngle,
    uniformPulseScale,
    uniformPatternRepeats,
    uniformPatternOffset,
    uniformOpacityIntensity,
    uniformClipEnabled,
    uniformClipCenter,
    uniformClipRadius,
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
  gl.uniform3fv(program.uniformLightDirection, uniforms.lightDirection);
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
  gl.uniform3fv(program.uniformPlaneVector, params.planeVector);
  gl.uniform1f(program.uniformShadingIntensity, params.shadingIntensity);
  gl.uniform1f(program.uniformBeltHalfAngle, params.beltHalfAngle);
  gl.uniform1f(program.uniformPulseScale, params.pulseScale);
  gl.uniform1f(program.uniformPatternRepeats, params.patternRepeats);
  gl.uniform1f(program.uniformPatternOffset, params.patternOffset);
  gl.uniform1f(program.uniformOpacityIntensity, params.opacityIntensity);
  gl.uniform1f(program.uniformClipEnabled, params.clipEnabled ? 1.0 : 0.0);
  gl.uniform3fv(program.uniformClipCenter, params.clipCenter);
  gl.uniform1f(program.uniformClipRadius, params.clipRadius);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
  gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribColor);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      gl.disable(gl.CULL_FACE);
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      gl.enable(gl.CULL_FACE);
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
