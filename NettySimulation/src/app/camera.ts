// camera.ts — encapsulates camera state, controls, and matrix helpers
import {
  addVec3,
  clamp,
  crossVec3,
  lengthVec3,
  normalizeTuple,
  scaleVec3,
  sphericalToCartesian,
} from './math3d';

type DragMode = 'orbit' | 'pan' | null;
export interface CameraClickInfo {
  x: number;
  y: number;
  container: HTMLDivElement;
}

export interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
  panX: number;
  panY: number;
  panZ: number;
}

interface DragSnapshot {
  x: number;
  y: number;
  azimuth: number;
  elevation: number;
  panX: number;
  panY: number;
  panZ: number;
}

export class CameraController {
  private static readonly AXIS_SNAP_THRESHOLD = Math.cos((8 / 180) * Math.PI);
  private static readonly AXIS_VECTORS: ReadonlyArray<[number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  private readonly state: CameraState = {
    azimuth: Math.PI / 5,
    elevation: Math.PI / 7,
    distance: 4,
    panX: 0,
    panY: 0,
    panZ: 0,
  };

  private dragMode: DragMode = null;
  private activePointerId: number | null = null;
  private lockToOrigin = false;
  private clickCallback: ((info: CameraClickInfo) => void) | null = null;
  private dragStart: DragSnapshot = {
    x: 0,
    y: 0,
    azimuth: 0,
    elevation: 0,
    panX: 0,
    panY: 0,
    panZ: 0,
  };

  constructor(private readonly onChange: () => void = () => {}) {}

  setClickCallback(callback: ((info: CameraClickInfo) => void) | null): void {
    this.clickCallback = callback;
  }

  setLockToOrigin(locked: boolean): void {
    if (this.lockToOrigin === locked) {
      return;
    }
    this.lockToOrigin = locked;
    if (locked) {
      this.state.panX = 0;
      this.state.panY = 0;
      this.state.panZ = 0;
      this.onChange();
    }
  }

  attach(container: HTMLDivElement): () => void {
    const pointerDown = (event: PointerEvent) => {
      if (event.button === 0 && event.detail >= 2 && this.lockToOrigin) {
        if (this.clickCallback) {
          this.clickCallback({ x: event.clientX, y: event.clientY, container });
        }
        return;
      }

      let mode: DragMode = null;

      if (event.button === 0 && event.altKey) {
        mode = 'pan';
      } else if (event.button === 0) {
        mode = 'orbit';
      } else if (event.button === 1 || event.button === 2) {
        mode = 'pan';
      }

      if (this.lockToOrigin && mode === 'pan') {
        mode = null;
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
        azimuth: this.state.azimuth,
        elevation: this.state.elevation,
        panX: this.state.panX,
        panY: this.state.panY,
        panZ: this.state.panZ,
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
        this.state.azimuth = this.dragStart.azimuth - dx * orbitSensitivity;
        const nextElevation = this.dragStart.elevation + dy * elevationSensitivity;
        const clampLimit = Math.PI / 2 - 1e-4;
        this.state.elevation = clamp(nextElevation, -clampLimit, clampLimit);
      } else if (this.dragMode === 'pan') {
        if (this.lockToOrigin) {
          return;
        }
        const panSensitivity = 0.0018 * this.state.distance;
        const basis = getCameraPanBasis(this.dragStart.azimuth, this.dragStart.elevation);

        const deltaRight = dx * panSensitivity;
        const deltaUp = dy * panSensitivity;

        const worldDelta = addVec3(
          scaleVec3(basis.right, deltaRight),
          scaleVec3(basis.up, deltaUp),
        );

        this.state.panX = this.dragStart.panX + worldDelta[0];
        this.state.panY = this.dragStart.panY + worldDelta[1];
        this.state.panZ = this.dragStart.panZ + worldDelta[2];
      }

      this.onChange();
    };

    const pointerUp = (event: PointerEvent) => {
      if (event.pointerId === this.activePointerId) {
        if (this.dragMode === 'orbit' && this.lockToOrigin) {
          const dx = event.clientX - this.dragStart.x;
          const dy = event.clientY - this.dragStart.y;
          const dragMagnitude = Math.max(Math.abs(dx), Math.abs(dy));
          const snapDragThreshold = 6;
          if (dragMagnitude >= snapDragThreshold) {
            const snapped = this.trySnapToAxis(event.clientX, event.clientY, dragMagnitude);
            if (snapped) {
              this.onChange();
            }
          }
        }

        container.releasePointerCapture?.(event.pointerId);
        this.activePointerId = null;
        this.dragMode = null;
        container.classList.remove('is-orbiting', 'is-panning');
      }
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSensitivity = 0.0018;
      const nextDistance = this.state.distance + event.deltaY * zoomSensitivity;
      this.state.distance = clamp(nextDistance, 0.15, 192);
      if (this.lockToOrigin) {
        this.state.panX = 0;
        this.state.panY = 0;
        this.state.panZ = 0;
      }
      this.onChange();
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
      container.classList.remove('is-orbiting', 'is-panning');
      this.dragMode = null;
      this.activePointerId = null;
    };
  }

  getState(): CameraState {
  	return this.state;
  }

  getTarget(): [number, number, number] {
    if (this.lockToOrigin) {
      return [0, 0, 0];
    }
    return [this.state.panX, this.state.panY, this.state.panZ];
  }

  getPosition(): [number, number, number] {
    const target: [number, number, number] = this.lockToOrigin
      ? [0, 0, 0]
      : [this.state.panX, this.state.panY, this.state.panZ];
    return sphericalToCartesian(
      this.state.distance,
      this.state.azimuth,
      this.state.elevation,
      target,
    );
  }

  private trySnapToAxis(pointerX: number, pointerY: number, dragMagnitude: number): boolean {
    if (!this.lockToOrigin) {
      return false;
    }
    const minDragForSnap = 6;
    if (dragMagnitude < minDragForSnap) {
      return false;
    }
    const cameraPos = sphericalToCartesian(1, this.state.azimuth, this.state.elevation, [0, 0, 0]);
    const viewDir = normalizeTuple([-cameraPos[0], -cameraPos[1], -cameraPos[2]]);
    let bestAxis: [number, number, number] | null = null;
    let bestDot = CameraController.AXIS_SNAP_THRESHOLD;
    for (const axis of CameraController.AXIS_VECTORS) {
      const dot = viewDir[0] * axis[0] + viewDir[1] * axis[1] + viewDir[2] * axis[2];
      if (dot >= bestDot) {
        bestAxis = axis;
        bestDot = dot;
      }
    }
    if (!bestAxis) {
      return false;
    }
    this.applyAxisSnap(bestAxis, pointerX, pointerY);
    this.dragStart.azimuth = this.state.azimuth;
    this.dragStart.elevation = this.state.elevation;
    this.dragStart.x = pointerX;
    this.dragStart.y = pointerY;
    return true;
  }

  private applyAxisSnap(axis: [number, number, number], pointerX: number, pointerY: number): void {
    const desiredElevationRaw = Math.asin(-axis[1]);
    const clampLimit = Math.PI / 2 - 1e-4;
    const desiredElevation = clamp(desiredElevationRaw, -clampLimit, clampLimit);
    const cosElevation = Math.cos(desiredElevation);
    let desiredAzimuth = this.state.azimuth;
    if (Math.abs(cosElevation) >= 1e-5) {
      desiredAzimuth = Math.atan2(-axis[0], -axis[2]);
    }
    this.state.azimuth = this.normalizeAngle(desiredAzimuth);
    this.state.elevation = desiredElevation;
  }

  lookAtAxis(axis: [number, number, number]): void {
    const desiredElevationRaw = Math.asin(-axis[1]);
    const clampLimit = Math.PI / 2 - 1e-4;
    const desiredElevation = clamp(desiredElevationRaw, -clampLimit, clampLimit);
    const cosElevation = Math.cos(desiredElevation);
    let desiredAzimuth = this.state.azimuth;
    if (Math.abs(cosElevation) >= 1e-5) {
      desiredAzimuth = Math.atan2(-axis[0], -axis[2]);
    }
    this.state.azimuth = this.normalizeAngle(desiredAzimuth);
    this.state.elevation = desiredElevation;
    this.onChange();
  }

  private normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
}

function getCameraPanBasis(azimuth: number, elevation: number): {
  right: [number, number, number];
  up: [number, number, number];
} {
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
