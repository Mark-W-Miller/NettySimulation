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
  mat4ScaleUniform,
  normalizeVec3,
} from './math3d';

type BaseColor =
  | 'crimson'
  | 'amber'
  | 'gold'
  | 'lime'
  | 'teal'
  | 'azure'
  | 'violet'
  | 'magenta';

interface SimObject {
  id: string;
  mesh: SphereMesh;
  rotationY: number;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellSize: number;
  baseColor: BaseColor;
  visible: boolean;
}

interface SimObjectDefinition {
  id: string;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellSize: number;
  baseColor: BaseColor;
  visible?: boolean;
  initialRotationY?: number;
}

interface SimulationSegmentDefinition {
  id: string;
  name: string;
  objects: SimObjectDefinition[];
}

export class App {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: SphereProgram | null = null;
  private sphere: SphereMesh | null = null;
  private axes: AxisSet | null = null;
  private rotatedAxes: AxisSet | null = null;
  private axisVisibility: Record<'x' | 'y' | 'z', boolean> = { x: true, y: true, z: true };
  private showSecondaryAxes = true;
  private sphereSegments = { lat: 48, lon: 48 };
  private shadingIntensity = 0.4;

  private readonly camera = new CameraController();
  private readonly identityModelMatrix = mat4Identity();
  private readonly identityNormalMatrix = mat3Identity();
  private readonly alignYAxisToZMatrix = mat4FromXRotation(-Math.PI / 2);
  private readonly alignYAxisToXMatrix = mat4FromZRotation(-Math.PI / 2);
  private readonly rotatedAxisModelMatrix: Float32Array;
  private readonly rotatedAxisNormalMatrix: Float32Array;
  private readonly defaultShellSize = 32;
  private readonly baseColorVectors: Record<BaseColor, Float32Array> = {
    crimson: new Float32Array([0.86, 0.19, 0.29]),
    amber: new Float32Array([1.0, 0.75, 0.27]),
    gold: new Float32Array([0.98, 0.86, 0.29]),
    lime: new Float32Array([0.54, 0.86, 0.27]),
    teal: new Float32Array([0.1, 0.65, 0.64]),
    azure: new Float32Array([0.2, 0.55, 0.96]),
    violet: new Float32Array([0.55, 0.34, 0.84]),
    magenta: new Float32Array([0.78, 0.16, 0.76]),
  };
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
  private selectedObjectId: string | null = null;
  private readonly segmentDefinitions: SimulationSegmentDefinition[] = [
    {
      id: 'rgp',
      name: 'RGP Simulation',
      objects: [
        {
          id: 'sphere-primary',
          speedPerTick: 1,
          direction: 1,
          plane: 'YG',
          shellSize: 32,
          baseColor: 'azure',
          visible: true,
        },
        {
          id: 'sphere-secondary',
          speedPerTick: 0.75,
          direction: -1,
          plane: 'GB',
          shellSize: 24,
          baseColor: 'crimson',
          visible: true,
          initialRotationY: Math.PI / 4,
        },
      ],
    },
  ];
  private selectedSegmentId: string | null = null;
  private readonly simListeners = new Set<() => void>();

  constructor() {
    const rotateY = mat4FromYRotation(Math.PI / 4);
    const rotateX = mat4FromXRotation(Math.PI / 4);
    this.rotatedAxisModelMatrix = mat4Multiply(rotateX, rotateY);
    this.rotatedAxisNormalMatrix = mat3FromMat4(this.rotatedAxisModelMatrix);
  }

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
    const rotatedAxes = Assets.createAxisSet(gl);

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.sphere = sphere;
    this.axes = axes;
    this.rotatedAxes = rotatedAxes;

    const defaultSegment = this.segmentDefinitions[0];
    if (defaultSegment) {
      this.loadSegment(defaultSegment.id);
    } else {
      this.simObjects.length = 0;
      this.selectedSegmentId = null;
      this.selectedObjectId = null;
      this.notifySimChange();
    }

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

    if (this.gl && this.rotatedAxes) {
      Assets.disposeAxisSet(this.gl, this.rotatedAxes);
    }

    if (this.gl) {
      Assets.disposeSphereProgram(this.gl, this.program);
    }

    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.sphere = null;
    this.axes = null;
    this.rotatedAxes = null;
    this.simObjects.length = 0;
    this.simRunning = false;
    this.selectedObjectId = null;
    this.selectedSegmentId = null;
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
    const shouldRenderPrimaryAxes = Boolean(this.axes) && anyAxisVisible;
    const shouldRenderSecondaryAxes = Boolean(this.rotatedAxes) && anyAxisVisible && this.showSecondaryAxes;
    const shouldRenderAxes = shouldRenderPrimaryAxes || shouldRenderSecondaryAxes;
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
      if (!simObject.visible) {
        continue;
      }
      if (beats > 0) {
        simObject.rotationY += beats * this.rotationPerBeat * simObject.speedPerTick * simObject.direction;
      }

