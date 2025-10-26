// App.ts — renders a matte sphere with custom WebGL orbit controls (no external deps)
import { Assets, type AxisMesh, type SphereMesh } from '../engine/Assets';
import { CameraController } from './camera';
import {
  clamp,
  mat3FromMat4,
  mat3Identity,
  mat4FromYRotation,
  mat4Identity,
  mat4LookAt,
  mat4Perspective,
  normalizeVec3,
} from './math3d';

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

interface SimObject {
  id: string;
  mesh: SphereMesh;
  rotationY: number;
}

export class App {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: ShaderProgram | null = null;
  private sphere: SphereMesh | null = null;
  private axes: AxisMesh | null = null;
  private axisVisible = true;

  private readonly camera = new CameraController();
  private readonly identityModelMatrix = mat4Identity();
  private readonly identityNormalMatrix = mat3Identity();
  private viewMatrix = mat4Identity();
  private projectionMatrix = mat4Identity();

  private resizeObserver: ResizeObserver | null = null;
  private cleanupCallbacks: Array<() => void> = [];
  private animationHandle = 0;
  private lastRenderTime = 0;

  private simRunning = false;
  private simSpeed = 30;
  private readonly rotationPerBeat = Math.PI / 90;
  private readonly simObjects: SimObject[] = [];
  private sphereObject: SimObject | null = null;

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
    const sphere = Assets.createSphereMesh(gl);
    const axes = Assets.createAxisMesh(gl);

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.sphere = sphere;
    this.axes = axes;

    this.sphereObject = { id: 'sphere', mesh: sphere, rotationY: 0 };
    this.simObjects.push(this.sphereObject);

    this.resize(canvas, gl);
    this.resizeObserver = new ResizeObserver(() => {
      if (this.canvas && this.gl) {
        this.resize(this.canvas, this.gl);
      }
    });
    this.resizeObserver.observe(container);

    this.cleanupCallbacks.push(this.camera.attach(container));

    this.lastRenderTime = performance.now();
    const renderLoop = (now: number) => {
      const deltaSeconds = (now - this.lastRenderTime) / 1000;
      this.lastRenderTime = now;
      const beats = this.simRunning ? this.simSpeed * deltaSeconds : 0;
      this.render(beats);
      this.animationHandle = requestAnimationFrame(renderLoop);
    };

    this.animationHandle = requestAnimationFrame(renderLoop);
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
      Assets.disposeSphereMesh(this.gl, this.sphere);
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
    this.simObjects.length = 0;
    this.sphereObject = null;
    this.simRunning = false;
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

