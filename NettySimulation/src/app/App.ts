// App.ts — renders a matte sphere with custom WebGL orbit controls (no external deps)
import { Assets, type AxisMesh } from '../engine/Assets';

type DragMode = 'orbit' | 'pan' | null;

interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
  panX: number;
  panY: number;
  panZ: number;
}

interface ShaderProgram {
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
}

interface IndexedMesh {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

export class App {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: ShaderProgram | null = null;
  private sphere: IndexedMesh | null = null;
  private axes: AxisMesh | null = null;
  private axisVisible = true;

  private modelMatrix = mat4Identity();
  private viewMatrix = mat4Identity();
  private projectionMatrix = mat4Identity();
  private normalMatrix = mat3Identity();

  private camera: CameraState = {
    azimuth: Math.PI / 5,
    elevation: Math.PI / 7,
    distance: 4,
    panX: 0,
    panY: 0,
    panZ: 0,
  };

  private dragMode: DragMode = null;
  private activePointerId: number | null = null;
  private dragStart = {
    x: 0,
    y: 0,
    azimuth: 0,
    elevation: 0,
    panX: 0,
    panY: 0,
    panZ: 0,
  };

  private resizeObserver: ResizeObserver | null = null;
  private cleanupCallbacks: Array<() => void> = [];
  private animationHandle = 0;

  mount(host: HTMLElement): void {
    this.dispose();

    const container = document.createElement('div');
    container.className = 'scene-container';

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    host.innerHTML = '';
    host.appendChild(container);

    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported in this browser.');
    }

    const program = this.createProgram(gl);
    const sphere = this.createSphere(gl);
    const axes = Assets.createAxisMesh(gl);

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.sphere = sphere;
    this.axes = axes;

    this.resize(canvas, gl);
    this.resizeObserver = new ResizeObserver(() => {
      if (this.canvas && this.gl) {
        this.resize(this.canvas, this.gl);
      }
    });
    this.resizeObserver.observe(container);

    this.cleanupCallbacks.push(this.attachControls(container));

    const renderLoop = () => {
      this.animationHandle = requestAnimationFrame(renderLoop);
      this.render();
    };
    renderLoop();
  }

  dispose(): void {
    if (this.animationHandle) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = 0;
    }

