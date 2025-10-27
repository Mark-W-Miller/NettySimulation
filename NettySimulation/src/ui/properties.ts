// properties.ts — renders the Properties tab as expandable editors for each sim object
import { App } from '../app/App';

type ObjectUpdate = Parameters<App['updateSelectedSimObject']>[0];

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

  const openObjects = new Set<string>();

  const renderObjects = () => {
    list.innerHTML = '';

    const simObjects = app.getSimObjects();
    const shading = app.getShadingIntensity();
    const segments = app.getSphereSegments();
    const existingIds = new Set(simObjects.map((object) => object.id));
    for (const id of Array.from(openObjects)) {
      if (!existingIds.has(id)) {
        openObjects.delete(id);
      }
    }
    const selectedId = app.getSelectedSimObject()?.id ?? null;
    if (selectedId) {
      openObjects.add(selectedId);
    }

    if (simObjects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'properties-empty';
      empty.textContent = 'No simulation objects available.';
      list.appendChild(empty);
      return;
    }

    for (const simObject of simObjects) {
      const details = document.createElement('details');
      details.className = 'properties-object';
      if (openObjects.has(simObject.id)) {
        details.open = true;
      }
      if (simObject.id === selectedId) {
        details.classList.add('is-selected');
      }

      details.addEventListener('toggle', () => {
        if (details.open) {
          openObjects.add(simObject.id);
          app.selectSimObject(simObject.id);
        } else {
          openObjects.delete(simObject.id);
        }
      });

      const summary = document.createElement('summary');
      summary.className = 'properties-object-summary';
      summary.textContent = simObject.id;
      summary.addEventListener('click', () => {
        app.selectSimObject(simObject.id);
      });
      details.appendChild(summary);

      const form = document.createElement('div');
      form.className = 'properties-object-form';

      const applyUpdate = (update: ObjectUpdate) => {
        app.selectSimObject(simObject.id);
        app.updateSelectedSimObject(update);
      };

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
      speedInput.addEventListener('change', () => {
        const value = Number.parseFloat(speedInput.value);
        if (!Number.isFinite(value)) {
          speedInput.value = simObject.speedPerTick.toFixed(2);
          return;
        }
        applyUpdate({ speedPerTick: value });
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
      directionCW.input.checked = simObject.direction >= 0;
      directionCCW.input.checked = simObject.direction < 0;
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
      planeYG.input.checked = simObject.plane === 'YG';
      planeGB.input.checked = simObject.plane === 'GB';
      planeYB.input.checked = simObject.plane === 'YB';
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
      shadingSlider.value = shading.toString();
      const shadingValue = document.createElement('span');
      shadingValue.className = 'properties-shading-value';
      shadingValue.textContent = shading.toFixed(2);
      shadingSlider.addEventListener('input', () => {
        const value = Number.parseFloat(shadingSlider.value);
        const clamped = Number.isFinite(value) ? value : app.getShadingIntensity();
        app.setShadingIntensity(clamped);
        shadingValue.textContent = clamped.toFixed(2);
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
      latInput.value = String(segments.lat);
      latInput.addEventListener('change', () => {
        const lat = Number.parseInt(latInput.value, 10);
        const current = app.getSphereSegments();
        const nextLat = Number.isFinite(lat) ? lat : current.lat;
        app.setSphereSegments(nextLat, current.lon);
        latInput.value = String(app.getSphereSegments().lat);
      });
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
      lonInput.value = String(segments.lon);
      lonInput.addEventListener('change', () => {
        const lon = Number.parseInt(lonInput.value, 10);
        const current = app.getSphereSegments();
        const nextLon = Number.isFinite(lon) ? lon : current.lon;
        app.setSphereSegments(current.lat, nextLon);
        lonInput.value = String(app.getSphereSegments().lon);
      });
      lonRow.appendChild(lonLabel);
      lonRow.appendChild(lonInput);

      segmentsGroup.appendChild(latRow);
      segmentsGroup.appendChild(lonRow);

      form.appendChild(speedGroup);
      form.appendChild(directionGroup);
      form.appendChild(planeGroup);
      form.appendChild(shadingGroup);
      form.appendChild(segmentsGroup);
      details.appendChild(form);

      list.appendChild(details);
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
