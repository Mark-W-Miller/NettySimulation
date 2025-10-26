// properties.ts — renders the Properties tab for the selected simulation object
import { App } from '../app/App';

export function createPropertiesTab(app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'properties-tab';

  const header = document.createElement('div');
  header.className = 'properties-header';
  header.textContent = 'Object Properties';

  const status = document.createElement('div');
  status.className = 'properties-status';

  const speedGroup = document.createElement('div');
  speedGroup.className = 'properties-group';

  const speedLabel = document.createElement('label');
  speedLabel.className = 'properties-label';
  speedLabel.textContent = 'Speed per Tick';
  speedLabel.htmlFor = 'properties-speed';

  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.id = 'properties-speed';
  speedInput.min = '0.1';
  speedInput.step = '0.1';
  speedInput.className = 'properties-number';

  const directionGroup = document.createElement('fieldset');
  directionGroup.className = 'properties-fieldset';
  const directionLegend = document.createElement('legend');
  directionLegend.textContent = 'Direction';
  directionGroup.appendChild(directionLegend);

  const directionCW = createRadio('properties-direction', 'cw', 'Clockwise');
  const directionCCW = createRadio('properties-direction', 'ccw', 'Counter Clockwise');
  directionGroup.appendChild(directionCW.wrapper);
  directionGroup.appendChild(directionCCW.wrapper);

  const planeGroup = document.createElement('fieldset');
  planeGroup.className = 'properties-fieldset';
  const planeLegend = document.createElement('legend');
  planeLegend.textContent = 'Spin Plane';
  planeGroup.appendChild(planeLegend);

  const planeYG = createRadio('properties-plane', 'YG', 'Spin about B axis (YG)');
  const planeGB = createRadio('properties-plane', 'GB', 'Spin about Y axis (GB)');
  const planeYB = createRadio('properties-plane', 'YB', 'Spin about G axis (YB)');
  planeGroup.appendChild(planeYG.wrapper);
  planeGroup.appendChild(planeGB.wrapper);
  planeGroup.appendChild(planeYB.wrapper);

  const segmentsGroup = document.createElement('div');
  segmentsGroup.className = 'properties-group';

  const latRow = document.createElement('div');
  latRow.className = 'properties-inline';
  const latLabel = document.createElement('label');
  latLabel.className = 'properties-label';
  latLabel.textContent = 'Latitude Bands';
  latLabel.htmlFor = 'properties-latitude';
  const latInput = document.createElement('input');
  latInput.type = 'number';
  latInput.id = 'properties-latitude';
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
  lonLabel.htmlFor = 'properties-longitude';
  const lonInput = document.createElement('input');
  lonInput.type = 'number';
  lonInput.id = 'properties-longitude';
  lonInput.min = '1';
  lonInput.max = '256';
  lonInput.step = '1';
  lonInput.className = 'properties-number properties-number--compact';
  lonRow.appendChild(lonLabel);
  lonRow.appendChild(lonInput);

  segmentsGroup.appendChild(latRow);
  segmentsGroup.appendChild(lonRow);

  const shadingGroup = document.createElement('div');
  shadingGroup.className = 'properties-group';
  const shadingLabel = document.createElement('label');
  shadingLabel.className = 'properties-label';
  shadingLabel.textContent = 'Shading Intensity';
  shadingLabel.htmlFor = 'properties-shading';
  const shadingSlider = document.createElement('input');
  shadingSlider.type = 'range';
  shadingSlider.id = 'properties-shading';
  shadingSlider.min = '0';
  shadingSlider.max = '1';
  shadingSlider.step = '0.05';
  shadingSlider.className = 'sim-speed-slider';
  const shadingValue = document.createElement('span');
  shadingValue.className = 'properties-shading-value';
  shadingGroup.appendChild(shadingLabel);
  shadingGroup.appendChild(shadingSlider);
  shadingGroup.appendChild(shadingValue);

  speedGroup.appendChild(speedLabel);
  speedGroup.appendChild(speedInput);

  container.appendChild(header);
  container.appendChild(status);
  container.appendChild(speedGroup);
  container.appendChild(directionGroup);
  container.appendChild(planeGroup);
  container.appendChild(segmentsGroup);
  container.appendChild(shadingGroup);

  const applyChanges = () => {
    const selected = app.getSelectedSimObject();
    if (!selected) {
      return;
    }
    const speedValue = Number.parseFloat(speedInput.value);
    const direction = directionCW.input.checked ? 1 : -1;
    let plane: 'YG' | 'GB' | 'YB' = 'YB';
    if (planeYG.input.checked) {
      plane = 'YG';
    } else if (planeGB.input.checked) {
      plane = 'GB';
    }
    app.updateSelectedSimObject({
      speedPerTick: Number.isFinite(speedValue) ? speedValue : selected.speedPerTick,
      direction: direction as 1 | -1,
      plane,
    });
  };

  speedInput.addEventListener('change', applyChanges);
  directionCW.input.addEventListener('change', applyChanges);
  directionCCW.input.addEventListener('change', applyChanges);
  planeYG.input.addEventListener('change', applyChanges);
  planeGB.input.addEventListener('change', applyChanges);
  planeYB.input.addEventListener('change', applyChanges);

  latInput.addEventListener('change', () => {
    const lat = Number.parseInt(latInput.value, 10);
    const current = app.getSphereSegments();
    app.setSphereSegments(Number.isFinite(lat) ? lat : current.lat, current.lon);
  });

  lonInput.addEventListener('change', () => {
    const lon = Number.parseInt(lonInput.value, 10);
    const current = app.getSphereSegments();
    app.setSphereSegments(current.lat, Number.isFinite(lon) ? lon : current.lon);
  });

  shadingSlider.addEventListener('input', () => {
    const value = Number.parseFloat(shadingSlider.value);
    app.setShadingIntensity(Number.isFinite(value) ? value : app.getShadingIntensity());
    shadingValue.textContent = parseFloat(shadingSlider.value).toFixed(2);
  });

  const updateUI = () => {
    const segments = app.getSphereSegments();
    latInput.value = String(segments.lat);
    lonInput.value = String(segments.lon);
    const shading = app.getShadingIntensity();
    shadingSlider.value = shading.toString();
    shadingValue.textContent = shading.toFixed(2);

    const selected = app.getSelectedSimObject();
    if (!selected) {
      status.textContent = 'Select a simulation object to edit its properties.';
      speedInput.value = '';
      speedInput.disabled = true;
      directionCW.input.disabled = true;
      directionCCW.input.disabled = true;
      planeYG.input.disabled = true;
      planeGB.input.disabled = true;
      planeYB.input.disabled = true;
      directionCW.input.checked = false;
      directionCCW.input.checked = false;
      planeYG.input.checked = false;
      planeGB.input.checked = false;
      planeYB.input.checked = false;
      return;
    }

    status.textContent = `Editing: ${selected.id}`;
    speedInput.disabled = false;
    directionCW.input.disabled = false;
    directionCCW.input.disabled = false;
    planeYG.input.disabled = false;
    planeGB.input.disabled = false;
    planeYB.input.disabled = false;

    speedInput.value = selected.speedPerTick.toFixed(2);
    if (selected.direction >= 0) {
      directionCW.input.checked = true;
      directionCCW.input.checked = false;
    } else {
      directionCW.input.checked = false;
      directionCCW.input.checked = true;
    }

    planeYG.input.checked = selected.plane === 'YG';
    planeGB.input.checked = selected.plane === 'GB';
    planeYB.input.checked = selected.plane === 'YB';
  };

  const unsubscribe = app.onSimChange(() => {
    updateUI();
  });

  updateUI();

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
