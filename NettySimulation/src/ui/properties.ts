// properties.ts — renders the Properties tab as expandable editors for each sim object
import { App } from '../app/App';

type ObjectUpdate = Parameters<App['updateSelectedSimObject']>[0];

const BASE_COLOR_OPTIONS = [
  { value: 'crimson', label: 'Crimson' },
  { value: 'red', label: 'Red' },
  { value: 'amber', label: 'Amber' },
  { value: 'gold', label: 'Gold' },
  { value: 'lime', label: 'Lime' },
  { value: 'teal', label: 'Teal' },
  { value: 'azure', label: 'Azure' },
  { value: 'violet', label: 'Violet' },
  { value: 'magenta', label: 'Magenta' },
  { value: 'white', label: 'White' },
] as const;

type SimObjectView = ReturnType<App['getSimObjects']>[number];

export function createPropertiesTab(app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'properties-tab';

  const header = document.createElement('div');
  header.className = 'properties-header';
  header.textContent = 'Simulation Objects';

  const description = document.createElement('div');
  description.className = 'properties-status';
  description.textContent = 'Twist open an object to edit its spin settings.';

  const list = document.createElement('div');
  list.className = 'properties-object-list';

  container.appendChild(header);
  container.appendChild(description);
  container.appendChild(list);

  type ObjectControls = {
    details: HTMLDetailsElement;
    summary: HTMLElement;
    summaryLabel: HTMLSpanElement;
    visibilityCheckbox: HTMLInputElement;
    speedInput: HTMLInputElement;
    directionCW: HTMLInputElement;
    directionCCW: HTMLInputElement;
    planeYG: HTMLInputElement;
    planeGB: HTMLInputElement;
  planeYB: HTMLInputElement;
  shellInput: HTMLInputElement;
  baseColorSelect: HTMLSelectElement;
  shadingSlider: HTMLInputElement;
  shadingValue: HTMLSpanElement;
  opacitySlider: HTMLInputElement;
  opacityValue: HTMLSpanElement;
  latInput: HTMLInputElement;
  lonInput: HTMLInputElement;
  beltInput?: HTMLInputElement;
  pulseInput?: HTMLInputElement;
};

  const objectControls = new Map<string, ObjectControls>();
  const openObjects = new Set<string>();

  const createObjectControls = (simObject: SimObjectView): ObjectControls => {
    const details = document.createElement('details');
    details.className = 'properties-object';

    const applyUpdate = (update: ObjectUpdate) => {
      app.selectSimObject(simObject.id);
      app.updateSelectedSimObject(update);
    };

    const summary = document.createElement('summary');
    summary.className = 'properties-object-summary';
    summary.addEventListener('click', () => {
      app.selectSimObject(simObject.id);
    });

    const summaryLabel = document.createElement('span');
    summaryLabel.className = 'properties-object-summary-label';
    summaryLabel.textContent = simObject.id;
    summary.appendChild(summaryLabel);

    const visibilityToggle = document.createElement('label');
    visibilityToggle.className = 'properties-object-visibility-toggle';
    visibilityToggle.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const visibilityCheckbox = document.createElement('input');
    visibilityCheckbox.type = 'checkbox';
    visibilityCheckbox.checked = simObject.visible;
    visibilityCheckbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    visibilityCheckbox.addEventListener('change', () => {
      const wasOpen = details.open;
      const nextVisible = visibilityCheckbox.checked;
      applyUpdate({ visible: nextVisible });
      if (!nextVisible) {
        details.open = false;
        openObjects.delete(simObject.id);
      } else if (wasOpen) {
        openObjects.add(simObject.id);
      }
    });

    const visibilityText = document.createElement('span');
    visibilityText.textContent = 'Visible';

    visibilityToggle.appendChild(visibilityCheckbox);
    visibilityToggle.appendChild(visibilityText);
    summary.appendChild(visibilityToggle);

    details.appendChild(summary);

    const form = document.createElement('div');
    form.className = 'properties-object-form';


    const speedGroup = document.createElement('div');
    speedGroup.className = 'properties-group';
    const speedLabel = document.createElement('label');
    speedLabel.className = 'properties-label';
    speedLabel.textContent = 'Speed per Tick';
    speedLabel.htmlFor = `properties-speed-${simObject.id}`;
    const speedInput = document.createElement('input');
    speedInput.type = 'number';
    speedInput.id = `properties-speed-${simObject.id}`;
    speedInput.min = '0.1';
    speedInput.step = '0.1';
    speedInput.className = 'properties-number';
    speedInput.value = simObject.speedPerTick.toFixed(2);
    speedInput.dataset.prev = speedInput.value;
    speedInput.addEventListener('change', () => {
      const value = Number.parseFloat(speedInput.value);
      if (!Number.isFinite(value)) {
        speedInput.value = speedInput.dataset.prev ?? '1.0';
        return;
      }
      const next = Math.max(0.1, value);
      speedInput.value = next.toFixed(2);
      speedInput.dataset.prev = speedInput.value;
      applyUpdate({ speedPerTick: next });
    });
    speedGroup.appendChild(speedLabel);
    speedGroup.appendChild(speedInput);

    const directionGroup = document.createElement('fieldset');
    directionGroup.className = 'properties-fieldset';
    const directionLegend = document.createElement('legend');
    directionLegend.textContent = 'Direction';
    directionGroup.appendChild(directionLegend);
    const directionGroupName = `properties-direction-${simObject.id}`;
    const directionCW = createRadio(directionGroupName, 'cw', 'Clockwise');
    const directionCCW = createRadio(directionGroupName, 'ccw', 'Counter Clockwise');
    directionCW.input.addEventListener('change', () => {
      if (directionCW.input.checked) {
        applyUpdate({ direction: 1 });
      }
    });
    directionCCW.input.addEventListener('change', () => {
      if (directionCCW.input.checked) {
        applyUpdate({ direction: -1 });
      }
    });
    directionGroup.appendChild(directionCW.wrapper);
    directionGroup.appendChild(directionCCW.wrapper);

    const planeGroup = document.createElement('fieldset');
    planeGroup.className = 'properties-fieldset';
    const planeLegend = document.createElement('legend');
    planeLegend.textContent = 'Spin Plane';
    planeGroup.appendChild(planeLegend);
    const planeGroupName = `properties-plane-${simObject.id}`;
    const planeYG = createRadio(planeGroupName, 'YG', 'Spin about B axis (YG)');
    const planeGB = createRadio(planeGroupName, 'GB', 'Spin about Y axis (GB)');
    const planeYB = createRadio(planeGroupName, 'YB', 'Spin about G axis (YB)');
    planeYG.input.addEventListener('change', () => {
      if (planeYG.input.checked) {
        applyUpdate({ plane: 'YG' });
      }
    });
    planeGB.input.addEventListener('change', () => {
      if (planeGB.input.checked) {
        applyUpdate({ plane: 'GB' });
      }
    });
    planeYB.input.addEventListener('change', () => {
      if (planeYB.input.checked) {
        applyUpdate({ plane: 'YB' });
      }
    });
    planeGroup.appendChild(planeYG.wrapper);
    planeGroup.appendChild(planeGB.wrapper);
    planeGroup.appendChild(planeYB.wrapper);

    const shellGroup = document.createElement('div');
    shellGroup.className = 'properties-group';
    const shellLabel = document.createElement('label');
    shellLabel.className = 'properties-label';
    shellLabel.textContent = 'Shell Size';
    shellLabel.htmlFor = `properties-shell-${simObject.id}`;
    const shellInput = document.createElement('input');
    shellInput.type = 'number';
    shellInput.id = `properties-shell-${simObject.id}`;
    shellInput.min = '1';
    shellInput.step = '1';
    shellInput.className = 'properties-number properties-number--compact';
    shellInput.value = String(simObject.shellSize);
    shellInput.dataset.prev = shellInput.value;
    shellInput.addEventListener('change', () => {
      const size = Number.parseInt(shellInput.value, 10);
      const previous = Number.parseInt(shellInput.dataset.prev ?? '1', 10);
      const next = Number.isFinite(size) ? Math.max(1, size) : previous;
      shellInput.value = String(next);
      shellInput.dataset.prev = shellInput.value;
      applyUpdate({ shellSize: next });
    });
    shellGroup.appendChild(shellLabel);
    shellGroup.appendChild(shellInput);

    const baseColorGroup = document.createElement('div');
    baseColorGroup.className = 'properties-group';
    const baseColorLabel = document.createElement('label');
    baseColorLabel.className = 'properties-label';
    baseColorLabel.textContent = 'Base Color';
    baseColorLabel.htmlFor = `properties-base-color-${simObject.id}`;
    const baseColorSelect = document.createElement('select');
    baseColorSelect.id = `properties-base-color-${simObject.id}`;
    baseColorSelect.className = 'properties-select';
    BASE_COLOR_OPTIONS.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      baseColorSelect.appendChild(opt);
    });
    baseColorSelect.value = simObject.baseColor;
    baseColorSelect.addEventListener('change', () => {
      applyUpdate({ baseColor: baseColorSelect.value as ObjectUpdate['baseColor'] });
    });
    baseColorGroup.appendChild(baseColorLabel);
    baseColorGroup.appendChild(baseColorSelect);

    let beltInput: HTMLInputElement | undefined;
    let pulseInput: HTMLInputElement | undefined;
    if (simObject.type === 'twirl') {
      const beltGroup = document.createElement('div');
      beltGroup.className = 'properties-group';
      const beltLabel = document.createElement('label');
      beltLabel.className = 'properties-label';
      beltLabel.textContent = 'Belt Half Angle (rad)';
      beltLabel.htmlFor = `properties-belt-${simObject.id}`;
      beltInput = document.createElement('input');
      beltInput.type = 'number';
      beltInput.id = `properties-belt-${simObject.id}`;
      beltInput.step = '0.01';
      beltInput.min = '0.01';
      beltInput.max = (Math.PI / 2).toFixed(2);
      beltInput.className = 'properties-number properties-number--compact';
      beltInput.value = simObject.beltHalfAngle.toFixed(2);
      beltInput.addEventListener('change', () => {
        const value = Number.parseFloat(beltInput!.value);
        const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0.01), Math.PI / 2) : simObject.beltHalfAngle;
        beltInput!.value = clamped.toFixed(2);
        applyUpdate({ beltHalfAngle: clamped } as ObjectUpdate);
      });
      beltGroup.appendChild(beltLabel);
      beltGroup.appendChild(beltInput);

      const pulseGroup = document.createElement('div');
      pulseGroup.className = 'properties-group';
      const pulseLabel = document.createElement('label');
      pulseLabel.className = 'properties-label';
      pulseLabel.textContent = 'Pulse Speed';
      pulseLabel.htmlFor = `properties-pulse-${simObject.id}`;
      pulseInput = document.createElement('input');
      pulseInput.type = 'number';
      pulseInput.id = `properties-pulse-${simObject.id}`;
      pulseInput.step = '0.05';
      pulseInput.min = '0';
      pulseInput.className = 'properties-number properties-number--compact';
      pulseInput.value = simObject.pulseSpeed.toFixed(2);
      pulseInput.addEventListener('change', () => {
        const value = Number.parseFloat(pulseInput!.value);
        const clamped = Number.isFinite(value) ? Math.max(0, value) : simObject.pulseSpeed;
        pulseInput!.value = clamped.toFixed(2);
        applyUpdate({ pulseSpeed: clamped } as ObjectUpdate);
      });
      pulseGroup.appendChild(pulseLabel);
      pulseGroup.appendChild(pulseInput);

      form.appendChild(beltGroup);
      form.appendChild(pulseGroup);
    }

    const opacityGroup = document.createElement('div');
    opacityGroup.className = 'properties-group';
    const opacityLabel = document.createElement('label');
    opacityLabel.className = 'properties-label';
    opacityLabel.textContent = 'Opacity Gradient';
    opacityLabel.htmlFor = `properties-opacity-${simObject.id}`;
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.id = `properties-opacity-${simObject.id}`;
    opacitySlider.min = '0';
    opacitySlider.max = '1';
    opacitySlider.step = '0.05';
    opacitySlider.className = 'sim-speed-slider';
    opacitySlider.value = simObject.opacity.toString();
    const opacityValue = document.createElement('span');
    opacityValue.className = 'properties-shading-value';
    opacityValue.textContent = simObject.opacity.toFixed(2);
    opacitySlider.addEventListener('input', () => {
      const value = Number.parseFloat(opacitySlider.value);
      const clamped = Number.isFinite(value) ? value : simObject.opacity;
      opacityValue.textContent = clamped.toFixed(2);
      applyUpdate({ opacity: clamped });
    });
    opacityGroup.appendChild(opacityLabel);
    opacityGroup.appendChild(opacitySlider);
    opacityGroup.appendChild(opacityValue);

    const shadingGroup = document.createElement('div');
    shadingGroup.className = 'properties-group';
    const shadingLabel = document.createElement('label');
    shadingLabel.className = 'properties-label';
    shadingLabel.textContent = 'Shading Intensity';
    shadingLabel.htmlFor = `properties-shading-${simObject.id}`;
    const shadingSlider = document.createElement('input');
    shadingSlider.type = 'range';
    shadingSlider.id = `properties-shading-${simObject.id}`;
    shadingSlider.min = '0';
    shadingSlider.max = '1';
    shadingSlider.step = '0.05';
    shadingSlider.className = 'sim-speed-slider';
    const shadingValue = document.createElement('span');
    shadingValue.className = 'properties-shading-value';
    const initialShading = simObject.shadingIntensity ?? app.getShadingIntensity();
    shadingSlider.value = initialShading.toString();
    shadingValue.textContent = initialShading.toFixed(2);
    shadingSlider.addEventListener('input', () => {
      const value = Number.parseFloat(shadingSlider.value);
      const fallback = simObject.shadingIntensity ?? app.getShadingIntensity();
      const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;
      shadingSlider.value = clamped.toString();
      shadingValue.textContent = clamped.toFixed(2);
      app.selectSimObject(simObject.id);
      app.setShadingIntensity(clamped);
    });
    shadingGroup.appendChild(shadingLabel);
    shadingGroup.appendChild(shadingSlider);
    shadingGroup.appendChild(shadingValue);

    const segmentsGroup = document.createElement('div');
    segmentsGroup.className = 'properties-group';
    const latRow = document.createElement('div');
    latRow.className = 'properties-inline';
    const latLabel = document.createElement('label');
    latLabel.className = 'properties-label';
    latLabel.textContent = 'Latitude Bands';
    latLabel.htmlFor = `properties-latitude-${simObject.id}`;
    const latInput = document.createElement('input');
    latInput.type = 'number';
    latInput.id = `properties-latitude-${simObject.id}`;
    latInput.min = '1';
    latInput.max = '256';
    latInput.step = '1';
    latInput.className = 'properties-number properties-number--compact';
    latRow.appendChild(latLabel);
    latRow.appendChild(latInput);

    const lonRow = document.createElement('div');
    lonRow.className = 'properties-inline';
    const lonLabel = document.createElement('label');
    lonLabel.className = 'properties-label';
    lonLabel.textContent = 'Longitude Bands';
    lonLabel.htmlFor = `properties-longitude-${simObject.id}`;
    const lonInput = document.createElement('input');
    lonInput.type = 'number';
    lonInput.id = `properties-longitude-${simObject.id}`;
    lonInput.min = '1';
    lonInput.max = '256';
    lonInput.step = '1';
    lonInput.className = 'properties-number properties-number--compact';
    lonRow.appendChild(lonLabel);
    lonRow.appendChild(lonInput);
    segmentsGroup.appendChild(latRow);
    segmentsGroup.appendChild(lonRow);

    latInput.addEventListener('change', () => {
      const lat = Number.parseInt(latInput.value, 10);
      const current = app.getSphereSegments();
      const nextLat = Number.isFinite(lat) ? lat : current.lat;
      app.setSphereSegments(nextLat, current.lon);
      const updated = app.getSphereSegments();
      latInput.value = String(updated.lat);
      lonInput.value = String(updated.lon);
    });

    lonInput.addEventListener('change', () => {
      const lon = Number.parseInt(lonInput.value, 10);
      const current = app.getSphereSegments();
      const nextLon = Number.isFinite(lon) ? lon : current.lon;
      app.setSphereSegments(current.lat, nextLon);
      const updated = app.getSphereSegments();
      latInput.value = String(updated.lat);
      lonInput.value = String(updated.lon);
    });

    form.appendChild(speedGroup);
    form.appendChild(directionGroup);
    form.appendChild(planeGroup);
    form.appendChild(shellGroup);
    form.appendChild(baseColorGroup);
    form.appendChild(opacityGroup);
    form.appendChild(shadingGroup);
    form.appendChild(segmentsGroup);
    details.appendChild(form);

    details.addEventListener('toggle', () => {
      if (details.open) {
        openObjects.add(simObject.id);
        app.selectSimObject(simObject.id);
      } else {
        openObjects.delete(simObject.id);
      }
    });

    return {
      details,
      summary,
      summaryLabel,
      visibilityCheckbox,
      speedInput,
      directionCW: directionCW.input,
      directionCCW: directionCCW.input,
      planeYG: planeYG.input,
      planeGB: planeGB.input,
      planeYB: planeYB.input,
      shellInput,
      baseColorSelect,
      shadingSlider,
      shadingValue,
      opacitySlider,
      opacityValue,
      latInput,
      lonInput,
      beltInput,
      pulseInput,
    };
  };

  const updateObjectControls = (
    controls: ObjectControls,
    simObject: SimObjectView,
    selectedId: string | null,
    segments: { lat: number; lon: number },
  ) => {
    const shouldOpen = openObjects.has(simObject.id);
    if (controls.details.open !== shouldOpen) {
      controls.details.open = shouldOpen;
    }
    controls.details.classList.toggle('is-selected', simObject.id === selectedId);
    controls.summaryLabel.textContent = simObject.id;

    controls.visibilityCheckbox.checked = simObject.visible;

    controls.speedInput.value = simObject.speedPerTick.toFixed(2);
    controls.speedInput.dataset.prev = controls.speedInput.value;

    controls.directionCW.checked = simObject.direction >= 0;
    controls.directionCCW.checked = simObject.direction < 0;

    controls.planeYG.checked = simObject.plane === 'YG';
    controls.planeGB.checked = simObject.plane === 'GB';
    controls.planeYB.checked = simObject.plane === 'YB';

    controls.shellInput.value = String(simObject.shellSize);
    controls.shellInput.dataset.prev = controls.shellInput.value;

    controls.baseColorSelect.value = simObject.baseColor;

    const shading = simObject.shadingIntensity ?? app.getShadingIntensity();
    controls.shadingSlider.value = shading.toString();
    controls.shadingValue.textContent = shading.toFixed(2);

    controls.opacitySlider.value = simObject.opacity.toString();
    controls.opacityValue.textContent = simObject.opacity.toFixed(2);

    if (controls.beltInput) {
      const beltValue = simObject.type === 'twirl' ? simObject.beltHalfAngle : 0;
      controls.beltInput.value = beltValue.toFixed(2);
    }

    if (controls.pulseInput) {
      const pulseValue = simObject.type === 'twirl' ? simObject.pulseSpeed : 0;
      controls.pulseInput.value = pulseValue.toFixed(2);
    }

    controls.latInput.value = String(segments.lat);
    controls.lonInput.value = String(segments.lon);
  };

  const renderObjects = () => {
    const simObjects = app.getSimObjects();
    const segments = app.getSphereSegments();
    const selectedId = app.getSelectedSimObject()?.id ?? null;
    if (selectedId && !objectControls.has(selectedId)) {
      openObjects.add(selectedId);
    }

    if (simObjects.length === 0) {
      openObjects.clear();
      for (const controls of objectControls.values()) {
        controls.details.remove();
      }
      objectControls.clear();
      const empty = document.createElement('div');
      empty.className = 'properties-empty';
      empty.textContent = 'No simulation objects available.';
      list.replaceChildren(empty);
      return;
    }

    const emptyState = list.querySelector('.properties-empty');
    if (emptyState) {
      emptyState.remove();
    }

    const remainingIds = new Set(objectControls.keys());

    for (const simObject of simObjects) {
      let controls = objectControls.get(simObject.id);
      if (!controls) {
        controls = createObjectControls(simObject);
        objectControls.set(simObject.id, controls);
      }
      updateObjectControls(controls, simObject, selectedId, segments);
      list.appendChild(controls.details);
      remainingIds.delete(simObject.id);
    }

    for (const id of remainingIds) {
      const controls = objectControls.get(id);
      if (controls) {
        controls.details.remove();
      }
      objectControls.delete(id);
      openObjects.delete(id);
    }
  };

  const unsubscribe = app.onSimChange(() => {
    renderObjects();
  });

  renderObjects();

  container.addEventListener('DOMNodeRemoved', () => {
    unsubscribe();
  });

  return container;
}

function createRadio(name: string, value: string, labelText: string) {
  const wrapper = document.createElement('label');
  wrapper.className = 'properties-radio';

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;

  const span = document.createElement('span');
  span.textContent = labelText;

  wrapper.appendChild(input);
  wrapper.appendChild(span);

  return { wrapper, input };
}