  private render(beats: number): void {
    // Abort rendering when core WebGL resources are not yet initialized.
    if (!this.gl || !this.program || !this.sphere || !this.canvas) {
      return;
    }

    const gl = this.gl;
    const program = this.program;

    if (beats > 0 && this.sphereObject) {
      this.sphereObject.rotationY += beats * this.rotationPerBeat;
    }

    // Ensure fragments respect depth buffering (z-order).
    gl.enable(gl.DEPTH_TEST);
    // Skip drawing faces that point away from the camera.
    gl.enable(gl.CULL_FACE);
    // Cull the back-facing triangles specifically.
    gl.cullFace(gl.BACK);
    // Set the dark background color for each frame.
    gl.clearColor(0.03, 0.05, 0.09, 1);
    // Reset color and depth buffers.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const target = this.camera.getTarget();
    const position = this.camera.getPosition();
    const clipRadius = 1.02;
    const cameraDistanceFromCenter = Math.hypot(position[0], position[1], position[2]);
    const shouldRenderAxes = this.axisVisible && Boolean(this.axes);
    const clipEnabled = shouldRenderAxes && cameraDistanceFromCenter > clipRadius + 0.05;

    // Build the camera view transform.
    this.viewMatrix = mat4LookAt(position, target, [0, 1, 0]);

    // Activate the shader program for subsequent draw calls.
    gl.useProgram(program.program);

    // Upload camera view and projection matrices shared by all objects.
    gl.uniformMatrix4fv(program.uniformView, false, this.viewMatrix);
    gl.uniformMatrix4fv(program.uniformProjection, false, this.projectionMatrix);
    // Set the light direction.
    gl.uniform3fv(program.uniformLightDirection, normalizeVec3([0.5, 0.8, 0.4]));

    const sphereRotation = this.sphereObject?.rotationY ?? 0;
    const sphereModelMatrix = mat4FromYRotation(sphereRotation);
    const sphereNormalMatrix = mat3FromMat4(sphereModelMatrix);

    // Upload sphere transforms.
    gl.uniformMatrix4fv(program.uniformModel, false, sphereModelMatrix);
    gl.uniformMatrix3fv(program.uniformNormalMatrix, false, sphereNormalMatrix);

    // Draw sphere
    // Bind the sphere's position VBO to the ARRAY_BUFFER target so subsequent attribute calls read its vertex data.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.positionBuffer);
    // Describe position layout.
    gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
    // Enable the position attribute.
    gl.enableVertexAttribArray(program.attribPosition);

    // Bind per-vertex normals.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.normalBuffer);
    // Describe normal layout.
    gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
    // Enable the normal attribute.
    gl.enableVertexAttribArray(program.attribNormal);

    // Bind the baked vertex colors.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.colorBuffer);
    // Describe color layout.
    gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
    // Enable the color attribute.
    gl.enableVertexAttribArray(program.attribColor);

    // Bind triangle indices.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphere.indexBuffer);
    // Tell the shader to use per-vertex colors supplied in the VBO.
    gl.uniform1f(program.uniformUseVertexColor, 1.0);
    // Disable clipping for the sphere itself.
    gl.uniform1f(program.uniformClipEnabled, 0.0);
    // Render both sides to see the interior when zoomed in.
    gl.disable(gl.CULL_FACE);
    // Draw the sphere.
    gl.drawElements(gl.TRIANGLES, this.sphere.indexCount, gl.UNSIGNED_SHORT, 0);
    // Restore face culling for subsequent draws.
    gl.enable(gl.CULL_FACE);

    // Draw axes
    if (shouldRenderAxes && this.axes) {
      // Upload identity transforms for static axes.
      gl.uniformMatrix4fv(program.uniformModel, false, this.identityModelMatrix);
      gl.uniformMatrix3fv(program.uniformNormalMatrix, false, this.identityNormalMatrix);

      // Bind axis vertex positions.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.axes.positionBuffer);
      // Describe position layout.
      gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
      // Enable the position attribute.
      gl.enableVertexAttribArray(program.attribPosition);

      // Bind axis normals for lighting.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.axes.normalBuffer);
      // Describe normal layout.
      gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
      // Enable the normal attribute.
      gl.enableVertexAttribArray(program.attribNormal);

      // Bind axis vertex colors.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.axes.colorBuffer);
      // Describe color layout.
      gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
      // Enable the color attribute.
      gl.enableVertexAttribArray(program.attribColor);

      // Bind axis indices.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.axes.indexBuffer);
      // Render all faces of the axis prisms.
      gl.disable(gl.CULL_FACE);
      // Offset depth values to avoid z-fighting with the sphere.
      gl.enable(gl.POLYGON_OFFSET_FILL);
      // Apply the polygon offset parameters.
      gl.polygonOffset(1.0, 1.0);
      // Instruct shader to use per-vertex colors.
      gl.uniform1f(program.uniformUseVertexColor, 1.0);
      // Clip beams when outside sphere.
      gl.uniform1f(program.uniformClipEnabled, clipEnabled ? 1.0 : 0.0);
      // Center the clipping sphere at the origin.
      gl.uniform3f(program.uniformClipCenter, 0.0, 0.0, 0.0);
      // Use the precomputed clip radius.
      gl.uniform1f(program.uniformClipRadius, clipRadius);
      // Draw the axis prisms.
      gl.drawElements(gl.TRIANGLES, this.axes.indexCount, gl.UNSIGNED_SHORT, 0);
      // Restore default depth behavior.
      gl.disable(gl.POLYGON_OFFSET_FILL);
      // Reinstate face culling for future draws.
      gl.enable(gl.CULL_FACE);
    }
  }

  startSimulation(): void {
    if (!this.simRunning) {
      this.simRunning = true;
      this.lastRenderTime = performance.now();
    }
  }

  stopSimulation(): void {
    this.simRunning = false;
  }

  isSimulationRunning(): boolean {
    return this.simRunning;
  }

  setSimulationSpeed(speed: number): void {
    this.simSpeed = clamp(speed, 1, 60);
  }

  getSimulationSpeed(): number {
    return this.simSpeed;
  }

  getSimObjects(): ReadonlyArray<SimObject> {
    return this.simObjects;
  }

  isAxisVisible(): boolean {
    return this.axisVisible;
  }

  setAxisVisible(visible: boolean): void {
    this.axisVisible = visible;
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
