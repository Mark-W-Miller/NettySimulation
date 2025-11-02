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
  type Twirl8Mesh,
  type Twirl8Program,
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
  type RgpXYObjectDefinition,
  type DexelObjectDefinition,
  type Twirl8ObjectDefinition,
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
const DEFAULT_TWIRLING_AXIS_SCRIPT = '+X90 -Y90 +Z90 -X90 +Y90 -Z90';
const SCRIPT_PRESETS: Array<{ label: string; script: string }> = [
  { label: 'Default (+X90 -Y90 +Z90 ...)', script: DEFAULT_TWIRLING_AXIS_SCRIPT },
  { label: 'Gentle Spiral (+X45 +Y45 ...)', script: '+X45 +Y45 +Z45 -X45 -Y45 -Z45' },
  { label: 'Half-Turn Loop (+X90 +X90 ...)', script: '+X90 +X90 -Y180 +Z90 +Z90 -X180' },
  { label: 'Lopsided Flower (+Y120 ...)', script: '+Y120 -Z60 +X120 -Y60 +Z120 -X60' },
  { label: 'Clover Flip (+Z180 ...)', script: '+Z180 +X90 +Z180 -X90' },
  { label: 'Variable Sweep (+X30 ...)', script: '+X30 +Y60 +Z90 -X120 -Y60 -Z30' },
];

const RGP_SPHERE_COLOR = new Float32Array([0.42, 0.68, 0.93]);
const RGP_SPHERE_OPACITY = 0.12;

const RGP_PRIMARY_CONFIG = {
  shellScale: 20 / 24,
  speedPerTick: 1,
  direction: 1 as 1 | -1,
  plane: 'GB' as const,
  baseColor: 'white' as BaseColor,
  shadingIntensity: 0.35,
  opacity: 1,
  beltHalfAngle: 0.18,
  pulseSpeed: 0.75,
  initialRotationY: Math.PI / 6,
  initialPulsePhase: 0.5,
  initialPulseScale: 0.25,
  invertPulse: true,
};

const RGP_SECONDARY_CONFIG = {
  shellScale: 28 / 24,
  speedPerTick: 0.9,
  direction: 1 as 1 | -1,
  plane: 'YG' as const,
  baseColor: 'red' as BaseColor,
  shadingIntensity: 0.45,
  opacity: 1,
  beltHalfAngle: 0.22,
  pulseSpeed: 0.75,
  initialRotationY: Math.PI / 6,
  initialPulsePhase: 0.5,
  initialPulseScale: 1,
  invertPulse: false,
};

const DEXEL_PRIMARY_RATIO = 1;
const DEXEL_SECONDARY_RATIO = 0.9;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

interface RotationStep {
  axis: 'x' | 'y' | 'z';
  direction: 1 | -1;
  angleDeg: number;
}

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
  size: number;
  opacity: number;
  rotationScript: RotationStep[];
  rotationScriptSource: string;
  scriptIndex: number;
  beatAccumulator: number;
  currentDirection: 1 | -1;
}

interface RgpRingConfig {
  shellScale: number;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  baseColor: BaseColor;
  shadingIntensity: number;
  opacity: number;
  beltHalfAngle: number;
  pulseSpeed: number;
  initialRotationY: number;
  initialPulsePhase: number;
  initialPulseScale: number;
  invertPulse: boolean;
}

interface RgpRingState {
  rotationY: number;
  speedPerTick: number;
  direction: 1 | -1;
  plane: 'YG' | 'GB' | 'YB';
  shellScale: number;
  baseColor: BaseColor;
  shadingIntensity: number;
  opacity: number;
  beltHalfAngle: number;
  pulseSpeed: number;
  pulsePhase: number;
  pulseScale: number;
  invertPulse: boolean;
}

interface RgpXYObject {
  type: 'rgpXY';
  id: string;
  mesh: TwirlMesh;
  size: number;
  visible: boolean;
  speedPerTick: number;
  direction: 1 | -1;
  primary: RgpRingState;
  secondary: RgpRingState;
  sphereColor: Float32Array;
  sphereOpacity: number;
}

interface DexelObject {
  type: 'dexel';
  id: string;
  mesh: TwirlMesh;
  anchorId: string | null;
  axis: 'x' | 'y' | 'z';
  sign: 1 | -1;
  size: number;
  speedPerTick: number;
  direction: 1 | -1;
  visible: boolean;
  position: Float32Array;
  primary: RgpRingState;
  secondary: RgpRingState;
  primarySpeedRatio: number;
  secondarySpeedRatio: number;
}

interface Dexel {
  axis: 'x' | 'y' | 'z';
  sign: 1 | -1;
  position: Float32Array;
  mesh: TwirlMesh;
  size: number;
  primary: RgpRingState;
  secondary: RgpRingState;
  sourceId: string;
}

interface Twirl8Object {
  type: 'twirl8';
  id: string;
  axis: 'x' | 'y' | 'z';
  radius: number;
  color: BaseColor;
  opacity: number;
  visible: boolean;
  width: number;
  lobeAngle: number;
  rotationY: number;
  speedPerTick: number;
  direction: 1 | -1;
  thickness: number;
}