      const { modelMatrix, normalMatrix } = this.computeModelMatrices(simObject);
      Assets.drawSphere(gl, program, simObject.mesh, {
        modelMatrix,
        normalMatrix,
        shadingIntensity: this.shadingIntensity,
        planeVector: this.getPlaneNormal(simObject.plane),
        baseColor: this.getBaseColorVector(simObject.baseColor),
        vertexColorWeight: 0.75,
      });
    }

    // Draw axes
    if (shouldRenderAxes) {
      if (shouldRenderPrimaryAxes && this.axes) {
        this.drawAxisSet(gl, program, this.axes, this.identityModelMatrix, this.identityNormalMatrix, clipEnabled, clipRadius);
      }
      if (shouldRenderSecondaryAxes && this.rotatedAxes) {
        this.drawAxisSet(gl, program, this.rotatedAxes, this.rotatedAxisModelMatrix, this.rotatedAxisNormalMatrix, clipEnabled, clipRadius);
      }
    }
  }

  private loadSegment(segmentId: string): void {
    const segment = this.segmentDefinitions.find((definition) => definition.id === segmentId);
    if (!segment) {
      return;
    }

    this.selectedSegmentId = segmentId;

    if (!this.gl) {
      return;
    }

    const mesh = this.ensureSphereMesh();

    this.simObjects.length = 0;
    for (const objectDef of segment.objects) {
      this.simObjects.push({
        id: objectDef.id,
        mesh,
        rotationY: objectDef.initialRotationY ?? 0,
        speedPerTick: objectDef.speedPerTick,
        direction: objectDef.direction,
        plane: objectDef.plane,
        shellSize: objectDef.shellSize ?? this.defaultShellSize,
        baseColor: objectDef.baseColor ?? 'azure',
        visible: objectDef.visible ?? true,
      });
    }

    this.selectedObjectId = segment.objects[0]?.id ?? null;
    this.notifySimChange();
  }

  private ensureSphereMesh(): SphereMesh {
    if (!this.sphere) {
      if (!this.gl) {
        throw new Error('Sphere mesh requested before WebGL context initialized.');
      }
      this.sphere = Assets.createSphereMesh(this.gl, this.sphereSegments.lat, this.sphereSegments.lon);
    }
    return this.sphere;
  }

  private drawAxisSet(
    gl: WebGLRenderingContext,
    program: SphereProgram,
    axisSet: AxisSet,
    modelMatrix: Float32Array,
    normalMatrix: Float32Array,
    clipEnabled: boolean,
    clipRadius: number,
  ): void {
    const axisEntries: Array<['x' | 'y' | 'z', AxisMesh]> = [
      ['x', axisSet.x],
      ['y', axisSet.y],
      ['z', axisSet.z],
    ];

    for (const [axisKey, mesh] of axisEntries) {
      if (!this.axisVisibility[axisKey]) {
        continue;
      }

      gl.uniformMatrix4fv(program.uniformModel, false, modelMatrix);
      gl.uniformMatrix3fv(program.uniformNormalMatrix, false, normalMatrix);

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
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.0, 1.0);
      gl.uniform1f(program.uniformUseVertexColor, 1.0);
      gl.uniform1f(program.uniformShadingIntensity, 0.0);
      gl.uniform3f(program.uniformPlaneVector, 0.0, 0.0, 0.0);
      gl.uniform1f(program.uniformClipEnabled, clipEnabled ? 1.0 : 0.0);
      gl.uniform3f(program.uniformClipCenter, 0.0, 0.0, 0.0);
      gl.uniform1f(program.uniformClipRadius, clipRadius);
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.CULL_FACE);
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

  getSimulationSegments(): ReadonlyArray<{ id: string; name: string }> {
    return this.segmentDefinitions.map(({ id, name }) => ({ id, name }));
  }

  getSelectedSimulationSegmentId(): string | null {
    return this.selectedSegmentId;
  }

  selectSimulationSegment(id: string): void {
    if (this.selectedSegmentId === id) {
      return;
    }
    this.loadSegment(id);
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

  updateSelectedSimObject(
    update: Partial<Pick<SimObject, 'speedPerTick' | 'direction' | 'plane' | 'shellSize' | 'baseColor' | 'visible'>>,
  ): void {
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

    if (typeof update.shellSize === 'number' && Number.isFinite(update.shellSize)) {
      selected.shellSize = Math.max(1, Math.floor(update.shellSize));
    }

    if (update.baseColor) {
      selected.baseColor = update.baseColor;
    }

    if (typeof update.visible === 'boolean') {
      selected.visible = update.visible;
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

    const rotationAndAlignment = mat4Multiply(rotationMatrix, alignmentMatrix);
    const scaleFactor = Math.max(0.01, simObject.shellSize / this.defaultShellSize);
    const scaleMatrix = mat4ScaleUniform(scaleFactor);
    const modelMatrix = mat4Multiply(rotationAndAlignment, scaleMatrix);

    return {
      modelMatrix,
      normalMatrix: mat3FromMat4(rotationAndAlignment),
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

  private getBaseColorVector(color: BaseColor): Float32Array {
    return this.baseColorVectors[color];
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

  getSecondaryAxesVisible(): boolean {
    return this.showSecondaryAxes;
  }

  setSecondaryAxesVisible(visible: boolean): void {
    if (this.showSecondaryAxes === visible) {
      return;
    }
    this.showSecondaryAxes = visible;
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
      for (const simObject of this.simObjects) {
        simObject.mesh = newMesh;
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