    this.cleanupCallbacks.forEach((cleanup) => cleanup());
    this.cleanupCallbacks = [];

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.gl && this.sphere) {
      this.gl.deleteBuffer(this.sphere.positionBuffer);
      this.gl.deleteBuffer(this.sphere.normalBuffer);
      this.gl.deleteBuffer(this.sphere.colorBuffer);
      this.gl.deleteBuffer(this.sphere.indexBuffer);
    }

    if (this.gl && this.axes) {
      Assets.disposeAxisMesh(this.gl, this.axes);
    }

    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program.program);
    }

    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.sphere = null;
    this.axes = null;
  }

  private resize(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    this.projectionMatrix = mat4Perspective((50 * Math.PI) / 180, width / height, 0.1, 100);
  }

  private render(): void {
    if (!this.gl || !this.program || !this.sphere || !this.canvas) {
      return;
    }

    const gl = this.gl;
    const program = this.program;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.03, 0.05, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const target: [number, number, number] = [this.camera.panX, this.camera.panY, this.camera.panZ];
    const position = sphericalToCartesian(this.camera.distance, this.camera.azimuth, this.camera.elevation, target);
    const clipRadius = 1.02;
    const cameraDistanceFromCenter = Math.hypot(position[0], position[1], position[2]);
    const shouldRenderAxes = this.axisVisible && Boolean(this.axes);
    const clipEnabled = shouldRenderAxes && cameraDistanceFromCenter > clipRadius + 0.05;

    this.viewMatrix = mat4LookAt(position, target, [0, 1, 0]);
    this.normalMatrix = mat3FromMat4(this.modelMatrix);

    gl.useProgram(program.program);

    gl.uniformMatrix4fv(program.uniformModel, false, this.modelMatrix);
    gl.uniformMatrix4fv(program.uniformView, false, this.viewMatrix);
    gl.uniformMatrix4fv(program.uniformProjection, false, this.projectionMatrix);
    gl.uniformMatrix3fv(program.uniformNormalMatrix, false, this.normalMatrix);
    gl.uniform3fv(program.uniformLightDirection, normalizeVec3([0.5, 0.8, 0.4]));

    // Draw sphere
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.positionBuffer);
    gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.normalBuffer);
    gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribNormal);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.colorBuffer);
    gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphere.indexBuffer);
    gl.uniform1f(program.uniformUseVertexColor, 0.0);
    gl.uniform3fv(program.uniformColor, [0.28, 0.46, 0.9]);
    gl.uniform1f(program.uniformClipEnabled, 0.0);
    gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, this.sphere.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.enable(gl.CULL_FACE);

    // Draw axes
    if (shouldRenderAxes && this.axes) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.axes.positionBuffer);
      gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(program.attribPosition);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.axes.normalBuffer);
      gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(program.attribNormal);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.axes.colorBuffer);
      gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(program.attribColor);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.axes.indexBuffer);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.0, 1.0);
      gl.uniform1f(program.uniformUseVertexColor, 1.0);
      gl.uniform1f(program.uniformClipEnabled, clipEnabled ? 1.0 : 0.0);
      gl.uniform3f(program.uniformClipCenter, 0.0, 0.0, 0.0);
      gl.uniform1f(program.uniformClipRadius, clipRadius);
      gl.drawElements(gl.TRIANGLES, this.axes.indexCount, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.CULL_FACE);
    }
  }

  isAxisVisible(): boolean {
    return this.axisVisible;
  }

  setAxisVisible(visible: boolean): void {
    this.axisVisible = visible;
  }

  private attachControls(container: HTMLDivElement): () => void {
    const pointerDown = (event: PointerEvent) => {
      let mode: DragMode = null;

      if (event.button === 0 && event.altKey) {
        mode = 'pan';
      } else if (event.button === 0) {
        mode = 'orbit';
      } else if (event.button === 1 || event.button === 2) {
        mode = 'pan';
      }

      if (!mode) {
        return;
      }

      this.dragMode = mode;
      this.activePointerId = event.pointerId;
      container.setPointerCapture?.(event.pointerId);

      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
        azimuth: this.camera.azimuth,
        elevation: this.camera.elevation,
        panX: this.camera.panX,
        panY: this.camera.panY,
        panZ: this.camera.panZ,
      };

      container.classList.toggle('is-orbiting', mode === 'orbit');
      container.classList.toggle('is-panning', mode === 'pan');
    };

    const pointerMove = (event: PointerEvent) => {
      if (!this.dragMode || event.pointerId !== this.activePointerId) {
        return;
      }

      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;

      if (this.dragMode === 'orbit') {
        const orbitSensitivity = 0.005;
        const elevationSensitivity = 0.004;
        this.camera.azimuth = this.dragStart.azimuth - dx * orbitSensitivity;
        const nextElevation = this.dragStart.elevation + dy * elevationSensitivity;
        const clampLimit = Math.PI / 2 - 0.05;
        this.camera.elevation = clamp(nextElevation, -clampLimit, clampLimit);
      } else if (this.dragMode === 'pan') {
        const panSensitivity = 0.0018 * this.camera.distance;
        const basis = getCameraPanBasis(this.dragStart.azimuth, this.dragStart.elevation);

        const deltaRight = dx * panSensitivity;
        const deltaUp = dy * panSensitivity;

        const worldDelta = addVec3(
          scaleVec3(basis.right, deltaRight),
          scaleVec3(basis.up, deltaUp),
        );

        this.camera.panX = this.dragStart.panX + worldDelta[0];
        this.camera.panY = this.dragStart.panY + worldDelta[1];
        this.camera.panZ = this.dragStart.panZ + worldDelta[2];
      }
    };

    const pointerUp = (event: PointerEvent) => {
      if (event.pointerId === this.activePointerId) {
        container.releasePointerCapture?.(event.pointerId);
        this.activePointerId = null;
        this.dragMode = null;
        container.classList.remove('is-orbiting', 'is-panning');
      }
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSensitivity = 0.0018;
      const nextDistance = this.camera.distance + event.deltaY * zoomSensitivity;
      this.camera.distance = clamp(nextDistance, 0.15, 12);
    };

    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    container.addEventListener('pointerdown', pointerDown);
    container.addEventListener('pointermove', pointerMove);
    container.addEventListener('pointerup', pointerUp);
    container.addEventListener('pointercancel', pointerUp);
    container.addEventListener('lostpointercapture', pointerUp);
    container.addEventListener('wheel', wheel, { passive: false });
    container.addEventListener('contextmenu', contextMenu);

    return () => {
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('pointermove', pointerMove);
      container.removeEventListener('pointerup', pointerUp);
      container.removeEventListener('pointercancel', pointerUp);
      container.removeEventListener('lostpointercapture', pointerUp);
      container.removeEventListener('wheel', wheel);
      container.removeEventListener('contextmenu', contextMenu);
    };
  }

  private createProgram(gl: WebGLRenderingContext): ShaderProgram {
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
        vec3 shaded = vColor * (ambient + (1.0 - ambient) * diffuse);
        gl_FragColor = vec4(shaded, 1.0);
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
    };
  }

  private createSphere(gl: WebGLRenderingContext): IndexedMesh {
    const { positions, normals, colors, indices } = buildSphereGeometry(48, 48);

    const positionBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();

    if (!positionBuffer || !normalBuffer || !colorBuffer || !indexBuffer) {
      throw new Error('Failed to create sphere buffers.');
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

function sphericalToCartesian(
  radius: number,
  azimuth: number,
  elevation: number,
  target: [number, number, number],
): [number, number, number] {
  const x = radius * Math.cos(elevation) * Math.sin(azimuth) + target[0];
  const y = radius * Math.sin(elevation) + target[1];
  const z = radius * Math.cos(elevation) * Math.cos(azimuth) + target[2];
  return [x, y, z];
}

function normalizeVec3(vec: [number, number, number]): Float32Array {
  const [x, y, z] = vec;
  const length = Math.hypot(x, y, z) || 1;
  return new Float32Array([x / length, y / length, z / length]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mat4Identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function mat3Identity(): Float32Array {
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
}

function mat4Perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

function mat4LookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Float32Array {
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

function mat3FromMat4(mat: Float32Array): Float32Array {
  return new Float32Array([
    mat[0], mat[1], mat[2],
    mat[4], mat[5], mat[6],
    mat[8], mat[9], mat[10],
  ]);
}

function getCameraPanBasis(azimuth: number, elevation: number): { right: [number, number, number]; up: [number, number, number] } {
  const cameraPos = sphericalToCartesian(1, azimuth, elevation, [0, 0, 0]);
  const viewDir = normalizeTuple([-cameraPos[0], -cameraPos[1], -cameraPos[2]]);
  let right = crossVec3([0, 1, 0], viewDir);
  if (lengthVec3(right) < 1e-5) {
    right = [1, 0, 0];
  } else {
    right = normalizeTuple(right);
  }
  const up = normalizeTuple(crossVec3(viewDir, right));
  return { right, up };
}

function normalizeTuple(vec: [number, number, number]): [number, number, number] {
  const len = lengthVec3(vec) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
}

function crossVec3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function scaleVec3(vec: [number, number, number], scalar: number): [number, number, number] {
  return [vec[0] * scalar, vec[1] * scalar, vec[2] * scalar];
}

function addVec3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function lengthVec3(vec: [number, number, number]): number {
  return Math.hypot(vec[0], vec[1], vec[2]);
}