type SimObject = SphereObject | TwirlObject | TwirlingAxisObject | RgpXYObject | DexelObject | Twirl8Object;

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
  size: number;
  beltHalfAngle: number;
  pulseSpeed: number;
  sphereOpacity: number;
  twirl8Width: number;
  twirl8AngleDeg: number;
  twirl8Thickness: number;
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
  private twirl8Program: Twirl8Program | null = null;
  private twirl8Mesh: Twirl8Mesh | null = null;
  private axes: AxisSet | null = null;
  private rotatedAxes: AxisSet | null = null;
  private axisVisibility: Record<'x' | 'y' | 'z', boolean> = { x: true, y: true, z: true };
  private showSecondaryAxes = false;
  private axisOpacitySlider = 1;
  private axisRadiusScale = 1;
  private sphereSegments = { lat: 48, lon: 48 };
  private shadingIntensity = 0.4;
  private ghostParticles: GhostParticle[] = [];
  private dexels: Dexel[] = [];
  private dexelLastSign: Record<'x' | 'y' | 'z', 1 | -1> = { x: 1, y: 1, z: 1 };

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
          visible: false,
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
          visible: false,
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
          type: 'rgpXY',
          id: 'rgp-xy',
          size: 24,
          visible: true,
        },
        {
          type: 'twirling-axis',
          id: 'formation-axis',
          speedPerTick: 10,
          direction: 1,
          visible: false,
          size: 1,
          initialRotationY: 0,
          initialRotationZ: 0,
          opacity: 1,
        },
        {
          type: 'dexel',
          id: 'dexel-template',
          axis: 'x',
          sign: 1,
          size: 24,
          speedPerTick: 1,
          direction: 1,
          visible: false,
          anchorId: 'rgp-xy',
        },
      ],
    },
    {
      id: 'RGP_Pray',
      name: 'RGP_Pray',
      objects: [
        {
          type: 'twirl8',
          id: 'twirl-8-y',
          axis: 'y',
          radius: 24,
          color: 'white',
          width: 1,
          lobeRotationDeg: 20,
          thickness: 0.15,
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

  private buildTwirl8ModelMatrix(axis: 'x' | 'y' | 'z', radius: number, spin: number): Float32Array {
    const norm = Math.max(0.01, radius / this.defaultShellSize);
    let rotation = this.identityModelMatrix;
    switch (axis) {
      case 'x':
        rotation = mat4FromYRotation(-Math.PI / 2);
        break;
      case 'y':
        rotation = mat4FromXRotation(Math.PI / 2);
        break;
      case 'z':
        rotation = this.identityModelMatrix;
        break;
    }
    const scale = mat4Scale(norm, norm, norm);
    const oriented = mat4Multiply(rotation, scale);

    if (Math.abs(spin) < 1e-6) {
      return oriented;
    }

    let axialRotation = this.identityModelMatrix;
    switch (axis) {
      case 'x':
        axialRotation = mat4FromXRotation(spin);
        break;
      case 'y':
        axialRotation = mat4FromYRotation(spin);
        break;
      case 'z':
        axialRotation = mat4FromZRotation(spin);
        break;
    }

    return mat4Multiply(axialRotation, oriented);
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
    const twirl8Program = Assets.createTwirl8Program(gl);
    const sphere = Assets.createSphereMesh(gl, this.sphereSegments.lat, this.sphereSegments.lon);
    const twirl8 = Assets.createTwirl8MeshSolid(gl);
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
    this.twirl8Program = twirl8Program;
    this.sphereMesh = sphere;
    this.twirl8Mesh = twirl8;
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

    if (this.gl && this.twirl8Mesh) {
      Assets.disposeTwirl8Mesh(this.gl, this.twirl8Mesh);
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

    if (this.gl && this.twirl8Program) {
      Assets.disposeTwirl8Program(this.gl, this.twirl8Program);
    }

    this.canvas = null;
    this.gl = null;
    this.sphereProgram = null;
    this.axisProgram = null;
    this.twirlProgram = null;
    this.twirl8Program = null;
    this.sphereMesh = null;
    this.twirlMesh = null;
    this.twirl8Mesh = null;
    this.twirlingAxisMesh = null;
    this.axes = null;
    this.rotatedAxes = null;
    this.ghostParticles = [];
    this.dexels = [];
    this.dexelLastSign = { x: 1, y: 1, z: 1 };
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
    const rgpQueue: RgpXYObject[] = [];
    const dexelQueue: DexelObject[] = [];
    const twirl8Queue: Twirl8Object[] = [];

    for (const simObject of this.simObjects) {
      if (!simObject.visible) {
        continue;
      }

      if (simObject.type === 'twirling-axis') {
        if (beats > 0) {
          this.advanceTwirlingAxis(simObject, beats);
        }
        twirlingAxisQueue.push(simObject);
        continue;
      }

      if (simObject.type === 'dexel') {
        dexelQueue.push(simObject);
        continue;
      }

      if (simObject.type === 'twirl8') {
        if (beats > 0) {
          simObject.rotationY += beats * this.rotationPerBeat * simObject.speedPerTick * simObject.direction;
        }
        twirl8Queue.push(simObject);
        continue;
      }

      if (simObject.type === 'rgpXY') {
        if (beats > 0) {
          const rotationDeltaPrimary = beats * this.rotationPerBeat * simObject.primary.speedPerTick * simObject.primary.direction;
          const rotationDeltaSecondary = beats * this.rotationPerBeat * simObject.secondary.speedPerTick * simObject.secondary.direction;
          simObject.primary.rotationY += rotationDeltaPrimary;
          simObject.secondary.rotationY += rotationDeltaSecondary;
        }

        if (this.simRunning) {
          this.updateRgpPulse(simObject.primary, deltaSeconds);
          this.updateRgpPulse(simObject.secondary, deltaSeconds);
        }

        rgpQueue.push(simObject);
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

    if (beats > 0) {
      const rotationStep = beats * this.rotationPerBeat;
      if (this.dexels.length > 0) {
        for (const dexel of this.dexels) {
          dexel.primary.rotationY += rotationStep * dexel.primary.speedPerTick * dexel.primary.direction;
          dexel.secondary.rotationY += rotationStep * dexel.secondary.speedPerTick * dexel.secondary.direction;
        }
      }
      if (dexelQueue.length > 0) {
        for (const dexel of dexelQueue) {
          dexel.primary.rotationY += rotationStep * dexel.primary.speedPerTick * dexel.direction;
          dexel.secondary.rotationY += rotationStep * dexel.secondary.speedPerTick * dexel.direction;
        }
      }
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

    for (const rgpObject of rgpQueue) {
      this.drawRgpSphere(gl, sphereProgram, rgpObject);
    }

    const patternRepeats = Math.max(1, this.sphereSegments.lon / 2);
    const hasTwirlContent = twirlQueue.length > 0 || rgpQueue.length > 0 || this.dexels.length > 0 || dexelQueue.length > 0;

    if (hasTwirlContent) {
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
          patternRepeats,
          patternOffset: ((twirlObject.rotationY / (Math.PI * 2)) % 1 + 1) % 1,
          opacityIntensity: twirlObject.opacity,
          clipEnabled: false,
          clipCenter: this.originVector,
          clipRadius: 0,
        });
      }

      for (const rgpObject of rgpQueue) {
        this.drawRgpRing(gl, twirlProgram, rgpObject.mesh, rgpObject.size, rgpObject.secondary, patternRepeats);
        this.drawRgpRing(gl, twirlProgram, rgpObject.mesh, rgpObject.size, rgpObject.primary, patternRepeats);
      }

      if (dexelQueue.length > 0) {
        this.drawDexelCollection(gl, twirlProgram, patternRepeats, dexelQueue);
      }

      this.drawDexelCollection(gl, twirlProgram, patternRepeats, this.dexels);

      gl.disable(gl.BLEND);

      // Restore sphere program for axis rendering.
      Assets.useSphereProgram(gl, sphereProgram);
      Assets.setSphereSharedUniforms(gl, sphereProgram, sharedUniforms);
    }

    this.drawGhostParticles(gl, sphereProgram);

    if (twirl8Queue.length > 0 && this.twirl8Program && this.twirl8Mesh) {
      Assets.useTwirl8Program(gl, this.twirl8Program);
      Assets.setTwirl8SharedUniforms(gl, this.twirl8Program, {
        viewMatrix: this.viewMatrix,
        projectionMatrix: this.projectionMatrix,
      });
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      for (const ring of twirl8Queue) {
        const normalizedRotation = ((ring.rotationY / (Math.PI * 2)) % 1 + 1) % 1;
        const pulse =
          normalizedRotation < 0.5
            ? normalizedRotation * 2
            : (1 - normalizedRotation) * 2;
        const radiusFactor = Math.max(0.05, pulse);
        const widthFactor = 0.15 + 0.85 * pulse;
        const lobeFactor = 0.25 + 0.75 * pulse;

        const effectiveRadius = Math.max(0.01, ring.radius * radiusFactor);
        const modelMatrix = this.buildTwirl8ModelMatrix(ring.axis, effectiveRadius, ring.rotationY);
        const colorVec = this.getBaseColorVector(ring.color, ring.opacity);
        const effectiveWidth = Math.max(0.05, ring.width * widthFactor);
        const effectiveThickness = Math.max(0.01, ring.thickness * widthFactor);
        const dynamicLobeAngle = ring.lobeAngle * lobeFactor;
        Assets.drawTwirl8(gl, this.twirl8Program, this.twirl8Mesh, {
          modelMatrix,
          color: colorVec,
        });
      }

      gl.disable(gl.BLEND);
      Assets.useSphereProgram(gl, sphereProgram);
      Assets.setSphereSharedUniforms(gl, sphereProgram, sharedUniforms);
    }

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
      } else if (objectDef.type === 'rgpXY') {
        const mesh = this.ensureTwirlMesh();
        const primary = this.createRgpRingState(RGP_PRIMARY_CONFIG);
        const secondary = this.createRgpRingState(RGP_SECONDARY_CONFIG);
        this.simObjects.push({
          type: 'rgpXY',
          id: objectDef.id,
          mesh,
          size: Math.max(0.1, objectDef.size),
          visible: objectDef.visible ?? true,
          speedPerTick: 1,
          direction: 1,
          primary,
          secondary,
          sphereColor: new Float32Array(RGP_SPHERE_COLOR),
          sphereOpacity: RGP_SPHERE_OPACITY,
        });
      } else if (objectDef.type === 'dexel') {
        const mesh = this.ensureTwirlMesh();
        const baseSpeed = objectDef.speedPerTick ?? 1;
        const direction = objectDef.direction ?? 1;
        const primarySpeedRatio = objectDef.primarySpeedRatio ?? DEXEL_PRIMARY_RATIO;
        const secondarySpeedRatio = objectDef.secondarySpeedRatio ?? DEXEL_SECONDARY_RATIO;

        const primary = this.createRgpRingState({
          ...RGP_PRIMARY_CONFIG,
          speedPerTick: baseSpeed * primarySpeedRatio,
          direction,
          initialRotationY: 0,
          initialPulsePhase: 0,
          initialPulseScale: 1,
          pulseSpeed: 0,
          invertPulse: RGP_PRIMARY_CONFIG.invertPulse,
        });
        const secondary = this.createRgpRingState({
          ...RGP_SECONDARY_CONFIG,
          speedPerTick: baseSpeed * secondarySpeedRatio,
          direction,
          initialRotationY: 0,
          initialPulsePhase: 0,
          initialPulseScale: 1,
          pulseSpeed: 0,
          invertPulse: RGP_SECONDARY_CONFIG.invertPulse,
        });

        primary.pulseScale = 1;
        primary.pulsePhase = 0;
        primary.pulseSpeed = 0;
        primary.rotationY = 0;
        secondary.pulseScale = 1;
        secondary.pulsePhase = 0;
        secondary.pulseSpeed = 0;
        secondary.rotationY = 0;

        const dexelObject: DexelObject = {
          type: 'dexel',
          id: objectDef.id,
          mesh,
          anchorId: objectDef.anchorId ?? null,
          axis: objectDef.axis,
          sign: objectDef.sign,
          size: Math.max(0.1, objectDef.size),
          speedPerTick: Math.max(0.1, baseSpeed),
          direction: direction >= 0 ? 1 : -1,
          visible: objectDef.visible ?? false,
          position: new Float32Array([0, 0, 0]),
          primary,
          secondary,
          primarySpeedRatio,
          secondarySpeedRatio,
        };

        this.syncDexelRingSpeeds(dexelObject);
        this.simObjects.push(dexelObject);
        this.updateDexelAssetPosition(dexelObject);
      } else if (objectDef.type === 'twirl8') {
        const def = objectDef as Twirl8ObjectDefinition;
        const width = Math.max(0.1, def.width ?? 1);
        const lobeAngle = (def.lobeRotationDeg ?? 20) * DEG_TO_RAD;
        const thickness = Math.max(0.01, def.thickness ?? 0.1);
        this.simObjects.push({
          type: 'twirl8',
          id: def.id,
          axis: def.axis,
          radius: Math.max(0.01, def.radius),
          color: def.color,
          opacity: clamp(def.opacity ?? 1, 0, 1),
          visible: def.visible ?? true,
          width,
          lobeAngle,
          thickness,
          rotationY: (def.initialRotationDeg ?? 0) * DEG_TO_RAD,
          speedPerTick: Math.max(0.1, def.speedPerTick ?? 1),
          direction: def.direction ?? 1,
        });
      } else if (objectDef.type === 'twirling-axis') {
        const mesh = this.ensureTwirlingAxisMesh();
        const scriptSource = objectDef.rotationScript ?? DEFAULT_TWIRLING_AXIS_SCRIPT;
        const { steps, normalized } = this.safeParseRotationScript(scriptSource);
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
          size: Math.max(0.01, objectDef.size ?? 1),
          opacity: clamp(objectDef.opacity ?? 1, 0, 1),
          rotationScript: steps,
          rotationScriptSource: normalized,
          scriptIndex: 0,
          beatAccumulator: 0,
          currentDirection: objectDef.direction >= 0 ? 1 : -1,
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

    for (const simObject of this.simObjects) {
      if (simObject.type === 'dexel') {
        this.updateDexelAssetPosition(simObject);
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
    this.dexels = [];
    this.dexelLastSign = { x: 1, y: 1, z: 1 };
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
      const nextSpeed = Math.max(0.1, update.speedPerTick);
      switch (selected.type) {
        case 'sphere':
        case 'twirl':
        case 'twirling-axis':
        case 'twirl8':
          selected.speedPerTick = nextSpeed;
          break;
        case 'dexel':
          selected.speedPerTick = nextSpeed;
          this.syncDexelRingSpeeds(selected);
          break;
        default:
          break;
      }
    }

    if (update.direction !== undefined) {
      const nextDirection = update.direction >= 0 ? 1 : -1;
      switch (selected.type) {
        case 'sphere':
        case 'twirl':
        case 'twirling-axis':
        case 'twirl8':
          selected.direction = nextDirection;
          break;
        case 'dexel':
          selected.direction = nextDirection;
          selected.primary.direction = nextDirection;
          selected.secondary.direction = nextDirection;
          break;
        default:
          break;
      }
    }

    if (typeof update.visible === 'boolean') {
      selected.visible = update.visible;
      if (!selected.visible && selected.type === 'twirling-axis') {
        this.ghostParticles = [];
      }
    }

    if (typeof update.opacity === 'number' && Number.isFinite(update.opacity)) {
      const clampedOpacity = clamp(update.opacity, 0, 1);
      switch (selected.type) {
        case 'twirling-axis':
        case 'sphere':
        case 'twirl':
        case 'twirl8':
          selected.opacity = clampedOpacity;
          break;
        default:
          break;
      }
    }

    if (selected.type === 'twirling-axis') {
      if (typeof update.size === 'number' && Number.isFinite(update.size)) {
        selected.size = Math.max(0.01, update.size);
      }
    } else if (selected.type === 'rgpXY') {
      let sizeChanged = false;
      if (typeof update.size === 'number' && Number.isFinite(update.size)) {
        const nextSize = Math.max(0.1, update.size);
        if (selected.size !== nextSize) {
          selected.size = nextSize;
          sizeChanged = true;
        }
      }
      if (typeof update.sphereOpacity === 'number' && Number.isFinite(update.sphereOpacity)) {
        selected.sphereOpacity = clamp(update.sphereOpacity, 0, 1);
      }
      if (sizeChanged) {
        this.updateDexelAnchorsForRgp(selected);
      }
    } else if (selected.type === 'dexel') {
      let sizeChanged = false;
      if (typeof update.size === 'number' && Number.isFinite(update.size)) {
        const nextSize = Math.max(0.1, update.size);
        if (selected.size !== nextSize) {
          selected.size = nextSize;
          sizeChanged = true;
        }
      }
      if (sizeChanged) {
        this.updateDexelAssetPosition(selected);
      }
    } else if (selected.type === 'twirl8') {
      if (typeof update.twirl8Width === 'number' && Number.isFinite(update.twirl8Width)) {
        selected.width = Math.max(0.1, update.twirl8Width);
      }
      if (typeof update.twirl8AngleDeg === 'number' && Number.isFinite(update.twirl8AngleDeg)) {
        selected.lobeAngle = update.twirl8AngleDeg * DEG_TO_RAD;
      }
      if (typeof update.twirl8Thickness === 'number' && Number.isFinite(update.twirl8Thickness)) {
        selected.thickness = Math.max(0.01, update.twirl8Thickness);
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

  updateRgpRingProperties(
    objectId: string,
    ring: 'primary' | 'secondary',
    updates: Partial<{ opacity: number; shadingIntensity: number }>,
  ): void {
    const target = this.simObjects.find((object) => object.id === objectId);
    if (!target || target.type !== 'rgpXY') {
      return;
    }

    const ringState = ring === 'primary' ? target.primary : target.secondary;
    let changed = false;

    if (typeof updates.opacity === 'number' && Number.isFinite(updates.opacity)) {
      const clampedOpacity = clamp(updates.opacity, 0, 1);
      if (ringState.opacity !== clampedOpacity) {
        ringState.opacity = clampedOpacity;
        changed = true;
      }
    }

    if (typeof updates.shadingIntensity === 'number' && Number.isFinite(updates.shadingIntensity)) {
      const clampedShading = clamp(updates.shadingIntensity, 0, 1);
      if (ringState.shadingIntensity !== clampedShading) {
        ringState.shadingIntensity = clampedShading;
        changed = true;
      }
    }

    if (changed) {
      this.updateDexelAnchorsForRgp(target);
      this.notifySimChange();
    }
  }

  private notifySimChange(): void {
    for (const listener of this.simListeners) {
      listener();
    }
  }

  private computeModelMatrices(simObject: SphereObject | TwirlObject): {
    modelMatrix: Float32Array;
    normalMatrix: Float32Array;
  } {
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
    if (simObject.rotationY !== 0) {
      rotationMatrix = mat4Multiply(rotationMatrix, mat4FromYRotation(simObject.rotationY));
    }
    if (simObject.rotationZ !== 0) {
      rotationMatrix = mat4Multiply(rotationMatrix, mat4FromZRotation(simObject.rotationZ));
    }
    if (simObject.rotationX !== 0) {
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

  private getPlaneNormal(plane: 'YG' | 'GB' | 'YB'): Float32Array {
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

  private parseRotationScript(source: string): { steps: RotationStep[]; normalized: string } {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new Error('Rotation script is empty');
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      throw new Error('Rotation script is empty');
    }

    const steps: RotationStep[] = [];
    const normalizedTokens: string[] = [];

    for (const token of tokens) {
      const match = token.match(/^([+-])([XYZxyz])(\d+)$/);
      if (!match) {
        throw new Error(`Invalid token: ${token}`);
      }
      const [, sign, axisChar, angleStr] = match;
      const angleDeg = Number.parseInt(angleStr, 10);
      if (!Number.isFinite(angleDeg) || angleDeg <= 0) {
        throw new Error(`Invalid angle in token: ${token}`);
      }

      const axis = axisChar.toLowerCase() as RotationStep['axis'];
      const direction = sign === '+' ? 1 : -1;
      steps.push({ axis, direction, angleDeg });
      normalizedTokens.push(`${sign}${axisChar.toUpperCase()}${angleDeg}`);
    }

    return {
      steps,
      normalized: normalizedTokens.join(' '),
    };
  }

  private safeParseRotationScript(source: string): { steps: RotationStep[]; normalized: string } {
    try {
      return this.parseRotationScript(source);
    } catch (error) {
      return this.parseRotationScript(DEFAULT_TWIRLING_AXIS_SCRIPT);
    }
  }

  private advanceTwirlingAxis(simObject: TwirlingAxisObject, beats: number): void {
    if (!this.simRunning || beats <= 0) {
      return;
    }

    if (simObject.rotationScript.length === 0) {
      return;
    }

    const speedMultiplier = Math.max(0.01, Math.abs(simObject.speedPerTick));
    simObject.beatAccumulator += beats * speedMultiplier;
    while (simObject.beatAccumulator >= 1) {
      simObject.beatAccumulator -= 1;

      const step = simObject.rotationScript[simObject.scriptIndex];
      if (!step) {
        break;
      }

      const angleRad = (step.angleDeg * Math.PI) / 180;
      const rotationSign = (simObject.direction >= 0 ? 1 : -1) * (simObject.speedPerTick >= 0 ? 1 : -1) * simObject.currentDirection;
      const delta = angleRad * step.direction * rotationSign;

      switch (step.axis) {
        case 'x':
          simObject.rotationX += delta;
          break;
        case 'y':
          simObject.rotationY += delta;
          break;
        case 'z':
          simObject.rotationZ += delta;
          break;
      }

      simObject.scriptIndex = (simObject.scriptIndex + 1) % simObject.rotationScript.length;
      simObject.currentDirection = (simObject.currentDirection === 1 ? -1 : 1);

      this.emitGhostParticlesFromAxis(simObject);
    }
  }

  private emitGhostParticlesFromAxis(simObject: TwirlingAxisObject): void {
    const halfLength = TWIRLING_AXIS_BASE_LENGTH / 2;
    const { modelMatrix } = this.computeTwirlingAxisMatrices(simObject);
    const sizeScale = Math.max(0.01, simObject.size);
    const ballRadius = TWIRLING_AXIS_BASE_RADIUS * TWIRLING_AXIS_BALL_SCALE * sizeScale * 0.5;
    const ghostOpacity = clamp(simObject.opacity * 0.7, 0.05, 1);

    const xTip = this.transformPoint(modelMatrix, [halfLength, 0, 0]);
    const yTip = this.transformPoint(modelMatrix, [0, halfLength, 0]);

    this.addGhostParticle(xTip, AXIS_COLORS.x, ballRadius, ghostOpacity);
    this.addGhostParticle(yTip, AXIS_COLORS.y, ballRadius, ghostOpacity);
  }

  private drawRgpSphere(gl: WebGLRenderingContext, sphereProgram: SphereProgram, rgp: RgpXYObject): void {
    const mesh = this.ensureSphereMesh();
    const primaryRadius = this.getRgpRingRadius(rgp.size, rgp.primary);
    const secondaryRadius = this.getRgpRingRadius(rgp.size, rgp.secondary);
    const scaleFactor = Math.max(primaryRadius, secondaryRadius);
    const modelMatrix = mat4ScaleUniform(scaleFactor);
    const baseColor = new Float32Array([rgp.sphereColor[0], rgp.sphereColor[1], rgp.sphereColor[2], clamp(rgp.sphereOpacity, 0, 1)]);

    const wasBlending = gl.isEnabled(gl.BLEND);
    const previousDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;

    if (!wasBlending) {
      gl.enable(gl.BLEND);
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    Assets.drawSphere(gl, sphereProgram, mesh, {
      modelMatrix,
      normalMatrix: this.identityNormalMatrix,
      shadingIntensity: 0,
      planeVector: this.originVector,
      baseColor,
      vertexColorWeight: 0,
      opacityIntensity: rgp.sphereOpacity,
    });

    gl.depthMask(previousDepthMask);
    if (!wasBlending) {
      gl.disable(gl.BLEND);
    }
  }

  private createRgpRingState(config: RgpRingConfig): RgpRingState {
    return {
      rotationY: config.initialRotationY,
      speedPerTick: config.speedPerTick,
      direction: config.direction,
      plane: config.plane,
      shellScale: config.shellScale,
      baseColor: config.baseColor,
      shadingIntensity: config.shadingIntensity,
      opacity: config.opacity,
      beltHalfAngle: config.beltHalfAngle,
      pulseSpeed: config.pulseSpeed,
      pulsePhase: config.initialPulsePhase,
      pulseScale: config.initialPulseScale,
      invertPulse: config.invertPulse,
    };
  }

  private cloneRgpRingState(source: RgpRingState): RgpRingState {
    return {
      rotationY: source.rotationY,
      speedPerTick: source.speedPerTick,
      direction: source.direction,
      plane: source.plane,
      shellScale: source.shellScale,
      baseColor: source.baseColor,
      shadingIntensity: source.shadingIntensity,
      opacity: source.opacity,
      beltHalfAngle: source.beltHalfAngle,
      pulseSpeed: source.pulseSpeed,
      pulsePhase: source.pulsePhase,
      pulseScale: source.pulseScale,
      invertPulse: source.invertPulse,
    };
  }

  private updateRgpPulse(ring: RgpRingState, deltaSeconds: number): void {
    ring.pulsePhase = (ring.pulsePhase + deltaSeconds * ring.pulseSpeed * 0.25) % 1;
    const triangle = ring.pulsePhase < 0.5 ? ring.pulsePhase * 2 : (1 - (ring.pulsePhase - 0.5) * 2);
    const baseTriangle = ring.invertPulse ? 1 - triangle : triangle;
    ring.pulseScale = 0.25 + 0.75 * baseTriangle;
  }

  private drawRgpRing(
    gl: WebGLRenderingContext,
    twirlProgram: TwirlProgram,
    mesh: TwirlMesh,
    size: number,
    ring: RgpRingState,
    patternRepeats: number,
    position?: Float32Array,
  ): void {
    const shellSize = Math.max(1, size * ring.shellScale);
    const { modelMatrix, normalMatrix } = this.buildTwirlMatrices(
      ring.plane,
      ring.rotationY,
      shellSize,
      ring.pulseScale,
      ring.beltHalfAngle,
    );

    const baseColor = this.getBaseColorVector(ring.baseColor, ring.opacity);
    const patternOffset = ((ring.rotationY / (Math.PI * 2)) % 1 + 1) % 1;

    const finalModelMatrix = position
      ? mat4Multiply(this.translationMatrix(position), modelMatrix)
      : modelMatrix;

    Assets.drawTwirl(gl, twirlProgram, mesh, {
      modelMatrix: finalModelMatrix,
      normalMatrix,
      baseColor,
      planeVector: this.getPlaneNormal(ring.plane),
      shadingIntensity: ring.shadingIntensity,
      beltHalfAngle: ring.beltHalfAngle,
      pulseScale: ring.pulseScale,
      patternRepeats,
      patternOffset,
      opacityIntensity: ring.opacity,
      clipEnabled: false,
      clipCenter: this.originVector,
      clipRadius: 0,
    });
  }

  private getRgpRingRadius(size: number, ring: RgpRingState, pulseScaleOverride?: number): number {
    const shellSize = Math.max(1, size * ring.shellScale);
    const pulseScale = Math.max(pulseScaleOverride ?? ring.pulseScale, 0.01);
    return Math.max(0.05, (shellSize / this.defaultShellSize) * pulseScale);
  }

  private buildTwirlMatrices(
    plane: 'YG' | 'GB' | 'YB',
    rotationY: number,
    shellSize: number,
    pulseScale: number,
    beltHalfAngle: number,
  ): { modelMatrix: Float32Array; normalMatrix: Float32Array } {
    let rotationMatrix: Float32Array;
    let alignmentMatrix: Float32Array;

    switch (plane) {
      case 'GB':
        rotationMatrix = mat4FromYRotation(rotationY);
        alignmentMatrix = this.identityModelMatrix;
        break;
      case 'YG':
        rotationMatrix = mat4FromZRotation(rotationY);
        alignmentMatrix = this.alignYAxisToZMatrix;
        break;
      case 'YB':
        rotationMatrix = mat4FromXRotation(rotationY);
        alignmentMatrix = this.alignYAxisToXMatrix;
        break;
      default:
        rotationMatrix = mat4FromYRotation(rotationY);
        alignmentMatrix = this.identityModelMatrix;
        break;
    }

    const rotationAndAlignment = mat4Multiply(rotationMatrix, alignmentMatrix);
    const radiusScale = Math.max(0.05, (shellSize / this.defaultShellSize) * pulseScale);
    const heightScale = Math.max(0.01, Math.sin(beltHalfAngle));
    const scaleMatrix = mat4Scale(Math.max(radiusScale, 0.01), Math.max(heightScale, 0.005), Math.max(radiusScale, 0.01));
    const modelMatrix = mat4Multiply(rotationAndAlignment, scaleMatrix);

    return {
      modelMatrix,
      normalMatrix: mat3FromMat4(rotationAndAlignment),
    };
  }

  private drawGhostParticles(gl: WebGLRenderingContext, sphereProgram: SphereProgram): void {
    if (this.ghostParticles.length === 0) {
      return;
    }

    const mesh = this.ensureSphereMesh();
    const planeVector = new Float32Array([0, 0, 0]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (const ghost of this.ghostParticles) {
      const modelMatrix = this.makeTranslationScaleMatrix(ghost.position, ghost.radius);
      const baseColor = new Float32Array([ghost.color[0], ghost.color[1], ghost.color[2], ghost.opacity]);

      Assets.drawSphere(gl, sphereProgram, mesh, {
        modelMatrix,
        normalMatrix: this.identityNormalMatrix,
        shadingIntensity: 0,
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

  private translationMatrix(position: Float32Array): Float32Array {
    const translation = mat4Identity();
    translation[12] = position[0];
    translation[13] = position[1];
    translation[14] = position[2];
    return translation;
  }

  private drawDexelCollection(
    gl: WebGLRenderingContext,
    twirlProgram: TwirlProgram,
    patternRepeats: number,
    dexels: ReadonlyArray<{
      position: Float32Array;
      mesh: TwirlMesh;
      size: number;
      primary: RgpRingState;
      secondary: RgpRingState;
    }>,
  ): void {
    if (dexels.length === 0) {
      return;
    }

    for (const dexel of dexels) {
      this.drawRgpRing(gl, twirlProgram, dexel.mesh, dexel.size, dexel.secondary, patternRepeats, dexel.position);
      this.drawRgpRing(gl, twirlProgram, dexel.mesh, dexel.size, dexel.primary, patternRepeats, dexel.position);
    }
  }

  spawnDexelForSelectedRgp(): void {
    const selected = this.getSelectedSimObject();
    if (!selected || selected.type !== 'rgpXY') {
      return;
    }
    this.spawnDexelForRgp(selected);
  }

  private spawnDexelForRgp(rgp: RgpXYObject): void {
    const dominant = rgp.primary.pulseScale >= rgp.secondary.pulseScale ? rgp.primary : rgp.secondary;
    const axis = this.planeToAxis(dominant.plane);
    const sign = this.dexelLastSign[axis];
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

    const existing = this.dexels.some((dexel) => dexel.axis === axis && dexel.sign === sign && dexel.sourceId === rgp.id);
    if (existing) {
      return;
    }

    this.dexelLastSign[axis] = sign === 1 ? -1 : 1;

    const primary = this.cloneRgpRingState(rgp.primary);
    const secondary = this.cloneRgpRingState(rgp.secondary);

    primary.pulseScale = 1;
    primary.pulsePhase = 0;
    primary.pulseSpeed = 0;
    secondary.pulseScale = 1;
    secondary.pulsePhase = 0;
    secondary.pulseSpeed = 0;

    const maxRgpRadius = Math.max(
      this.getRgpRingRadius(rgp.size, rgp.primary, 1),
      this.getRgpRingRadius(rgp.size, rgp.secondary, 1),
    );
    const maxDexelRadius = Math.max(
      this.getRgpRingRadius(rgp.size, primary, 1),
      this.getRgpRingRadius(rgp.size, secondary, 1),
    );
    const distance = maxRgpRadius + maxDexelRadius;

    const position = new Float32Array([0, 0, 0]);
    position[axisIndex] = sign * distance;

    this.dexels.push({
      axis,
      sign,
      position,
      mesh: rgp.mesh,
      primary,
      secondary,
      size: rgp.size,
      sourceId: rgp.id,
    });

    this.updateDexelAnchorsForRgp(rgp);
    this.notifySimChange();
  }

  private updateDexelAnchorsForRgp(rgp: RgpXYObject): void {
    if (this.dexels.length === 0) {
      // Continue to update anchored assets if needed.
    }

    const maxRgpRadius = Math.max(
      this.getRgpRingRadius(rgp.size, rgp.primary, 1),
      this.getRgpRingRadius(rgp.size, rgp.secondary, 1),
    );

    for (const dexel of this.dexels) {
      if (dexel.sourceId !== rgp.id) {
        continue;
      }

      dexel.size = rgp.size;
      const maxDexelRadius = Math.max(
        this.getRgpRingRadius(dexel.size, dexel.primary, 1),
        this.getRgpRingRadius(dexel.size, dexel.secondary, 1),
      );
      const distance = maxRgpRadius + maxDexelRadius;
      const axisIndex = dexel.axis === 'x' ? 0 : dexel.axis === 'y' ? 1 : 2;
      dexel.position[0] = 0;
      dexel.position[1] = 0;
      dexel.position[2] = 0;
      dexel.position[axisIndex] = dexel.sign * distance;
    }

    for (const simObject of this.simObjects) {
      if (simObject.type !== 'dexel' || simObject.anchorId !== rgp.id) {
        continue;
      }
      this.updateDexelAssetPosition(simObject, rgp);
    }
  }

  private updateDexelAssetPosition(dexel: DexelObject, anchor?: RgpXYObject | null): void {
    const anchorObject =
      anchor ??
      (dexel.anchorId ? this.simObjects.find((object): object is RgpXYObject => object.type === 'rgpXY' && object.id === dexel.anchorId) ?? null : null);

    const maxDexelRadius = Math.max(
      this.getRgpRingRadius(dexel.size, dexel.primary, 1),
      this.getRgpRingRadius(dexel.size, dexel.secondary, 1),
    );

    let distance = maxDexelRadius;

    if (anchorObject) {
      const maxRgpRadius = Math.max(
        this.getRgpRingRadius(anchorObject.size, anchorObject.primary, 1),
        this.getRgpRingRadius(anchorObject.size, anchorObject.secondary, 1),
      );
      distance += maxRgpRadius;
    }

    const axisIndex = dexel.axis === 'x' ? 0 : dexel.axis === 'y' ? 1 : 2;
    dexel.position[0] = 0;
    dexel.position[1] = 0;
    dexel.position[2] = 0;
    dexel.position[axisIndex] = dexel.sign * distance;
  }

  private syncDexelRingSpeeds(dexel: DexelObject): void {
    const baseSpeed = Math.max(0, dexel.speedPerTick);
    dexel.primary.speedPerTick = baseSpeed * dexel.primarySpeedRatio;
    dexel.secondary.speedPerTick = baseSpeed * dexel.secondarySpeedRatio;
    dexel.primary.direction = dexel.direction;
    dexel.secondary.direction = dexel.direction;
  }

  private planeToAxis(plane: 'YG' | 'GB' | 'YB'): 'x' | 'y' | 'z' {
    switch (plane) {
      case 'GB':
        return 'y';
      case 'YG':
        return 'z';
      case 'YB':
        return 'x';
      default:
        return 'x';
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

  setSelectedTwirlingAxisRotationScript(script: string): boolean {
    const selected = this.getSelectedSimObject();
    if (!selected || selected.type !== 'twirling-axis') {
      return false;
    }

    try {
      const { steps, normalized } = this.parseRotationScript(script);
      selected.rotationScript = steps;
      selected.rotationScriptSource = normalized;
      selected.scriptIndex = 0;
      selected.beatAccumulator = 0;
      selected.currentDirection = 1;
      this.ghostParticles = [];
      this.notifySimChange();
      return true;
    } catch (error) {
      return false;
    }
  }

  getDefaultTwirlingAxisScript(): string {
    return DEFAULT_TWIRLING_AXIS_SCRIPT;
  }

  getTwirlingAxisScriptPresets(): ReadonlyArray<{ label: string; script: string }> {
    return SCRIPT_PRESETS;
  }

  getDefaultRgpSphereOpacity(): number {
    return RGP_SPHERE_OPACITY;
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
        if (simObject.type === 'twirl' || simObject.type === 'rgpXY' || simObject.type === 'dexel') {
          simObject.mesh = newTwirl;
        }
      }
      for (const dexel of this.dexels) {
        dexel.mesh = newTwirl;
      }
      if (oldTwirl) {
        Assets.disposeTwirlMesh(this.gl, oldTwirl);
      }
    }

    this.notifySimChange();
  }

  getShadingIntensity(): number {
    const selected = this.getSelectedSimObject();
    if (selected && (selected.type === 'sphere' || selected.type === 'twirl')) {
      return selected.shadingIntensity;
    }
    return this.shadingIntensity;
  }

  setShadingIntensity(intensity: number): void {
    const clamped = clamp(intensity, 0, 1);
    const selected = this.getSelectedSimObject();
    if (selected && (selected.type === 'sphere' || selected.type === 'twirl')) {
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
