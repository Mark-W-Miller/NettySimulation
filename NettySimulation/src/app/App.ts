// App.ts — renders a matte sphere with custom WebGL orbit controls (no external deps)
import { Assets, type AxisMesh, type AxisSet, type SphereMesh } from '../engine/Assets';
import { CameraController } from './camera';
import {
  clamp,
  mat3FromMat4,
  mat3Identity,
  mat4FromXRotation,
  mat4FromYRotation,
  mat4FromZRotation,
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
  uniformShadingIntensity: WebGLUniformLocation;
  uniformPlaneVector: WebGLUniformLocation;
}

interface SimObject {
  id: string;
  mesh: SphereMesh;
  rotationY: number;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
}

export class App {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: ShaderProgram | null = null;
  private sphere: SphereMesh | null = null;
  private axes: AxisSet | null = null;
  private axisVisibility: Record<'x' | 'y' | 'z', boolean> = { x: true, y: true, z: true };
  private sphereSegments = { lat: 48, lon: 48 };
  private shadingIntensity = 0.4;

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
  private selectedObjectId: string | null = null;
  private readonly simListeners = new Set<() => void>();

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
    const sphere = Assets.createSphereMesh(gl, this.sphereSegments.lat, this.sphereSegments.lon);
    const axes = Assets.createAxisSet(gl);

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.sphere = sphere;
    this.axes = axes;

    this.sphereObject = {
      id: 'sphere',
      mesh: sphere,
      rotationY: 0,
      speedPerTick: 1,
      direction: 1,
      plane: 'YG',
    };
    this.simObjects.push(this.sphereObject);
    this.selectedObjectId = this.sphereObject.id;
    this.notifySimChange();

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
      Assets.disposeAxisSet(this.gl, this.axes);
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
    this.selectedObjectId = null;
    this.notifySimChange();
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
    const anyAxisVisible = this.axisVisibility.x || this.axisVisibility.y || this.axisVisibility.z;
    const shouldRenderAxes = anyAxisVisible && Boolean(this.axes);
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

    for (const simObject of this.simObjects) {
      if (beats > 0) {
        simObject.rotationY += beats * this.rotationPerBeat * simObject.speedPerTick * simObject.direction;
      }

      const { modelMatrix, normalMatrix } = this.computeModelMatrices(simObject);
      gl.uniformMatrix4fv(program.uniformModel, false, modelMatrix);
      gl.uniformMatrix3fv(program.uniformNormalMatrix, false, normalMatrix);
      gl.uniform1f(program.uniformShadingIntensity, this.shadingIntensity);
      gl.uniform3fv(program.uniformPlaneVector, this.getPlaneNormal(simObject.plane));

      const mesh = simObject.mesh;

      // Bind the sphere's position VBO to the ARRAY_BUFFER target so subsequent attribute calls read its vertex data.
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
      // Describe position layout.
      gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
      // Enable the position attribute.
      gl.enableVertexAttribArray(program.attribPosition);

      // Bind per-vertex normals.
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
      // Describe normal layout.
      gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
      // Enable the normal attribute.
      gl.enableVertexAttribArray(program.attribNormal);

      // Bind the baked vertex colors.
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
      // Describe color layout.
      gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
      // Enable the color attribute.
      gl.enableVertexAttribArray(program.attribColor);

      // Bind triangle indices.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      // Tell the shader to use per-vertex colors supplied in the VBO.
      gl.uniform1f(program.uniformUseVertexColor, 1.0);
      // Disable clipping for solid objects.
      gl.uniform1f(program.uniformClipEnabled, 0.0);
      // Render both sides to see the interior when zoomed in.
      gl.disable(gl.CULL_FACE);
      // Draw the mesh.
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      // Restore face culling for subsequent draws.
      gl.enable(gl.CULL_FACE);
    }

