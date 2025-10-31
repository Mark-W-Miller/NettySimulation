// App.ts — renders a matte sphere with custom WebGL orbit controls (no external deps)
import {
  Assets,
  DEFAULT_AXIS_RADIUS,
  type AxisMesh,
  type AxisSet,
  type AxisProgram,
  type SphereMesh,
  type SphereProgram,
  type TwirlMesh,
  type TwirlProgram,
  type TwirlingAxisMesh,
} from '../engine/Assets';
import { AXIS_COLORS } from '../engine/assets/axisAsset';
import {
  TWIRLING_AXIS_BASE_LENGTH,
  TWIRLING_AXIS_BASE_RADIUS,
  TWIRLING_AXIS_BALL_SCALE,
} from '../engine/assets/twirlingAxisAsset';
import {
  type BaseColor,
  type SphereObjectDefinition,
  type TwirlObjectDefinition,
  type TwirlingAxisObjectDefinition,
  type SimObjectDefinition,
} from '../engine/assets/simTypes';
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
  mat4Scale,
  mat4ScaleUniform,
  normalizeVec3,
} from './math3d';

const MAX_GHOST_PARTICLES = 4000;

interface BaseSimObject {
  id: string;
  rotationY: number;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  visible: boolean;
  shadingIntensity: number;
  opacity: number;
}

interface SphereObject extends BaseSimObject {
  type: 'sphere';
  mesh: SphereMesh;
  shellSize: number;
  baseColor: BaseColor;
}

interface TwirlObject extends BaseSimObject {
  type: 'twirl';
  mesh: TwirlMesh;
  shellSize: number;
  baseColor: BaseColor;
  beltHalfAngle: number;
  pulseSpeed: number;
  pulsePhase: number;
  pulseScale: number;
}

interface TwirlingAxisObject {
  type: 'twirling-axis';
  id: string;
  mesh: TwirlingAxisMesh;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  speedPerTick: number;
  direction: 1 | -1;
  visible: boolean;
  spinX: boolean;
  spinY: boolean;
  spinZ: boolean;
  size: number;
  opacity: number;
}

type SimObject = SphereObject | TwirlObject | TwirlingAxisObject;

interface GhostParticle {
  position: Float32Array;
  color: Float32Array;
  radius: number;
  opacity: number;
}

type SimObjectUpdatePayload = Partial<{
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellSize: number;
  baseColor: BaseColor;
  visible: boolean;
  shadingIntensity: number;
  opacity: number;
  spinX: boolean;
  spinY: boolean;
  spinZ: boolean;
  size: number;
  beltHalfAngle: number;
  pulseSpeed: number;
}>; 

interface SimulationSegmentDefinition {
  id: string;
  name: string;
  objects: SimObjectDefinition[];
}

export class App {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private sphereProgram: SphereProgram | null = null;
  private twirlProgram: TwirlProgram | null = null;
  private axisProgram: AxisProgram | null = null;
  private sphereMesh: SphereMesh | null = null;
  private twirlMesh: TwirlMesh | null = null;
  private twirlingAxisMesh: TwirlingAxisMesh | null = null;
  private axes: AxisSet | null = null;
  private rotatedAxes: AxisSet | null = null;
  private axisVisibility: Record<'x' | 'y' | 'z', boolean> = { x: true, y: true, z: true };
  private showSecondaryAxes = false;
  private axisOpacitySlider = 1;
  private axisRadiusScale = 1;
  private sphereSegments = { lat: 48, lon: 48 };
  private shadingIntensity = 0.4;
  private ghostParticles: GhostParticle[] = [];
  private ghostBeatAccumulator = 0;

