// App.ts — renders a matte sphere with custom WebGL orbit controls (no external deps)
import {
  Assets,
  type AxisMesh,
  type AxisSet,
  type SphereMesh,
  type SphereProgram,
} from '../engine/Assets';
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
  mat4Multiply,
  normalizeVec3,
} from './math3d';

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
  private program: SphereProgram | null = null;
  private sphere: SphereMesh | null = null;
  private axes: AxisSet | null = null;
  private axisVisibility: Record<'x' | 'y' | 'z', boolean> = { x: true, y: true, z: true };
  private sphereSegments = { lat: 48, lon: 48 };
  private shadingIntensity = 0.4;

  private readonly camera = new CameraController();
  private readonly identityModelMatrix = mat4Identity();
  private readonly identityNormalMatrix = mat3Identity();
  private readonly alignYAxisToZMatrix = mat4FromXRotation(-Math.PI / 2);
  private readonly alignYAxisToXMatrix = mat4FromZRotation(-Math.PI / 2);
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

    const program = Assets.createSphereProgram(gl);
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

    if (this.gl) {
      Assets.disposeSphereProgram(this.gl, this.program);
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
    Assets.useSphereProgram(gl, program);
    Assets.setSphereSharedUniforms(gl, program, {
      viewMatrix: this.viewMatrix,
      projectionMatrix: this.projectionMatrix,
      lightDirection: normalizeVec3([0.5, 0.8, 0.4]),
    });

    for (const simObject of this.simObjects) {
      if (beats > 0) {
        simObject.rotationY += beats * this.rotationPerBeat * simObject.speedPerTick * simObject.direction;
      }

      const { modelMatrix, normalMatrix } = this.computeModelMatrices(simObject);
      Assets.drawSphere(gl, program, simObject.mesh, {
        modelMatrix,
        normalMatrix,
        shadingIntensity: this.shadingIntensity,
        planeVector: this.getPlaneNormal(simObject.plane),
      });
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
    let rotationMatrix: Float32Array;
    let alignmentMatrix: Float32Array;

    switch (simObject.plane) {
      case 'GB':
        rotationMatrix = mat4FromYRotation(simObject.rotationY);
        alignmentMatrix = this.identityModelMatrix;
        break;
      case 'YG':
        rotationMatrix = mat4FromZRotation(simObject.rotationY);
        alignmentMatrix = this.alignYAxisToZMatrix;
        break;
      case 'YB':
        rotationMatrix = mat4FromXRotation(simObject.rotationY);
        alignmentMatrix = this.alignYAxisToXMatrix;
        break;
      default:
        rotationMatrix = mat4FromYRotation(simObject.rotationY);
        alignmentMatrix = this.identityModelMatrix;
        break;
    }

    const modelMatrix = mat4Multiply(rotationMatrix, alignmentMatrix);

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

}
