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
    planeYG?: HTMLInputElement;
    planeGB?: HTMLInputElement;
    planeYB?: HTMLInputElement;
    shellInput?: HTMLInputElement;
    baseColorSelect?: HTMLSelectElement;
    shadingSlider?: HTMLInputElement;
    shadingValue?: HTMLSpanElement;
  opacitySlider?: HTMLInputElement;
  opacityValue?: HTMLSpanElement;
  sphereOpacitySlider?: HTMLInputElement;
  sphereOpacityValue?: HTMLSpanElement;
  primaryShadingSlider?: HTMLInputElement;
  primaryShadingValue?: HTMLSpanElement;
  primaryOpacitySlider?: HTMLInputElement;
  primaryOpacityValue?: HTMLSpanElement;
  secondaryShadingSlider?: HTMLInputElement;
  secondaryShadingValue?: HTMLSpanElement;
  secondaryOpacitySlider?: HTMLInputElement;
  secondaryOpacityValue?: HTMLSpanElement;
  latInput: HTMLInputElement;
  lonInput: HTMLInputElement;
  beltInput?: HTMLInputElement;
  pulseInput?: HTMLInputElement;
  sizeInput?: HTMLInputElement;
    scriptInput?: HTMLInputElement;
    scriptSelect?: HTMLSelectElement;
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

    const isTwirlingAxis = simObject.type === 'twirling-axis';
    const isRgp = simObject.type === 'rgpXY';


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
    if (isRgp) {
      speedInput.disabled = true;
    }

    let planeYG: ReturnType<typeof createRadio> | undefined;
    let planeGB: ReturnType<typeof createRadio> | undefined;
    let planeYB: ReturnType<typeof createRadio> | undefined;
    let shellInput: HTMLInputElement | undefined;
    let baseColorSelect: HTMLSelectElement | undefined;
    let opacitySlider: HTMLInputElement | undefined;
    let opacityValue: HTMLSpanElement | undefined;
    let shadingSlider: HTMLInputElement | undefined;
    let shadingValue: HTMLSpanElement | undefined;

    if (!isTwirlingAxis && !isRgp) {
      const planeGroup = document.createElement('fieldset');
      planeGroup.className = 'properties-fieldset';
      const planeLegend = document.createElement('legend');
      planeLegend.textContent = 'Spin Plane';
      planeGroup.appendChild(planeLegend);
      const planeGroupName = `properties-plane-${simObject.id}`;
      planeYG = createRadio(planeGroupName, 'YG', 'Spin about B axis (YG)');
      planeGB = createRadio(planeGroupName, 'GB', 'Spin about Y axis (GB)');
      planeYB = createRadio(planeGroupName, 'YB', 'Spin about G axis (YB)');
      planeYG.input.addEventListener('change', () => {
        if (planeYG && planeYG.input.checked) {
          applyUpdate({ plane: 'YG' });
        }
      });
      planeGB.input.addEventListener('change', () => {
        if (planeGB && planeGB.input.checked) {
          applyUpdate({ plane: 'GB' });
        }
      });
      planeYB.input.addEventListener('change', () => {
        if (planeYB && planeYB.input.checked) {
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
      shellInput = document.createElement('input');
      shellInput.type = 'number';
      shellInput.id = `properties-shell-${simObject.id}`;
      shellInput.min = '1';
      shellInput.step = '1';
      shellInput.className = 'properties-number properties-number--compact';
      shellInput.value = String(simObject.shellSize);
      shellInput.dataset.prev = shellInput.value;
      shellInput.addEventListener('change', () => {
        if (!shellInput) {
          return;
        }
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
      baseColorSelect = document.createElement('select');
      baseColorSelect.id = `properties-base-color-${simObject.id}`;
      baseColorSelect.className = 'properties-select';
      BASE_COLOR_OPTIONS.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        baseColorSelect!.appendChild(opt);
      });
      baseColorSelect.value = simObject.baseColor;
      baseColorSelect.addEventListener('change', () => {
        applyUpdate({ baseColor: baseColorSelect!.value as ObjectUpdate['baseColor'] });
      });
      baseColorGroup.appendChild(baseColorLabel);
      baseColorGroup.appendChild(baseColorSelect);

      form.appendChild(planeGroup);
      form.appendChild(shellGroup);
      form.appendChild(baseColorGroup);
    }

    let sizeInput: HTMLInputElement | undefined;
    let scriptInput: HTMLInputElement | undefined;
    let scriptSelect: HTMLSelectElement | undefined;
    let sphereOpacitySlider: HTMLInputElement | undefined;
    let sphereOpacityValue: HTMLSpanElement | undefined;
    let primaryShadingSlider: HTMLInputElement | undefined;
    let primaryShadingValue: HTMLSpanElement | undefined;
    let primaryOpacitySlider: HTMLInputElement | undefined;
    let primaryOpacityValue: HTMLSpanElement | undefined;
    let secondaryShadingSlider: HTMLInputElement | undefined;
    let secondaryShadingValue: HTMLSpanElement | undefined;
    let secondaryOpacitySlider: HTMLInputElement | undefined;
    let secondaryOpacityValue: HTMLSpanElement | undefined;

    const makeSubDetails = (label: string) => {
      const detailsEl = document.createElement('details');
      detailsEl.className = 'properties-subobject';
      const summaryEl = document.createElement('summary');
      summaryEl.className = 'properties-subobject-summary';
      summaryEl.textContent = label;
      detailsEl.appendChild(summaryEl);
      return detailsEl;
    };

    if (isTwirlingAxis || isRgp) {
      const defaultScript = app.getDefaultTwirlingAxisScript();
      const presets = app.getTwirlingAxisScriptPresets();
      const defaultSphereOpacity = app.getDefaultRgpSphereOpacity();

      const sizeGroup = document.createElement('div');
      sizeGroup.className = 'properties-group';
      const sizeLabel = document.createElement('label');
      sizeLabel.className = 'properties-label';
      sizeLabel.textContent = 'Size Scale';
      sizeLabel.htmlFor = `properties-size-${simObject.id}`;
      sizeInput = document.createElement('input');
      sizeInput.type = 'number';
      sizeInput.id = `properties-size-${simObject.id}`;
      sizeInput.min = '0.1';
      sizeInput.step = '0.1';
      sizeInput.className = 'properties-number properties-number--compact';
      const initialSize = (simObject as { size?: number }).size ?? 1;
      sizeInput.value = initialSize.toFixed(2);
      sizeInput.dataset.prev = sizeInput.value;
      sizeInput.addEventListener('change', () => {
        if (!sizeInput) {
          return;
        }
        const raw = Number.parseFloat(sizeInput.value);
        const previous = Number.parseFloat(sizeInput.dataset.prev ?? '1');
        const next = Number.isFinite(raw) ? Math.max(0.1, raw) : previous;
        sizeInput.value = next.toFixed(2);
        sizeInput.dataset.prev = sizeInput.value;
        applyUpdate({ size: next } as ObjectUpdate);
      });
      sizeGroup.appendChild(sizeLabel);
      sizeGroup.appendChild(sizeInput);

      form.appendChild(sizeGroup);

      if (isRgp) {
        const rgpSim = simObject as SimObjectView & { sphereOpacity?: number };
        const primaryDetails = makeSubDetails('Primary Ring');
        const primaryBody = document.createElement('div');
        primaryBody.className = 'properties-subobject-body';
        const primaryContent = document.createElement('div');
        primaryContent.className = 'properties-subobject-description';
        primaryContent.textContent = 'White pulse ring with adaptive brightness.';
        primaryBody.appendChild(primaryContent);

        const primaryState = simObject.primary;
        const primaryShadingGroup = document.createElement('div');
        primaryShadingGroup.className = 'properties-group';
        const primaryShadingLabel = document.createElement('label');
        primaryShadingLabel.className = 'properties-label';
        primaryShadingLabel.textContent = 'Shading Intensity';
        primaryShadingLabel.htmlFor = `properties-rgp-primary-shading-${simObject.id}`;
        primaryShadingSlider = document.createElement('input');
        primaryShadingSlider.type = 'range';
        primaryShadingSlider.id = `properties-rgp-primary-shading-${simObject.id}`;
        primaryShadingSlider.min = '0';
        primaryShadingSlider.max = '1';
        primaryShadingSlider.step = '0.05';
        primaryShadingSlider.className = 'sim-speed-slider';
        primaryShadingSlider.value = primaryState.shadingIntensity.toFixed(2);
        primaryShadingValue = document.createElement('span');
        primaryShadingValue.className = 'properties-shading-value';
        primaryShadingValue.textContent = primaryState.shadingIntensity.toFixed(2);
        primaryShadingSlider.addEventListener('input', () => {
          if (!primaryShadingSlider || !primaryShadingValue) {
            return;
          }
          const raw = Number.parseFloat(primaryShadingSlider.value);
          const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : primaryState.shadingIntensity;
          primaryShadingSlider.value = clamped.toFixed(2);
          primaryShadingValue.textContent = clamped.toFixed(2);
          app.selectSimObject(simObject.id);
          app.updateRgpRingProperties(simObject.id, 'primary', { shadingIntensity: clamped });
        });
        primaryShadingGroup.appendChild(primaryShadingLabel);
        primaryShadingGroup.appendChild(primaryShadingSlider);
        primaryShadingGroup.appendChild(primaryShadingValue);
        primaryBody.appendChild(primaryShadingGroup);

        const primaryOpacityGroup = document.createElement('div');
        primaryOpacityGroup.className = 'properties-group';
        const primaryOpacityLabel = document.createElement('label');
        primaryOpacityLabel.className = 'properties-label';
        primaryOpacityLabel.textContent = 'Opacity';
        primaryOpacityLabel.htmlFor = `properties-rgp-primary-opacity-${simObject.id}`;
        primaryOpacitySlider = document.createElement('input');
        primaryOpacitySlider.type = 'range';
        primaryOpacitySlider.id = `properties-rgp-primary-opacity-${simObject.id}`;
        primaryOpacitySlider.min = '0';
        primaryOpacitySlider.max = '1';
        primaryOpacitySlider.step = '0.05';
        primaryOpacitySlider.className = 'sim-speed-slider';
        primaryOpacitySlider.value = primaryState.opacity.toFixed(2);
        primaryOpacityValue = document.createElement('span');
        primaryOpacityValue.className = 'properties-shading-value';
        primaryOpacityValue.textContent = primaryState.opacity.toFixed(2);
        primaryOpacitySlider.addEventListener('input', () => {
          if (!primaryOpacitySlider || !primaryOpacityValue) {
            return;
          }
          const raw = Number.parseFloat(primaryOpacitySlider.value);
          const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : primaryState.opacity;
          primaryOpacitySlider.value = clamped.toFixed(2);
          primaryOpacityValue.textContent = clamped.toFixed(2);
          app.selectSimObject(simObject.id);
          app.updateRgpRingProperties(simObject.id, 'primary', { opacity: clamped });
        });
        primaryOpacityGroup.appendChild(primaryOpacityLabel);
        primaryOpacityGroup.appendChild(primaryOpacitySlider);
        primaryOpacityGroup.appendChild(primaryOpacityValue);
        primaryBody.appendChild(primaryOpacityGroup);

        primaryDetails.appendChild(primaryBody);
        form.appendChild(primaryDetails);

        const secondaryDetails = makeSubDetails('Secondary Ring');
        const secondaryBody = document.createElement('div');
        secondaryBody.className = 'properties-subobject-body';
        const secondaryContent = document.createElement('div');
        secondaryContent.className = 'properties-subobject-description';
        secondaryContent.textContent = 'Red counter-rotating pulse ring.';
        secondaryBody.appendChild(secondaryContent);

        const secondaryState = simObject.secondary;
        const secondaryShadingGroup = document.createElement('div');
        secondaryShadingGroup.className = 'properties-group';
        const secondaryShadingLabel = document.createElement('label');
        secondaryShadingLabel.className = 'properties-label';
        secondaryShadingLabel.textContent = 'Shading Intensity';
        secondaryShadingLabel.htmlFor = `properties-rgp-secondary-shading-${simObject.id}`;
        secondaryShadingSlider = document.createElement('input');
        secondaryShadingSlider.type = 'range';
        secondaryShadingSlider.id = `properties-rgp-secondary-shading-${simObject.id}`;
        secondaryShadingSlider.min = '0';
        secondaryShadingSlider.max = '1';
        secondaryShadingSlider.step = '0.05';
        secondaryShadingSlider.className = 'sim-speed-slider';
        secondaryShadingSlider.value = secondaryState.shadingIntensity.toFixed(2);
        secondaryShadingValue = document.createElement('span');
        secondaryShadingValue.className = 'properties-shading-value';
        secondaryShadingValue.textContent = secondaryState.shadingIntensity.toFixed(2);
        secondaryShadingSlider.addEventListener('input', () => {
          if (!secondaryShadingSlider || !secondaryShadingValue) {
            return;
          }
          const raw = Number.parseFloat(secondaryShadingSlider.value);
          const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : secondaryState.shadingIntensity;
          secondaryShadingSlider.value = clamped.toFixed(2);
          secondaryShadingValue.textContent = clamped.toFixed(2);
          app.selectSimObject(simObject.id);
          app.updateRgpRingProperties(simObject.id, 'secondary', { shadingIntensity: clamped });
        });
        secondaryShadingGroup.appendChild(secondaryShadingLabel);
        secondaryShadingGroup.appendChild(secondaryShadingSlider);
        secondaryShadingGroup.appendChild(secondaryShadingValue);
        secondaryBody.appendChild(secondaryShadingGroup);

        const secondaryOpacityGroup = document.createElement('div');
        secondaryOpacityGroup.className = 'properties-group';
        const secondaryOpacityLabel = document.createElement('label');
        secondaryOpacityLabel.className = 'properties-label';
        secondaryOpacityLabel.textContent = 'Opacity';
        secondaryOpacityLabel.htmlFor = `properties-rgp-secondary-opacity-${simObject.id}`;
        secondaryOpacitySlider = document.createElement('input');
        secondaryOpacitySlider.type = 'range';
        secondaryOpacitySlider.id = `properties-rgp-secondary-opacity-${simObject.id}`;
        secondaryOpacitySlider.min = '0';
        secondaryOpacitySlider.max = '1';
        secondaryOpacitySlider.step = '0.05';
        secondaryOpacitySlider.className = 'sim-speed-slider';
        secondaryOpacitySlider.value = secondaryState.opacity.toFixed(2);
        secondaryOpacityValue = document.createElement('span');
        secondaryOpacityValue.className = 'properties-shading-value';
        secondaryOpacityValue.textContent = secondaryState.opacity.toFixed(2);
        secondaryOpacitySlider.addEventListener('input', () => {
          if (!secondaryOpacitySlider || !secondaryOpacityValue) {
            return;
          }
          const raw = Number.parseFloat(secondaryOpacitySlider.value);
          const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : secondaryState.opacity;
          secondaryOpacitySlider.value = clamped.toFixed(2);
          secondaryOpacityValue.textContent = clamped.toFixed(2);
          app.selectSimObject(simObject.id);
          app.updateRgpRingProperties(simObject.id, 'secondary', { opacity: clamped });
        });
        secondaryOpacityGroup.appendChild(secondaryOpacityLabel);
        secondaryOpacityGroup.appendChild(secondaryOpacitySlider);
        secondaryOpacityGroup.appendChild(secondaryOpacityValue);
        secondaryBody.appendChild(secondaryOpacityGroup);

        secondaryDetails.appendChild(secondaryBody);
        form.appendChild(secondaryDetails);

        const sphereDetails = makeSubDetails('Blue Sphere');
        const sphereOpacityGroup = document.createElement('div');
        sphereOpacityGroup.className = 'properties-group';
        const sphereOpacityLabel = document.createElement('label');
        sphereOpacityLabel.className = 'properties-label';
        sphereOpacityLabel.textContent = 'Sphere Opacity';
        sphereOpacityLabel.htmlFor = `properties-rgp-sphere-opacity-${simObject.id}`;
        sphereOpacitySlider = document.createElement('input');
        sphereOpacitySlider.type = 'range';
        sphereOpacitySlider.id = `properties-rgp-sphere-opacity-${simObject.id}`;
        sphereOpacitySlider.min = '0';
        sphereOpacitySlider.max = '1';
        sphereOpacitySlider.step = '0.05';
        sphereOpacitySlider.className = 'sim-speed-slider';
        const initialSphereOpacity = rgpSim.sphereOpacity ?? defaultSphereOpacity;
        sphereOpacitySlider.value = initialSphereOpacity.toFixed(2);
        sphereOpacityValue = document.createElement('span');
        sphereOpacityValue.className = 'properties-shading-value';
        sphereOpacityValue.textContent = initialSphereOpacity.toFixed(2);
        sphereOpacitySlider.addEventListener('input', () => {
          if (!sphereOpacitySlider || !sphereOpacityValue) {
            return;
          }
          const value = Number.parseFloat(sphereOpacitySlider.value);
          const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : initialSphereOpacity;
          sphereOpacitySlider.value = clamped.toFixed(2);
          sphereOpacityValue.textContent = clamped.toFixed(2);
          applyUpdate({ sphereOpacity: clamped } as ObjectUpdate);
        });
        sphereOpacityGroup.appendChild(sphereOpacityLabel);
      sphereOpacityGroup.appendChild(sphereOpacitySlider);
      sphereOpacityGroup.appendChild(sphereOpacityValue);
      const sphereBody = document.createElement('div');
      sphereBody.className = 'properties-subobject-body';
      sphereBody.appendChild(sphereOpacityGroup);
        sphereDetails.appendChild(sphereBody);
        form.appendChild(sphereDetails);
      }

      if (isTwirlingAxis) {
        const axisSim = simObject as SimObjectView & {
          opacity?: number;
          rotationScriptSource?: string;
        };

        const axisOpacityGroup = document.createElement('div');
        axisOpacityGroup.className = 'properties-group';
        const axisOpacityLabel = document.createElement('label');
        axisOpacityLabel.className = 'properties-label';
        axisOpacityLabel.textContent = 'Axis Opacity';
        axisOpacityLabel.htmlFor = `properties-axis-opacity-${simObject.id}`;
        opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.id = `properties-axis-opacity-${simObject.id}`;
        opacitySlider.min = '0';
        opacitySlider.max = '1';
        opacitySlider.step = '0.05';
        opacitySlider.className = 'sim-speed-slider';
        opacitySlider.value = (axisSim.opacity ?? 1).toFixed(2);
        opacityValue = document.createElement('span');
        opacityValue.className = 'properties-shading-value';
        opacityValue.textContent = (axisSim.opacity ?? 1).toFixed(2);
        opacitySlider.addEventListener('input', () => {
          if (!opacitySlider || !opacityValue) {
            return;
          }
          const value = Number.parseFloat(opacitySlider.value);
          const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : axisSim.opacity ?? 1;
          opacitySlider.value = clamped.toFixed(2);
          opacityValue.textContent = clamped.toFixed(2);
          applyUpdate({ opacity: clamped } as ObjectUpdate);
        });
        axisOpacityGroup.appendChild(axisOpacityLabel);
        axisOpacityGroup.appendChild(opacitySlider);
        axisOpacityGroup.appendChild(opacityValue);

        const scriptGroup = document.createElement('div');
        scriptGroup.className = 'properties-group';
      const scriptSelectLabel = document.createElement('label');
      scriptSelectLabel.className = 'properties-label';
      scriptSelectLabel.textContent = 'Script Presets';
      scriptSelectLabel.htmlFor = `properties-script-select-${simObject.id}`;
      const presetSelect = document.createElement('select');
      presetSelect.id = `properties-script-select-${simObject.id}`;
      presetSelect.className = 'properties-select';
      const customOption = document.createElement('option');
      customOption.value = '';
      customOption.textContent = 'Custom (edit below)';
      presetSelect.appendChild(customOption);
      presets.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.script;
        option.textContent = preset.label;
        presetSelect.appendChild(option);
      });
      scriptSelect = presetSelect;
      presetSelect.dataset.prev = '';
      presetSelect.addEventListener('change', () => {
        const selectedScript = presetSelect.value;
        if (selectedScript) {
          scriptInput!.value = selectedScript;
          scriptInput!.dispatchEvent(new Event('change', { bubbles: true }));
        }
        presetSelect.dataset.prev = presetSelect.value;
      });

      const scriptLabel = document.createElement('label');
        scriptLabel.className = 'properties-label';
        scriptLabel.textContent = 'Rotation Script';
        scriptLabel.htmlFor = `properties-script-${simObject.id}`;
        scriptInput = document.createElement('input');
        scriptInput.type = 'text';
        scriptInput.id = `properties-script-${simObject.id}`;
        scriptInput.className = 'properties-input';
        scriptInput.value = axisSim.rotationScriptSource ?? defaultScript;
        scriptInput.dataset.prev = scriptInput.value;
      scriptInput.addEventListener('change', () => {
        const value = scriptInput!.value.trim();
        app.selectSimObject(simObject.id);
        const applied = app.setSelectedTwirlingAxisRotationScript(value);
        if (!applied) {
          scriptInput!.value = scriptInput!.dataset.prev ?? defaultScript;
          if (scriptSelect) {
            scriptSelect.value = scriptSelect.dataset.prev ?? '';
          }
        } else {
          scriptInput!.dataset.prev = scriptInput!.value;
          if (scriptSelect) {
            const matchingPreset = presets.find((preset) => preset.script === scriptInput!.value);
            scriptSelect.value = matchingPreset ? matchingPreset.script : '';
            scriptSelect.dataset.prev = scriptSelect.value;
          }
        }
      });
        scriptGroup.appendChild(scriptSelectLabel);
      scriptGroup.appendChild(presetSelect);
        scriptGroup.appendChild(scriptLabel);
        scriptGroup.appendChild(scriptInput);

        form.appendChild(scriptGroup);
        form.appendChild(axisOpacityGroup);

        const normalizedScript = axisSim.rotationScriptSource ?? defaultScript;
        scriptInput.value = normalizedScript;
        scriptInput.dataset.prev = normalizedScript;
        const matchingPreset = presets.find((preset) => preset.script === normalizedScript);
        scriptSelect.value = matchingPreset ? matchingPreset.script : '';
        scriptSelect.dataset.prev = scriptSelect.value;
      }

      if (isRgp) {
        const dexelButton = document.createElement('button');
        dexelButton.type = 'button';
        dexelButton.textContent = 'Spawn Dexel';
        dexelButton.className = 'properties-button';
        dexelButton.addEventListener('click', () => {
          app.selectSimObject(simObject.id);
          app.spawnDexelForSelectedRgp();
        });
        form.appendChild(dexelButton);
      }
    }

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

    if (!isTwirlingAxis && !isRgp) {
      const opacityGroup = document.createElement('div');
      opacityGroup.className = 'properties-group';
      const opacityLabel = document.createElement('label');
      opacityLabel.className = 'properties-label';
      opacityLabel.textContent = 'Opacity Gradient';
      opacityLabel.htmlFor = `properties-opacity-${simObject.id}`;
      opacitySlider = document.createElement('input');
      opacitySlider.type = 'range';
      opacitySlider.id = `properties-opacity-${simObject.id}`;
      opacitySlider.min = '0';
      opacitySlider.max = '1';
      opacitySlider.step = '0.05';
      opacitySlider.className = 'sim-speed-slider';
      opacitySlider.value = simObject.opacity.toString();
      opacityValue = document.createElement('span');
      opacityValue.className = 'properties-shading-value';
      opacityValue.textContent = simObject.opacity.toFixed(2);
      opacitySlider.addEventListener('input', () => {
        if (!opacitySlider || !opacityValue) {
          return;
        }
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
      shadingSlider = document.createElement('input');
      shadingSlider.type = 'range';
      shadingSlider.id = `properties-shading-${simObject.id}`;
      shadingSlider.min = '0';
      shadingSlider.max = '1';
      shadingSlider.step = '0.05';
      shadingSlider.className = 'sim-speed-slider';
      shadingValue = document.createElement('span');
      shadingValue.className = 'properties-shading-value';
      const initialShading = simObject.shadingIntensity ?? app.getShadingIntensity();
      shadingSlider.value = initialShading.toString();
      shadingValue.textContent = initialShading.toFixed(2);
      shadingSlider.addEventListener('input', () => {
        if (!shadingSlider || !shadingValue) {
          return;
        }
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

      form.appendChild(opacityGroup);
      form.appendChild(shadingGroup);
    }

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
      planeYG: planeYG?.input,
      planeGB: planeGB?.input,
      planeYB: planeYB?.input,
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
      sizeInput,
      scriptInput,
      scriptSelect,
      sphereOpacitySlider,
      sphereOpacityValue,
      primaryShadingSlider,
      primaryShadingValue,
      primaryOpacitySlider,
      primaryOpacityValue,
      secondaryShadingSlider,
      secondaryShadingValue,
      secondaryOpacitySlider,
      secondaryOpacityValue,
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
    controls.speedInput.disabled = simObject.type === 'rgpXY';

    if (
      controls.planeYG &&
      controls.planeGB &&
      controls.planeYB &&
      (simObject.type === 'sphere' || simObject.type === 'twirl')
    ) {
      controls.planeYG.checked = simObject.plane === 'YG';
      controls.planeGB.checked = simObject.plane === 'GB';
      controls.planeYB.checked = simObject.plane === 'YB';
    }

    if (controls.shellInput && (simObject.type === 'sphere' || simObject.type === 'twirl')) {
      controls.shellInput.value = String(simObject.shellSize);
      controls.shellInput.dataset.prev = controls.shellInput.value;
    }

    if (controls.baseColorSelect && (simObject.type === 'sphere' || simObject.type === 'twirl')) {
      controls.baseColorSelect.value = simObject.baseColor;
    }

    if (
      controls.shadingSlider &&
      controls.shadingValue &&
      (simObject.type === 'sphere' || simObject.type === 'twirl')
    ) {
      const shading = simObject.shadingIntensity ?? app.getShadingIntensity();
      controls.shadingSlider.value = shading.toString();
      controls.shadingValue.textContent = shading.toFixed(2);
    }

    if (controls.opacitySlider && controls.opacityValue) {
      if (simObject.type === 'twirling-axis') {
        controls.opacitySlider.value = simObject.opacity.toFixed(2);
        controls.opacityValue.textContent = simObject.opacity.toFixed(2);
      } else if (simObject.type === 'sphere' || simObject.type === 'twirl') {
        controls.opacitySlider.value = simObject.opacity.toFixed(2);
        controls.opacityValue.textContent = simObject.opacity.toFixed(2);
      }
    }

    if (controls.beltInput) {
      const beltValue = simObject.type === 'twirl' ? simObject.beltHalfAngle : 0;
      controls.beltInput.value = beltValue.toFixed(2);
    }

    if (controls.pulseInput) {
      const pulseValue = simObject.type === 'twirl' ? simObject.pulseSpeed : 0;
      controls.pulseInput.value = pulseValue.toFixed(2);
    }

    if (controls.sizeInput) {
      const value = simObject.type === 'twirling-axis' || simObject.type === 'rgpXY' ? simObject.size : 1;
      controls.sizeInput.value = value.toFixed(2);
      controls.sizeInput.dataset.prev = controls.sizeInput.value;
    }

    if (controls.sphereOpacitySlider && controls.sphereOpacityValue) {
      if (simObject.type === 'rgpXY') {
        controls.sphereOpacitySlider.value = simObject.sphereOpacity.toFixed(2);
        controls.sphereOpacitySlider.dataset.prev = controls.sphereOpacitySlider.value;
        controls.sphereOpacityValue.textContent = simObject.sphereOpacity.toFixed(2);
        controls.sphereOpacitySlider.disabled = false;
      } else {
        const defaultSphereOpacity = app.getDefaultRgpSphereOpacity();
        controls.sphereOpacitySlider.value = defaultSphereOpacity.toFixed(2);
        controls.sphereOpacitySlider.dataset.prev = controls.sphereOpacitySlider.value;
        controls.sphereOpacityValue.textContent = defaultSphereOpacity.toFixed(2);
        controls.sphereOpacitySlider.disabled = true;
      }
    }

    if (controls.primaryShadingSlider && controls.primaryShadingValue) {
      if (simObject.type === 'rgpXY') {
        controls.primaryShadingSlider.value = simObject.primary.shadingIntensity.toFixed(2);
        controls.primaryShadingValue.textContent = simObject.primary.shadingIntensity.toFixed(2);
        controls.primaryShadingSlider.disabled = false;
      } else {
        controls.primaryShadingSlider.value = '0.00';
        controls.primaryShadingValue.textContent = '0.00';
        controls.primaryShadingSlider.disabled = true;
      }
    }

    if (controls.primaryOpacitySlider && controls.primaryOpacityValue) {
      if (simObject.type === 'rgpXY') {
        controls.primaryOpacitySlider.value = simObject.primary.opacity.toFixed(2);
        controls.primaryOpacityValue.textContent = simObject.primary.opacity.toFixed(2);
        controls.primaryOpacitySlider.disabled = false;
      } else {
        controls.primaryOpacitySlider.value = '0.00';
        controls.primaryOpacityValue.textContent = '0.00';
        controls.primaryOpacitySlider.disabled = true;
      }
    }

    if (controls.secondaryShadingSlider && controls.secondaryShadingValue) {
      if (simObject.type === 'rgpXY') {
        controls.secondaryShadingSlider.value = simObject.secondary.shadingIntensity.toFixed(2);
        controls.secondaryShadingValue.textContent = simObject.secondary.shadingIntensity.toFixed(2);
        controls.secondaryShadingSlider.disabled = false;
      } else {
        controls.secondaryShadingSlider.value = '0.00';
        controls.secondaryShadingValue.textContent = '0.00';
        controls.secondaryShadingSlider.disabled = true;
      }
    }

    if (controls.secondaryOpacitySlider && controls.secondaryOpacityValue) {
      if (simObject.type === 'rgpXY') {
        controls.secondaryOpacitySlider.value = simObject.secondary.opacity.toFixed(2);
        controls.secondaryOpacityValue.textContent = simObject.secondary.opacity.toFixed(2);
        controls.secondaryOpacitySlider.disabled = false;
      } else {
        controls.secondaryOpacitySlider.value = '0.00';
        controls.secondaryOpacityValue.textContent = '0.00';
        controls.secondaryOpacitySlider.disabled = true;
      }
    }

    if (controls.scriptInput) {
      if (simObject.type === 'twirling-axis') {
        controls.scriptInput.value = simObject.rotationScriptSource;
        controls.scriptInput.dataset.prev = controls.scriptInput.value;
      } else {
        const defaultScript = app.getDefaultTwirlingAxisScript();
        controls.scriptInput.value = defaultScript;
        controls.scriptInput.dataset.prev = defaultScript;
      }
    }

    if (controls.scriptSelect) {
      if (simObject.type === 'twirling-axis') {
        const presets = app.getTwirlingAxisScriptPresets();
        const match = presets.find((preset) => preset.script === simObject.rotationScriptSource);
        controls.scriptSelect.value = match ? match.script : '';
        controls.scriptSelect.dataset.prev = controls.scriptSelect.value;
      } else {
        controls.scriptSelect.value = '';
        controls.scriptSelect.dataset.prev = '';
      }
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