    // Draw axes
    if (shouldRenderAxes && this.axes) {
      const axisEntries: Array<['x' | 'y' | 'z', AxisMesh]> = [
        ['x', this.axes.x],
        ['y', this.axes.y],
        ['z', this.axes.z],
      ];

      for (const [axisKey, mesh] of axisEntries) {
        if (!this.axisVisibility[axisKey]) {
          continue;
        }

        // Upload identity transforms for static axes.
        gl.uniformMatrix4fv(program.uniformModel, false, this.identityModelMatrix);
        gl.uniformMatrix3fv(program.uniformNormalMatrix, false, this.identityNormalMatrix);

        // Bind axis vertex positions.
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
        // Describe position layout.
        gl.vertexAttribPointer(program.attribPosition, 3, gl.FLOAT, false, 0, 0);
        // Enable the position attribute.
        gl.enableVertexAttribArray(program.attribPosition);

        // Bind axis normals for lighting.
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        // Describe normal layout.
        gl.vertexAttribPointer(program.attribNormal, 3, gl.FLOAT, false, 0, 0);
        // Enable the normal attribute.
        gl.enableVertexAttribArray(program.attribNormal);

        // Bind axis vertex colors.
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
        // Describe color layout.
        gl.vertexAttribPointer(program.attribColor, 3, gl.FLOAT, false, 0, 0);
        // Enable the color attribute.
        gl.enableVertexAttribArray(program.attribColor);

        // Bind axis indices.
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        // Render all faces of the axis cylinders.
        gl.disable(gl.CULL_FACE);
        // Offset depth values to avoid z-fighting with the sphere.
        gl.enable(gl.POLYGON_OFFSET_FILL);
        // Apply the polygon offset parameters.
        gl.polygonOffset(1.0, 1.0);
        // Instruct shader to use per-vertex colors and reset gradient shading.
        gl.uniform1f(program.uniformUseVertexColor, 1.0);
        gl.uniform1f(program.uniformShadingIntensity, 0.0);
        gl.uniform3f(program.uniformPlaneVector, 0.0, 0.0, 0.0);
        // Clip beams when outside sphere.
        gl.uniform1f(program.uniformClipEnabled, clipEnabled ? 1.0 : 0.0);
        // Center the clipping sphere at the origin.
        gl.uniform3f(program.uniformClipCenter, 0.0, 0.0, 0.0);
        // Use the precomputed clip radius.
        gl.uniform1f(program.uniformClipRadius, clipRadius);
        // Draw the axis cylinder.
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        // Restore default depth behavior.
        gl.disable(gl.POLYGON_OFFSET_FILL);
        // Reinstate face culling for future draws.
        gl.enable(gl.CULL_FACE);
      }
    }
  }

  startSimulation(): void {
    if (!this.simRunning) {
      this.simRunning = true;
      this.lastRenderTime = performance.now();
      this.notifySimChange();
    }
  }

  stopSimulation(): void {
    if (this.simRunning) {
      this.simRunning = false;
      this.notifySimChange();
    }
  }

  isSimulationRunning(): boolean {
    return this.simRunning;
  }

  setSimulationSpeed(speed: number): void {
    const clamped = clamp(speed, 1, 60);
    if (clamped !== this.simSpeed) {
      this.simSpeed = clamped;
      this.notifySimChange();
    }
  }

  getSimulationSpeed(): number {
    return this.simSpeed;
  }

  getSimObjects(): ReadonlyArray<SimObject> {
    return [...this.simObjects];
  }

  onSimChange(listener: () => void): () => void {
    this.simListeners.add(listener);
    return () => {
      this.simListeners.delete(listener);
    };
  }

  selectSimObject(id: string | null): void {
    if (this.selectedObjectId === id) {
      return;
    }
    this.selectedObjectId = id;
    this.notifySimChange();
  }

  getSelectedSimObject(): SimObject | null {
    if (!this.selectedObjectId) {
      return null;
    }
    return this.simObjects.find((object) => object.id === this.selectedObjectId) ?? null;
  }

  updateSelectedSimObject(update: Partial<Pick<SimObject, 'speedPerTick' | 'direction' | 'plane'>>): void {
    const selected = this.getSelectedSimObject();
    if (!selected) {
      return;
    }

    if (typeof update.speedPerTick === 'number' && Number.isFinite(update.speedPerTick)) {
      selected.speedPerTick = Math.max(0.1, update.speedPerTick);
    }

    if (update.direction) {
      selected.direction = update.direction >= 0 ? 1 : -1;
    }

    if (update.plane) {
      selected.plane = update.plane;
    }

    this.notifySimChange();
  }

  private notifySimChange(): void {
    for (const listener of this.simListeners) {
      listener();
    }
  }

  private computeModelMatrices(simObject: SimObject): { modelMatrix: Float32Array; normalMatrix: Float32Array } {
    let modelMatrix: Float32Array;
    switch (simObject.plane) {
      case 'GB':
        modelMatrix = mat4FromYRotation(simObject.rotationY);
        break;
      case 'YG':
        modelMatrix = mat4FromZRotation(simObject.rotationY);
        break;
      case 'YB':
        modelMatrix = mat4FromXRotation(simObject.rotationY);
        break;
      default:
        modelMatrix = mat4FromYRotation(simObject.rotationY);
        break;
    }

    return {
      modelMatrix,
      normalMatrix: mat3FromMat4(modelMatrix),
    };
  }

  private getPlaneNormal(plane: SimObject['plane']): Float32Array {
    switch (plane) {
      case 'GB':
        return new Float32Array([0, 1, 0]);
      case 'YG':
        return new Float32Array([0, 0, 1]);
      case 'YB':
        return new Float32Array([1, 0, 0]);
      default:
        return new Float32Array([1, 0, 0]);
    }
  }

  getAxisVisibility(): Readonly<Record<'x' | 'y' | 'z', boolean>> {
    return { ...this.axisVisibility };
  }

  isAxisVisible(axis: 'x' | 'y' | 'z'): boolean {
    return this.axisVisibility[axis];
  }

  setAxisVisibility(axis: 'x' | 'y' | 'z', visible: boolean): void {
    if (this.axisVisibility[axis] === visible) {
      return;
    }
    this.axisVisibility[axis] = visible;
    this.notifySimChange();
  }

  getSphereSegments(): Readonly<{ lat: number; lon: number }> {
    return { ...this.sphereSegments };
  }

  setSphereSegments(lat: number, lon: number): void {
    const clampedLat = Math.max(1, Math.floor(lat));
    const clampedLon = Math.max(1, Math.floor(lon));

    if (clampedLat === this.sphereSegments.lat && clampedLon === this.sphereSegments.lon) {
      return;
    }

    this.sphereSegments = { lat: clampedLat, lon: clampedLon };

    if (this.gl) {
      const oldMesh = this.sphere;
      const newMesh = Assets.createSphereMesh(this.gl, clampedLat, clampedLon);
      this.sphere = newMesh;
      if (this.sphereObject) {
        this.sphereObject.mesh = newMesh;
      }
      if (oldMesh) {
        Assets.disposeSphereMesh(this.gl, oldMesh);
      }
    }

    this.notifySimChange();
  }

  getShadingIntensity(): number {
    return this.shadingIntensity;
  }

  setShadingIntensity(intensity: number): void {
    const clamped = clamp(intensity, 0, 1);
    if (clamped === this.shadingIntensity) {
      return;
    }
    this.shadingIntensity = clamped;
    this.notifySimChange();
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
