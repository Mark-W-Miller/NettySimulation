// twirl8Asset.ts — figure-eight SOLID blades with spine-max thickness & per-lobe twist

export interface Twirl8Mesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface Twirl8Program {
  program: WebGLProgram;
  attribPosition: number;
  attribNormal: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
  uniformLightDirView: WebGLUniformLocation;
}

export interface Twirl8SharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  lightDirView?: Float32Array; // vec3 in VIEW space (default [0,0,1])
}

export interface Twirl8DrawParams {
  modelMatrix: Float32Array;
  color: Float32Array; // vec4 RGBA
}

/**
 * Create a solid, lens-like blade figure-8 mesh.
 * @param gl WebGL context
 * @param segments Longitudinal samples per full 8 (split across the 2 lobes)
 * @param widthSegments Cross-section samples across blade width (>=2)
 * @param radius Lobe circle radius
 * @param width Half-width of blade (distance along N)
 * @param thickness Max thickness at spine (amplitude along B before profile)
 * @param lobeRotation Twist amount (radians) applied from s=0..1 per lobe; use sign*(lobeRotation)
 */
export function createTwirl8MeshSolid(
  gl: WebGLRenderingContext,
  {
    segments = 128,
    widthSegments = 16,
    radius = 0.55,
    width = 0.15,
    thickness = 0.08,
    lobeRotation = 0.0,
  }: {
    segments?: number;
    widthSegments?: number;
    radius?: number;
    width?: number;
    thickness?: number;
    lobeRotation?: number;
  } = {}
): Twirl8Mesh {
  const perLobe = Math.max(16, Math.floor(segments / 2));
  const wSeg = Math.max(2, widthSegments);

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // local helpers
  const add = (a: number[], b: number[]) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const sub = (a: number[], b: number[]) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const mul = (a: number[], s: number) => [a[0]*s, a[1]*s, a[2]*s];
  const dot = (a: number[], b: number[]) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a: number[]) => {
    const L = len(a) || 1;
    return [a[0]/L, a[1]/L, a[2]/L];
  };
  const cross = (a: number[], b: number[]) => [
    a[1]*b[2]-a[2]*b[1],
    a[2]*b[0]-a[0]*b[2],
    a[0]*b[1]-a[1]*b[0],
  ];

  const pushVertex = (p: number[], n: number[]) => {
    positions.push(p[0], p[1], p[2]);
    normals.push(n[0], n[1], n[2]);
  };

  // Thickness profile: max at v=0 (spine), 0 at edges v=±1
  const thicknessProfile = (v: number) => {
    // smooth bell (quadratic). You can try p=2..4; higher = sharper ridge
    const a = Math.max(0, 1 - Math.abs(v));
    return a * a;
  };

  // Generate one circular lobe as a swept blade
  // sign = +1 (upper lobe), -1 (lower lobe)
  const generateLobe = (sign: 1 | -1) => {
    const center = [0, sign * radius, 0]; // circle center
    const base = positions.length / 3;

    for (let i = 0; i <= perLobe; i++) {
      const s = i / perLobe; // 0..1 along the lobe
      // Circle angle: start at rightmost for upper vs lower to keep continuity
      const theta0 = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
      const theta = theta0 + s * Math.PI * 2;

      // Centerline point on lobe circle
      const C = [
        center[0] + Math.cos(theta) * radius,
        center[1] + Math.sin(theta) * radius,
        0,
      ];

      // Tangent along the circle (derivative wrt theta)
      const dC_dtheta = [-Math.sin(theta) * radius, Math.cos(theta) * radius, 0];
      // Convert to ds: consistent up to scale; normalize anyway
      let T = norm(dC_dtheta);

      // Outward radial (normal-in-blade-plane)
      let N = norm(sub(C, center)); // from center to point

      // Binormal: thickness axis
      let B = norm(cross(T, N));

      // Apply twist around T: rotate (N,B) by angle alpha = sign*lobeRotation*s
      const alpha = sign * lobeRotation * s;
      const c = Math.cos(alpha);
      const si = Math.sin(alpha);
      const Np = add(mul(N, c), mul(B, si));     // N' = N*c + B*sin
      const Bp = add(mul(B, c), mul(N, -si));    // B' = B*c - N*sin

      // Build cross-section across width: v in [-1..1]
      for (let j = 0; j <= wSeg; j++) {
        const v = (j / wSeg) * 2 - 1; // -1..+1
        const wDisp = width * v;      // along N'
        const tMag = thickness * thicknessProfile(v); // along B' (bell)

        const P = add(add(C, mul(Np, wDisp)), mul(Bp, tMag));

        // Approximate normal: blend of N' (across width) and B' (thickness dome)
        // We want normals pointing "out" from the blade surface; use gradient-like:
        // nx ~ N' * d(wDisp)/dv + B' * d(tMag)/dv
        // d(wDisp)/dv = width; d(tMag)/dv = thickness * d(profile)/dv
        const dProfile_dv = v >= 0 ? -2 * (1 - v) : 2 * (1 + v);
        const nx = add(mul(Np, width), mul(Bp, thickness * dProfile_dv));
        const nrm = norm(nx);

        pushVertex(P, nrm);
      }
    }

    // Indices (quads between longitudinal strips and width strips)
    const rowVerts = wSeg + 1;
    for (let i = 0; i < perLobe; i++) {
      const row0 = base + i * rowVerts;
      const row1 = base + (i + 1) * rowVerts;
      for (let j = 0; j < wSeg; j++) {
        const a = row0 + j;
        const b = row0 + j + 1;
        const c2 = row1 + j;
        const d = row1 + j + 1;
        indices.push(a, c2, b);
        indices.push(b, c2, d);
      }
    }
  };

  // Build both lobes
  generateLobe(1);
  generateLobe(-1);

  // Upload
  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !normalBuffer || !indexBuffer) {
    throw new Error('Failed to allocate buffers for twirl-8 solid mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    positionBuffer,
    normalBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeTwirl8Mesh(gl: WebGLRenderingContext, mesh: Twirl8Mesh | null): void {
  if (!mesh) return;
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.normalBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

export function createTwirl8Program(gl: WebGLRenderingContext): Twirl8Program {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vNormalView;
    varying vec3 vPosView;

    void main() {
      mat4 MV = uViewMatrix * uModelMatrix;
      vec4 posV = MV * vec4(aPosition, 1.0);
      // assume uniform scale -> normal transform ok with upper-left 3x3 of MV
      mat3 MV3 = mat3(MV);
      vNormalView = normalize(MV3 * aNormal);
      vPosView = posV.xyz;
      gl_Position = uProjectionMatrix * posV;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 uColor;
    uniform vec3 uLightDirView; // normalized, in view space
    varying vec3 vNormalView;

    void main() {
      vec3 n = normalize(vNormalView);
      float ndl = max(dot(n, normalize(uLightDirView)), 0.0);
      float ambient = 0.25;
      float diff = ndl * 0.75;
      float lit = clamp(ambient + diff, 0.0, 1.0);
      gl_FragColor = vec4(uColor.rgb * lit, uColor.a);
    }
  `;

  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create twirl-8 program.');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(`Failed to link twirl-8 program: ${info ?? 'unknown error'}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const attribPosition = gl.getAttribLocation(program, 'aPosition');
  const attribNormal = gl.getAttribLocation(program, 'aNormal');

  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  const uniformLightDirView = getRequiredUniform(gl, program, 'uLightDirView');

  return {
    program,
    attribPosition,
    attribNormal,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformColor,
    uniformLightDirView,
  };
}

export function disposeTwirl8Program(gl: WebGLRenderingContext, program: Twirl8Program | null): void {
  if (!program) return;
  gl.deleteProgram(program.program);
}

export function useTwirl8Program(gl: WebGLRenderingContext, program: Twirl8Program): void {
  gl.useProgram(program.program);
}

export function setTwirl8SharedUniforms(
  gl: WebGLRenderingContext,
  program: Twirl8Program,
  uniforms: Twirl8SharedUniforms,
): void {
  gl.uniformMatrix4fv(program.uniformView, false, uniforms.viewMatrix);
  gl.uniformMatrix4fv(program.uniformProjection, false, uniforms.projectionMatrix);
  const light = uniforms.lightDirView ?? new Float32Array([0, 0, 1]);
  gl.uniform3fv(program.uniformLightDirView, light);
}

export function drawTwirl8(
  gl: WebGLRenderingContext,
  program: Twirl8Program,
  mesh: Twirl8Mesh,
  params: Twirl8DrawParams,
): void {
  gl.uniformMatrix4fv(program.uniformModel, false, params.modelMatrix);
  gl.uniform4fv(program.uniformColor, params.color);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

  const wasBlend = gl.isEnabled(gl.BLEND);
  if (!wasBlend) gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE); // optional: blades read better double-sided
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.enable(gl.CULL_FACE);
  if (!wasBlend) gl.disable(gl.BLEND);
}

// --- utilities (unchanged) ---
function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create WebGL shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failure: ${info ?? 'unknown error'}`);
  }
  return shader;
}

function getRequiredUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Uniform ${name} is missing.`);
  return location;
}