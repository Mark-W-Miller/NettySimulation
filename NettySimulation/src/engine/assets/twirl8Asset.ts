// twirl8Asset.ts — figure-eight ribbon asset with per-lobe twist controls

export interface Twirl8Mesh {
  positionBuffer: WebGLBuffer;
  lobeBuffer: WebGLBuffer;
  sideBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export interface Twirl8Program {
  program: WebGLProgram;
  attribPosition: number;
  attribLobeSign: number;
  attribRibbonSide: number;
  uniformModel: WebGLUniformLocation;
  uniformView: WebGLUniformLocation;
  uniformProjection: WebGLUniformLocation;
  uniformColor: WebGLUniformLocation;
  uniformWidth: WebGLUniformLocation;
  uniformLobeRotation: WebGLUniformLocation;
  uniformThickness: WebGLUniformLocation;
}

export interface Twirl8SharedUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
}

export interface Twirl8DrawParams {
  modelMatrix: Float32Array;
  color: Float32Array; // vec4 RGBA
  width: number;
  lobeRotation: number;
  thickness: number;
}

export function createTwirl8Mesh(gl: WebGLRenderingContext, segments = 128): Twirl8Mesh {
  const perLobe = Math.max(16, Math.floor(segments / 2));
  const positions: number[] = [];
  const lobeFlags: number[] = [];
  const sides: number[] = [];
  const indices: number[] = [];

  const pushVertex = (x: number, y: number, z: number, lobeSign: number, side: number) => {
    positions.push(x, y, z);
    lobeFlags.push(lobeSign);
    sides.push(side);
  };

  const radius = 0.55;
  const centerOffset = radius;

  const generateLobe = (sign: 1 | -1) => {
    const centerX = 0;
    const centerY = sign * centerOffset;
    const startAngle = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    const baseIndex = positions.length / 3;
    for (let i = 0; i <= perLobe; i += 1) {
      const theta = startAngle + (i / perLobe) * Math.PI * 2;
      const x = centerX + Math.cos(theta) * radius;
      const y = centerY + Math.sin(theta) * radius;
      const z = 0;
      pushVertex(x, y, z, sign, 1);
      pushVertex(x, y, z, sign, -1);
      if (i < perLobe) {
        const currTop = baseIndex + 2 * i;
        const currBottom = baseIndex + 2 * i + 1;
        const nextTop = baseIndex + 2 * (i + 1);
        const nextBottom = baseIndex + 2 * (i + 1) + 1;
        indices.push(currTop, currBottom, nextTop);
        indices.push(currBottom, nextBottom, nextTop);
      }
    }
  };

  generateLobe(1);
  generateLobe(-1);

  const positionBuffer = gl.createBuffer();
  const lobeBuffer = gl.createBuffer();
  const sideBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !indexBuffer || !lobeBuffer || !sideBuffer) {
    throw new Error('Failed to allocate buffers for twirl-8 mesh.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, lobeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lobeFlags), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, sideBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sides), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    positionBuffer,
    lobeBuffer,
    sideBuffer,
    indexBuffer,
    indexCount: indices.length,
  };
}

export function disposeTwirl8Mesh(gl: WebGLRenderingContext, mesh: Twirl8Mesh | null): void {
  if (!mesh) return;
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.lobeBuffer);
  gl.deleteBuffer(mesh.sideBuffer);
  gl.deleteBuffer(mesh.indexBuffer);
}

export function createTwirl8Program(gl: WebGLRenderingContext): Twirl8Program {
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute float aLobeSign;
    attribute float aRibbonSide;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uWidth;
    uniform float uLobeRotation;
    uniform float uThickness;
    void main() {
      float lobeSign = aLobeSign >= 0.0 ? 1.0 : -1.0;
      float angle = uLobeRotation * lobeSign;

      vec3 position = aPosition;
      position.x *= uWidth;
      position.z = aRibbonSide * uThickness * 0.5;

      float cosA = cos(angle);
      float sinA = sin(angle);
      float x = position.x;
      float z = position.z;
      position.x = x * cosA + z * sinA;
      position.z = -x * sinA + z * cosA;

      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `;

  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create twirl-8 program.');
  }
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
  const attribLobeSign = gl.getAttribLocation(program, 'aLobeSign');
  const attribRibbonSide = gl.getAttribLocation(program, 'aRibbonSide');
  const uniformModel = getRequiredUniform(gl, program, 'uModelMatrix');
  const uniformView = getRequiredUniform(gl, program, 'uViewMatrix');
  const uniformProjection = getRequiredUniform(gl, program, 'uProjectionMatrix');
  const uniformColor = getRequiredUniform(gl, program, 'uColor');
  const uniformWidth = getRequiredUniform(gl, program, 'uWidth');
  const uniformLobeRotation = getRequiredUniform(gl, program, 'uLobeRotation');
  const uniformThickness = getRequiredUniform(gl, program, 'uThickness');

  return {
    program,
    attribPosition,
    attribLobeSign,
    attribRibbonSide,
    uniformModel,
    uniformView,
    uniformProjection,
    uniformColor,
    uniformWidth,
    uniformLobeRotation,
    uniformThickness,
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
}

export function drawTwirl8(
  gl: WebGLRenderingContext,
  program: Twirl8Program,
  mesh: Twirl8Mesh,
  params: Twirl8DrawParams,
): void {
  gl.uniformMatrix4fv(program.uniformModel, false, params.modelMatrix);
  gl.uniform4fv(program.uniformColor, params.color);
  gl.uniform1f(program.uniformWidth, params.width);
  gl.uniform1f(program.uniformLobeRotation, params.lobeRotation);
  gl.uniform1f(program.uniformThickness, params.thickness);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.lobeBuffer);
  gl.vertexAttribPointer(program.attribLobeSign, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribLobeSign);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.sideBuffer);
  gl.vertexAttribPointer(program.attribRibbonSide, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribRibbonSide);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

  const wasBlend = gl.isEnabled(gl.BLEND);
  if (!wasBlend) gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.enable(gl.CULL_FACE);
  if (!wasBlend) gl.disable(gl.BLEND);
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
