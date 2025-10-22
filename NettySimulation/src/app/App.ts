// App.ts — coordinates engine, simulation, and UI subsystems
type DragMode = 'orbit' | 'pan' | null;

interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
  panX: number;
  panY: number;
}

export class App {
  private camera: CameraState = {
    azimuth: Math.PI / 6,
    elevation: Math.PI / 7,
    distance: 1,
    panX: 0,
    panY: 0,
  };

  private orbitWrapper: HTMLDivElement | null = null;
  private dragMode: DragMode = null;
  private activePointerId: number | null = null;
  private dragStart = {
    x: 0,
    y: 0,
    azimuth: 0,
    elevation: 0,
    panX: 0,
    panY: 0,
  };

  mount(host: HTMLElement): void {
    host.innerHTML = '';
    const { container, orbitWrapper } = this.createScene();

    this.orbitWrapper = orbitWrapper;
    host.appendChild(container);
    this.updateCameraTransform();
    this.attachControls(container);
  }

  private createScene(): { container: HTMLDivElement; orbitWrapper: HTMLDivElement } {
    const container = document.createElement('div');
    container.className = 'scene-container';

    const orbitWrapper = document.createElement('div');
    orbitWrapper.className = 'orbit-wrapper';

    const axes = this.createAxes();

    const disc = document.createElement('div');
    disc.className = 'galaxy-disc';
    disc.setAttribute('role', 'img');
    disc.setAttribute('aria-label', 'Simulated galaxy disc preview');

    const halo = document.createElement('div');
    halo.className = 'galaxy-halo';

    const core = document.createElement('div');
    core.className = 'galaxy-core';

    const dust = document.createElement('div');
    dust.className = 'galaxy-dust';

    disc.appendChild(halo);
    disc.appendChild(core);
    disc.appendChild(dust);

    orbitWrapper.appendChild(axes);
    orbitWrapper.appendChild(disc);
    container.appendChild(orbitWrapper);
    return { container, orbitWrapper };
  }

  private attachControls(container: HTMLDivElement): void {
    container.addEventListener('pointerdown', (event) => {
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
      };

      if (mode === 'orbit') {
        container.classList.add('is-orbiting');
      } else if (mode === 'pan') {
        container.classList.add('is-panning');
      }
    });

    container.addEventListener('pointermove', (event) => {
      if (!this.dragMode || event.pointerId !== this.activePointerId) {
        return;
      }

      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;

      if (this.dragMode === 'orbit') {
        const orbitSensitivity = 0.005;
        const elevationSensitivity = 0.004;
        this.camera.azimuth = this.dragStart.azimuth + dx * orbitSensitivity;
        const nextElevation = this.dragStart.elevation + dy * elevationSensitivity;
        const clampLimit = Math.PI / 2 - 0.05;
        this.camera.elevation = Math.min(clampLimit, Math.max(-clampLimit, nextElevation));
      } else if (this.dragMode === 'pan') {
        const panSensitivity = 0.8;
        this.camera.panX = this.dragStart.panX + dx * panSensitivity;
        this.camera.panY = this.dragStart.panY + dy * panSensitivity;
      }

      this.updateCameraTransform();
    });

    const releaseDrag = (event?: PointerEvent) => {
      if (event && this.activePointerId !== null && event.pointerId === this.activePointerId) {
        container.releasePointerCapture?.(this.activePointerId);
      }
      this.activePointerId = null;
      this.dragMode = null;
      container.classList.remove('is-orbiting', 'is-panning');
    };

    container.addEventListener('pointerup', releaseDrag);
    container.addEventListener('pointercancel', releaseDrag);
    container.addEventListener('lostpointercapture', releaseDrag);

    container.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const zoomSensitivity = 0.0018;
        const nextDistance = this.camera.distance - event.deltaY * zoomSensitivity;
        this.camera.distance = Math.min(2.5, Math.max(0.4, nextDistance));
        this.updateCameraTransform();
      },
      { passive: false },
    );

    container.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  private updateCameraTransform(): void {
    if (!this.orbitWrapper) {
      return;
    }

    const { azimuth, elevation, distance, panX, panY } = this.camera;
    const transform = [
      `translate3d(${panX}px, ${panY}px, 0)`,
      `rotateX(${elevation}rad)`,
      `rotateY(${azimuth}rad)`,
      `scale(${distance})`,
    ].join(' ');

    this.orbitWrapper.style.transform = transform;
  }

  private createAxes(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'axis-group';

    const axes: Array<{ className: string; label: string }> = [
      { className: 'axis-y', label: 'Y' },
      { className: 'axis-x', label: 'X' },
      { className: 'axis-z', label: 'Z' },
    ];

    for (const axisDef of axes) {
      const axis = document.createElement('div');
      axis.className = `axis ${axisDef.className}`;
      axis.dataset.label = axisDef.label;
      group.appendChild(axis);
    }

    return group;
  }
}