  private readonly camera = new CameraController();
  private readonly identityModelMatrix = mat4Identity();
  private readonly identityNormalMatrix = mat3Identity();
  private readonly originVector = new Float32Array([0, 0, 0]);
  private readonly alignYAxisToZMatrix = mat4FromXRotation(-Math.PI / 2);
  private readonly alignYAxisToXMatrix = mat4FromZRotation(-Math.PI / 2);
  private readonly rotatedAxisModelMatrix: Float32Array;
  private readonly rotatedAxisNormalMatrix: Float32Array;
  private readonly defaultShellSize = 32;
  private readonly baseColorVectors: Record<BaseColor, Float32Array> = {
    crimson: new Float32Array([0.86, 0.19, 0.29]),
    red: new Float32Array([0.95, 0.2, 0.23]),
    amber: new Float32Array([1.0, 0.75, 0.27]),
    gold: new Float32Array([0.98, 0.86, 0.29]),
    lime: new Float32Array([0.54, 0.86, 0.27]),
    teal: new Float32Array([0.1, 0.65, 0.64]),
    azure: new Float32Array([0.2, 0.55, 0.96]),
    violet: new Float32Array([0.55, 0.34, 0.84]),
    magenta: new Float32Array([0.78, 0.16, 0.76]),
    white: new Float32Array([1.0, 1.0, 1.0]),
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
          type: 'sphere',
          id: 'sphere-primary',
          speedPerTick: 1,
          direction: 1,
          plane: 'YG',
          shellSize: 32,
          baseColor: 'azure',
          visible: true,
          shadingIntensity: 0.4,
          opacity: 1,
        },
        {
          type: 'sphere',
          id: 'sphere-secondary',
          speedPerTick: 0.75,
          direction: -1,
          plane: 'GB',
          shellSize: 24,
          baseColor: 'crimson',
          visible: true,
          shadingIntensity: 0.55,
          opacity: 0.85,
          initialRotationY: Math.PI / 4,
        },
      ],
    },
    {
      id: 'rgp-formation',
      name: 'RGP Formation',
      objects: [
        {
          type: 'twirl',
          id: 'white-ring',
          speedPerTick: 1,
          direction: 1,
          plane: 'GB',
          shellSize: 20,
          baseColor: 'white',
          visible: true,
          shadingIntensity: 0.35,
          opacity: 1,
          beltHalfAngle: 0.18,
          pulseSpeed: 0.75,
          initialRotationY: Math.PI / 6,
          initialPulsePhase: 0.5,
          initialPulseScale: 0.25,
        },
        {
          type: 'twirl',
          id: 'red-ring',
          speedPerTick: 0.9,
          direction: 1,
          plane: 'YG',
          shellSize: 28,
          baseColor: 'red',
          visible: true,
          shadingIntensity: 0.45,
          opacity: 1,
          beltHalfAngle: 0.22,
          pulseSpeed: 0.75,
          initialRotationY: Math.PI / 6,
          initialPulsePhase: 0.5,
          initialPulseScale: 1,
        },
        {
          type: 'twirling-axis',
          id: 'formation-axis',
          speedPerTick: 10,
          direction: 1,
          visible: true,
          spinX: false,
          spinY: true,
          spinZ: true,
          size: 1,
          initialRotationY: 0,
          initialRotationZ: 0,
          opacity: 1,
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

    const sphereProgram = Assets.createSphereProgram(gl);
    const axisProgram = Assets.createAxisProgram(gl);
    const twirlProgram = Assets.createTwirlProgram(gl);
    const sphere = Assets.createSphereMesh(gl, this.sphereSegments.lat, this.sphereSegments.lon);
    const twirl = Assets.createTwirlMesh(
      gl,
      Math.max(32, this.sphereSegments.lon * 4),
      this.sphereSegments.lon,
    );
    const axisRadius = this.getAxisRadiusValue();
    const axes = Assets.createAxisSet(gl, {
      radius: axisRadius,
    });
    const rotatedAxes = Assets.createAxisSet(gl, {
      radius: axisRadius * 0.25,
      negativeAlphaScale: 1.0,
    });

    this.canvas = canvas;
    this.gl = gl;
    this.sphereProgram = sphereProgram;
    this.axisProgram = axisProgram;
    this.twirlProgram = twirlProgram;
    this.sphereMesh = sphere;
    this.twirlMesh = twirl;
    this.axes = axes;
    this.rotatedAxes = rotatedAxes;

    const hashSegment = window.location.hash.match(/#segment=(.+)$/)?.[1] ?? null;
    const defaultSegment = hashSegment
      ? this.segmentDefinitions.find((segment) => segment.id === hashSegment) ?? null
      : null;
    if (defaultSegment) {
      this.loadSegment(defaultSegment.id);
    } else if (this.segmentDefinitions[0]) {
      this.loadSegment(this.segmentDefinitions[0].id);
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
      this.render(beats, deltaSeconds);
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

    if (this.gl && this.sphereMesh) {
      Assets.disposeSphereMesh(this.gl, this.sphereMesh);
    }

    if (this.gl && this.twirlMesh) {
      Assets.disposeTwirlMesh(this.gl, this.twirlMesh);
    }

    if (this.gl && this.twirlingAxisMesh) {
      Assets.disposeTwirlingAxisMesh(this.gl, this.twirlingAxisMesh);
    }

    if (this.gl && this.axes) {
      Assets.disposeAxisSet(this.gl, this.axes);
    }

    if (this.gl && this.rotatedAxes) {
      Assets.disposeAxisSet(this.gl, this.rotatedAxes);
    }

    if (this.gl && this.axisProgram) {
      Assets.disposeAxisProgram(this.gl, this.axisProgram);
    }

    if (this.gl && this.sphereProgram) {
      Assets.disposeSphereProgram(this.gl, this.sphereProgram);
    }

    if (this.gl && this.twirlProgram) {
      Assets.disposeTwirlProgram(this.gl, this.twirlProgram);
    }

    this.canvas = null;
    this.gl = null;
    this.sphereProgram = null;
    this.axisProgram = null;
    this.twirlProgram = null;
    this.sphereMesh = null;
    this.twirlMesh = null;
    this.twirlingAxisMesh = null;
    this.axes = null;
    this.rotatedAxes = null;
    this.ghostParticles = [];
    this.ghostBeatAccumulator = 0;
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

  private render(beats: number, deltaSeconds: number): void {
    // Abort rendering when core WebGL resources are not yet initialized.
    if (
      !this.gl ||
      !this.sphereProgram ||
      !this.axisProgram ||
      !this.twirlProgram ||
      !this.sphereMesh ||
      !this.twirlMesh ||
      !this.canvas
    ) {
      return;
    }

    const gl = this.gl;
    const sphereProgram = this.sphereProgram;
    const axisProgram = this.axisProgram;
    const twirlProgram = this.twirlProgram;

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

    const sharedUniforms = {
      viewMatrix: this.viewMatrix,
      projectionMatrix: this.projectionMatrix,
      lightDirection: normalizeVec3([0.5, 0.8, 0.4]),
    };

    // Activate the sphere program for opaque objects by default.
    Assets.useSphereProgram(gl, sphereProgram);
    Assets.setSphereSharedUniforms(gl, sphereProgram, sharedUniforms);
    gl.disable(gl.BLEND);

    const sphereQueue: SphereObject[] = [];
    const twirlQueue: TwirlObject[] = [];
    const twirlingAxisQueue: TwirlingAxisObject[] = [];

    for (const simObject of this.simObjects) {
      if (!simObject.visible) {
        continue;
      }

      if (simObject.type === 'twirling-axis') {
        if (beats > 0) {
          const rotationDelta = beats * this.rotationPerBeat * simObject.speedPerTick * simObject.direction;
          if (simObject.spinX) {
            simObject.rotationX += rotationDelta;
          }
          if (simObject.spinY) {
            simObject.rotationY += rotationDelta;
          }
          if (simObject.spinZ) {
            simObject.rotationZ += rotationDelta;
          }
        }
        twirlingAxisQueue.push(simObject);
        continue;
      }

      if (beats > 0) {
        simObject.rotationY += beats * this.rotationPerBeat * simObject.speedPerTick * simObject.direction;
      }

      if (this.simRunning && simObject.type === 'twirl') {
        simObject.pulsePhase = (simObject.pulsePhase + deltaSeconds * simObject.pulseSpeed * 0.25) % 1;
        const triangle = simObject.pulsePhase < 0.5 ? simObject.pulsePhase * 2 : (1 - (simObject.pulsePhase - 0.5) * 2);
        const baseTriangle = simObject.id === 'white-ring' ? 1 - triangle : triangle;
        simObject.pulseScale = 0.25 + 0.75 * baseTriangle;
      }
      if (simObject.type === 'twirl') {
        twirlQueue.push(simObject);
      } else {
        sphereQueue.push(simObject);
      }
    }

    if (beats > 0 && twirlingAxisQueue.length > 0) {
      this.spawnGhostParticles(beats, twirlingAxisQueue);
    }

    for (const sphereObject of sphereQueue) {
      const { modelMatrix, normalMatrix } = this.computeModelMatrices(sphereObject);
      Assets.drawSphere(gl, sphereProgram, sphereObject.mesh, {
        modelMatrix,
        normalMatrix,
        shadingIntensity: sphereObject.shadingIntensity,
        planeVector: this.getPlaneNormal(sphereObject.plane),
        baseColor: this.getBaseColorVector(sphereObject.baseColor, sphereObject.opacity),
        vertexColorWeight: 0.75,
        opacityIntensity: sphereObject.opacity,
      });
    }

    if (twirlQueue.length > 0) {
      const sortedTwirlQueue = [...twirlQueue].sort((a, b) => b.shellSize - a.shellSize);

      Assets.useTwirlProgram(gl, twirlProgram);
      Assets.setTwirlSharedUniforms(gl, twirlProgram, sharedUniforms);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      for (const twirlObject of sortedTwirlQueue) {
        const { modelMatrix, normalMatrix } = this.computeModelMatrices(twirlObject);
        Assets.drawTwirl(gl, twirlProgram, twirlObject.mesh, {
          modelMatrix,
          normalMatrix,
          baseColor: this.getBaseColorVector(twirlObject.baseColor, twirlObject.opacity),
          planeVector: this.getPlaneNormal(twirlObject.plane),
          shadingIntensity: twirlObject.shadingIntensity,
          beltHalfAngle: twirlObject.beltHalfAngle,
          pulseScale: twirlObject.pulseScale,
          patternRepeats: Math.max(1, this.sphereSegments.lon / 2),
          patternOffset: ((twirlObject.rotationY / (Math.PI * 2)) % 1 + 1) % 1,
          opacityIntensity: twirlObject.opacity,
          clipEnabled: false,
          clipCenter: this.originVector,
          clipRadius: 0,
        });
      }

      gl.disable(gl.BLEND);

      // Restore sphere program for axis rendering.
      Assets.useSphereProgram(gl, sphereProgram);
      Assets.setSphereSharedUniforms(gl, sphereProgram, sharedUniforms);
    }

    this.drawGhostParticles(gl, sphereProgram);

    if (twirlingAxisQueue.length > 0) {
      Assets.useAxisProgram(gl, axisProgram);
      Assets.setAxisSharedUniforms(gl, axisProgram, sharedUniforms);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      for (const axisObject of twirlingAxisQueue) {
        const { modelMatrix, normalMatrix } = this.computeTwirlingAxisMatrices(axisObject);
        const axisOpacity = clamp(this.getAxisOpacityAlpha() * axisObject.opacity, 0, 1);
        Assets.drawTwirlingAxis(gl, axisProgram, axisObject.mesh, {
          modelMatrix,
          normalMatrix,
          clipEnabled: false,
          clipCenter: this.originVector,
          clipRadius: 0,
          opacity: axisOpacity,
        });
      }

      gl.disable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      Assets.useSphereProgram(gl, sphereProgram);
      Assets.setSphereSharedUniforms(gl, sphereProgram, sharedUniforms);
    }

    // Draw axes using the dedicated axis shader.
    if (shouldRenderAxes) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      Assets.useAxisProgram(gl, axisProgram);
      Assets.setAxisSharedUniforms(gl, axisProgram, sharedUniforms);
      if (shouldRenderPrimaryAxes && this.axes) {
        this.drawAxisSet(gl, axisProgram, this.axes, this.identityModelMatrix, this.identityNormalMatrix, clipEnabled, clipRadius);
      }
      if (shouldRenderSecondaryAxes && this.rotatedAxes) {
        this.drawAxisSet(
          gl,
          axisProgram,
          this.rotatedAxes,
          this.rotatedAxisModelMatrix,
          this.rotatedAxisNormalMatrix,
          clipEnabled,
          clipRadius,
        );
      }
      // Restore sphere program bindings for any subsequent draws.
      gl.disable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      Assets.useSphereProgram(gl, sphereProgram);
      Assets.setSphereSharedUniforms(gl, sphereProgram, sharedUniforms);
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

    this.ghostParticles = [];
    this.ghostBeatAccumulator = 0;

    this.simObjects.length = 0;
    for (const objectDef of segment.objects) {
      if (objectDef.type === 'twirl') {
        const mesh = this.ensureTwirlMesh();
        const initialPhase = clamp(objectDef.initialPulsePhase ?? 0, 0, 1);
        const phaseTriangle =
          initialPhase < 0.5 ? initialPhase * 2 : 1 - (initialPhase - 0.5) * 2;
        const initialTriangle =
          objectDef.id === 'white-ring' ? 1 - phaseTriangle : phaseTriangle;
        const initialScale =
          objectDef.initialPulseScale ??
          (0.25 + 0.75 * clamp(initialTriangle, 0, 1));
        this.simObjects.push({
          type: 'twirl',
          id: objectDef.id,
          mesh,
          rotationY: objectDef.initialRotationY ?? 0,
          speedPerTick: objectDef.speedPerTick,
          direction: objectDef.direction,
          plane: objectDef.plane,
          shellSize: objectDef.shellSize ?? this.defaultShellSize,
          baseColor: objectDef.baseColor ?? 'azure',
          visible: objectDef.visible ?? true,
          shadingIntensity: clamp(objectDef.shadingIntensity ?? this.shadingIntensity, 0, 1),
          opacity: clamp(objectDef.opacity ?? 1, 0, 1),
          beltHalfAngle: Math.max(0.01, objectDef.beltHalfAngle),
          pulseSpeed: Math.max(0, objectDef.pulseSpeed),
          pulsePhase: initialPhase,
          pulseScale: initialScale,
        });
      } else if (objectDef.type === 'twirling-axis') {
        const mesh = this.ensureTwirlingAxisMesh();
        this.simObjects.push({
          type: 'twirling-axis',
          id: objectDef.id,
          mesh,
          rotationX: objectDef.initialRotationX ?? 0,
          rotationY: objectDef.initialRotationY ?? 0,
          rotationZ: objectDef.initialRotationZ ?? 0,
          speedPerTick: objectDef.speedPerTick,
          direction: objectDef.direction,
          visible: objectDef.visible ?? true,
          spinX: objectDef.spinX ?? false,
          spinY: objectDef.spinY ?? false,
          spinZ: objectDef.spinZ ?? false,
          size: Math.max(0.01, objectDef.size ?? 1),
          opacity: clamp(objectDef.opacity ?? 1, 0, 1),
        });
      } else {
        const mesh = this.ensureSphereMesh();
        this.simObjects.push({
          type: 'sphere',
          id: objectDef.id,
          mesh,
          rotationY: objectDef.initialRotationY ?? 0,
          speedPerTick: objectDef.speedPerTick,
          direction: objectDef.direction,
          plane: objectDef.plane,
          shellSize: objectDef.shellSize ?? this.defaultShellSize,
          baseColor: objectDef.baseColor ?? 'azure',
          visible: objectDef.visible ?? true,
          shadingIntensity: clamp(objectDef.shadingIntensity ?? this.shadingIntensity, 0, 1),
          opacity: clamp(objectDef.opacity ?? 1, 0, 1),
        });
      }
    }

    this.selectedObjectId = segment.objects[0]?.id ?? null;
    this.notifySimChange();
  }

  private ensureSphereMesh(): SphereMesh {
    if (!this.sphereMesh) {
      if (!this.gl) {
        throw new Error('Sphere mesh requested before WebGL context initialized.');
      }
      this.sphereMesh = Assets.createSphereMesh(this.gl, this.sphereSegments.lat, this.sphereSegments.lon);
    }
    return this.sphereMesh;
  }

  private ensureTwirlMesh(): TwirlMesh {
    if (!this.twirlMesh) {
      if (!this.gl) {
        throw new Error('Twirl mesh requested before WebGL context initialized.');
      }
      this.twirlMesh = Assets.createTwirlMesh(
        this.gl,
        Math.max(32, this.sphereSegments.lon * 4),
        this.sphereSegments.lon,
      );
    }
    return this.twirlMesh;
  }

  private ensureTwirlingAxisMesh(): TwirlingAxisMesh {
    if (!this.twirlingAxisMesh) {
      if (!this.gl) {
        throw new Error('Twirling axis mesh requested before WebGL context initialized.');
      }
      this.twirlingAxisMesh = Assets.createTwirlingAxisMesh(this.gl);
    }
    return this.twirlingAxisMesh;
  }

  private drawAxisSet(
    gl: WebGLRenderingContext,
    program: AxisProgram,
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

      gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.0, 1.0);
      Assets.drawAxis(gl, program, mesh, {
        modelMatrix,
        normalMatrix,
        clipEnabled: false,
        clipCenter: this.originVector,
        clipRadius: 0,
        opacity: this.getAxisOpacityAlpha(),
      });
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

  resetSimulation(): void {
    const targetSegment = this.selectedSegmentId ?? this.segmentDefinitions[0]?.id ?? null;
    this.stopSimulation();
    this.ghostParticles = [];
    this.ghostBeatAccumulator = 0;
    if (targetSegment) {
      this.loadSegment(targetSegment);
    } else {
      this.simObjects.length = 0;
      this.selectedObjectId = null;
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

  updateSelectedSimObject(update: SimObjectUpdatePayload): void {
    const selected = this.getSelectedSimObject();
    if (!selected) {
      return;
    }

    if (typeof update.speedPerTick === 'number' && Number.isFinite(update.speedPerTick)) {
      selected.speedPerTick = Math.max(0.1, update.speedPerTick);
    }

    if (update.direction !== undefined) {
      selected.direction = update.direction >= 0 ? 1 : -1;
    }

    if (typeof update.visible === 'boolean') {
      selected.visible = update.visible;
    }

    if (typeof update.opacity === 'number' && Number.isFinite(update.opacity)) {
      const clampedOpacity = clamp(update.opacity, 0, 1);
      if (selected.type === 'twirling-axis') {
        selected.opacity = clampedOpacity;
      } else {
        selected.opacity = clampedOpacity;
      }
    }

    if (selected.type === 'twirling-axis') {
      if (typeof update.spinX === 'boolean') {
        selected.spinX = update.spinX;
      }
      if (typeof update.spinY === 'boolean') {
        selected.spinY = update.spinY;
      }
      if (typeof update.spinZ === 'boolean') {
        selected.spinZ = update.spinZ;
      }
      if (typeof update.size === 'number' && Number.isFinite(update.size)) {
        selected.size = Math.max(0.01, update.size);
      }
    } else {
      if (update.plane) {
        selected.plane = update.plane;
      }

      if (typeof update.shellSize === 'number' && Number.isFinite(update.shellSize)) {
        selected.shellSize = Math.max(1, Math.floor(update.shellSize));
      }

      if (update.baseColor) {
        selected.baseColor = update.baseColor;
      }

      if (typeof update.shadingIntensity === 'number' && Number.isFinite(update.shadingIntensity)) {
        selected.shadingIntensity = clamp(update.shadingIntensity, 0, 1);
      }

      if (selected.type === 'twirl') {
        if (typeof update.beltHalfAngle === 'number' && Number.isFinite(update.beltHalfAngle)) {
          selected.beltHalfAngle = clamp(update.beltHalfAngle, 0.001, Math.PI / 2);
        }

        if (typeof update.pulseSpeed === 'number' && Number.isFinite(update.pulseSpeed)) {
          selected.pulseSpeed = Math.max(0, update.pulseSpeed);
        }
      }
    }

    this.notifySimChange();
  }

  private notifySimChange(): void {
    for (const listener of this.simListeners) {
      listener();
    }
  }

  private computeModelMatrices(simObject: SimObject): { modelMatrix: Float32Array; normalMatrix: Float32Array } {
    if (simObject.type === 'twirling-axis') {
      return this.computeTwirlingAxisMatrices(simObject);
    }

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

    let modelMatrix: Float32Array;
    if (simObject.type === 'twirl') {
      const radiusScale = Math.max(0.05, (simObject.shellSize / this.defaultShellSize) * simObject.pulseScale);
      const heightScale = Math.max(0.01, Math.sin(simObject.beltHalfAngle));
      const scaleMatrix = mat4Scale(Math.max(radiusScale, 0.01), Math.max(heightScale, 0.005), Math.max(radiusScale, 0.01));
      modelMatrix = mat4Multiply(rotationAndAlignment, scaleMatrix);
    } else {
      const scaleFactor = Math.max(0.01, simObject.shellSize / this.defaultShellSize);
      const scaleMatrix = mat4ScaleUniform(scaleFactor);
      modelMatrix = mat4Multiply(rotationAndAlignment, scaleMatrix);
    }

    return {
      modelMatrix,
      normalMatrix: mat3FromMat4(rotationAndAlignment),
    };
  }

  private computeTwirlingAxisMatrices(
    simObject: TwirlingAxisObject,
  ): { modelMatrix: Float32Array; normalMatrix: Float32Array } {
    let rotationMatrix = mat4Identity();

    if (simObject.spinY || simObject.rotationY !== 0) {
      rotationMatrix = mat4Multiply(rotationMatrix, mat4FromYRotation(simObject.rotationY));
    }

    if (simObject.spinZ || simObject.rotationZ !== 0) {
      rotationMatrix = mat4Multiply(rotationMatrix, mat4FromZRotation(simObject.rotationZ));
    }

    if (simObject.spinX || simObject.rotationX !== 0) {
      rotationMatrix = mat4Multiply(rotationMatrix, mat4FromXRotation(simObject.rotationX));
    }

    const scaleFactor = Math.max(0.01, simObject.size);
    const scaleMatrix = mat4ScaleUniform(scaleFactor);
    const modelMatrix = mat4Multiply(rotationMatrix, scaleMatrix);

    return {
      modelMatrix,
      normalMatrix: mat3FromMat4(rotationMatrix),
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

  private getBaseColorVector(color: BaseColor, opacity: number): Float32Array {
    const base = this.baseColorVectors[color];
    return new Float32Array([base[0], base[1], base[2], clamp(opacity, 0, 1)]);
  }

  private getAxisRadiusValue(): number {
    const baseRadius = DEFAULT_AXIS_RADIUS * 0.1;
    return baseRadius * this.axisRadiusScale;
  }

  private rebuildAxisMeshes(): void {
    if (!this.gl) {
      return;
    }

    const gl = this.gl;
    const axisRadius = this.getAxisRadiusValue();
    const previousPrimary = this.axes;
    const previousSecondary = this.rotatedAxes;

    const newPrimary = Assets.createAxisSet(gl, {
      radius: axisRadius,
    });
    const newSecondary = Assets.createAxisSet(gl, {
      radius: axisRadius * 0.25,
      negativeAlphaScale: 1.0,
    });

    this.axes = newPrimary;
    this.rotatedAxes = newSecondary;

    if (previousPrimary) {
      Assets.disposeAxisSet(gl, previousPrimary);
    }
    if (previousSecondary) {
      Assets.disposeAxisSet(gl, previousSecondary);
    }
  }

  private spawnGhostParticles(beats: number, axisObjects: TwirlingAxisObject[]): void {
    if (!this.simRunning || beats <= 0) {
      return;
    }

    this.ghostBeatAccumulator += beats;
    const spawnIterations = Math.floor(this.ghostBeatAccumulator);
    if (spawnIterations <= 0) {
      return;
    }
    this.ghostBeatAccumulator -= spawnIterations;

    const halfLength = TWIRLING_AXIS_BASE_LENGTH / 2;

    for (let iteration = 0; iteration < spawnIterations; iteration += 1) {
      for (const axisObject of axisObjects) {
        if (!axisObject.visible) {
          continue;
        }
        const { modelMatrix } = this.computeTwirlingAxisMatrices(axisObject);
        const sizeScale = Math.max(0.01, axisObject.size);
        const ballRadius = TWIRLING_AXIS_BASE_RADIUS * TWIRLING_AXIS_BALL_SCALE * sizeScale;
        const ghostOpacity = clamp(axisObject.opacity * 0.6, 0.05, 1);

        const xTip = this.transformPoint(modelMatrix, [halfLength, 0, 0]);
        const yTip = this.transformPoint(modelMatrix, [0, halfLength, 0]);

        this.addGhostParticle(xTip, AXIS_COLORS.x, ballRadius, ghostOpacity);
        this.addGhostParticle(yTip, AXIS_COLORS.y, ballRadius, ghostOpacity);
      }
    }
  }

  private addGhostParticle(position: Float32Array, color: [number, number, number], radius: number, opacity: number): void {
    this.ghostParticles.push({
      position,
      color: new Float32Array(color),
      radius,
      opacity,
    });

    if (this.ghostParticles.length > MAX_GHOST_PARTICLES) {
      this.ghostParticles.splice(0, this.ghostParticles.length - MAX_GHOST_PARTICLES);
    }
  }

  private drawGhostParticles(gl: WebGLRenderingContext, sphereProgram: SphereProgram): void {
    if (this.ghostParticles.length === 0) {
      return;
    }

    const mesh = this.ensureSphereMesh();
    const planeVector = new Float32Array([0, 1, 0]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (const ghost of this.ghostParticles) {
      const modelMatrix = this.makeTranslationScaleMatrix(ghost.position, ghost.radius);
      const baseColor = new Float32Array([ghost.color[0], ghost.color[1], ghost.color[2], ghost.opacity]);

      Assets.drawSphere(gl, sphereProgram, mesh, {
        modelMatrix,
        normalMatrix: this.identityNormalMatrix,
        shadingIntensity: 0.1,
        planeVector,
        baseColor,
        vertexColorWeight: 0,
        opacityIntensity: ghost.opacity,
      });
    }

    gl.disable(gl.BLEND);
  }

  private transformPoint(matrix: Float32Array, point: [number, number, number]): Float32Array {
    const [x, y, z] = point;
    const outX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const outY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const outZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    return new Float32Array([outX, outY, outZ]);
  }

  private makeTranslationScaleMatrix(position: Float32Array, scale: number): Float32Array {
    const translation = mat4Identity();
    translation[12] = position[0];
    translation[13] = position[1];
    translation[14] = position[2];
    const scaleMatrix = mat4ScaleUniform(scale);
    return mat4Multiply(translation, scaleMatrix);
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

  getAxisOpacity(): number {
    return this.axisOpacitySlider;
  }

  setAxisOpacity(value: number): void {
    const clamped = clamp(value, 0, 1);
    if (this.axisOpacitySlider === clamped) {
      return;
    }
    this.axisOpacitySlider = clamped;
    this.notifySimChange();
  }

  getAxisRadiusScale(): number {
    return this.axisRadiusScale;
  }

  setAxisRadiusScale(scale: number): void {
    if (!Number.isFinite(scale)) {
      return;
    }
    const clamped = Math.max(1, Math.floor(scale));
    if (clamped === this.axisRadiusScale) {
      return;
    }
    this.axisRadiusScale = clamped;
    this.rebuildAxisMeshes();
    this.notifySimChange();
  }

  private getAxisOpacityAlpha(): number {
    return this.axisOpacitySlider;
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
      const oldMesh = this.sphereMesh;
      const newMesh = Assets.createSphereMesh(this.gl, clampedLat, clampedLon);
      this.sphereMesh = newMesh;
      for (const simObject of this.simObjects) {
        if (simObject.type === 'sphere') {
          simObject.mesh = newMesh;
        }
      }
      if (oldMesh) {
        Assets.disposeSphereMesh(this.gl, oldMesh);
      }
      const oldTwirl = this.twirlMesh;
      const newTwirl = Assets.createTwirlMesh(this.gl, Math.max(32, clampedLon * 4), clampedLon);
      this.twirlMesh = newTwirl;
      for (const simObject of this.simObjects) {
        if (simObject.type === 'twirl') {
          simObject.mesh = newTwirl;
        }
      }
      if (oldTwirl) {
        Assets.disposeTwirlMesh(this.gl, oldTwirl);
      }
    }

    this.notifySimChange();
  }

  getShadingIntensity(): number {
    const selected = this.getSelectedSimObject();
    if (selected && selected.type !== 'twirling-axis') {
      return selected.shadingIntensity;
    }
    return this.shadingIntensity;
  }

  setShadingIntensity(intensity: number): void {
    const clamped = clamp(intensity, 0, 1);
    const selected = this.getSelectedSimObject();
    if (selected && selected.type !== 'twirling-axis') {
      if (selected.shadingIntensity === clamped) {
        return;
      }
      selected.shadingIntensity = clamped;
      this.notifySimChange();
    } else if (this.shadingIntensity !== clamped) {
      this.shadingIntensity = clamped;
      this.notifySimChange();
    }
  }

}
