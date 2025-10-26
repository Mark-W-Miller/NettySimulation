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

  const planeYG = createRadio('properties-plane', 'YG', 'YG pin plane');
  const planeGB = createRadio('properties-plane', 'GB', 'GB spin plane');
  planeGroup.appendChild(planeYG.wrapper);
  planeGroup.appendChild(planeGB.wrapper);

  speedGroup.appendChild(speedLabel);
  speedGroup.appendChild(speedInput);

  container.appendChild(header);
  container.appendChild(status);
  container.appendChild(speedGroup);
  container.appendChild(directionGroup);
  container.appendChild(planeGroup);

  const applyChanges = () => {
    const selected = app.getSelectedSimObject();
    if (!selected) {
      return;
    }
    const speedValue = Number.parseFloat(speedInput.value);
    const direction = directionCW.input.checked ? 1 : -1;
    const plane = planeYG.input.checked ? 'YG' : 'GB';
    app.updateSelectedSimObject({
      speedPerTick: Number.isFinite(speedValue) ? speedValue : selected.speedPerTick,
      direction: direction as 1 | -1,
      plane: plane as 'YG' | 'GB',
    });
  };

  speedInput.addEventListener('change', applyChanges);
  directionCW.input.addEventListener('change', applyChanges);
  directionCCW.input.addEventListener('change', applyChanges);
  planeYG.input.addEventListener('change', applyChanges);
  planeGB.input.addEventListener('change', applyChanges);

  const updateUI = () => {
    const selected = app.getSelectedSimObject();
    if (!selected) {
      status.textContent = 'Select a simulation object to edit its properties.';
      speedInput.value = '';
      speedInput.disabled = true;
      directionCW.input.disabled = true;
      directionCCW.input.disabled = true;
      planeYG.input.disabled = true;
      planeGB.input.disabled = true;
      directionCW.input.checked = false;
      directionCCW.input.checked = false;
      planeYG.input.checked = false;
      planeGB.input.checked = false;
      return;
    }

    status.textContent = `Editing: ${selected.id}`;
    speedInput.disabled = false;
    directionCW.input.disabled = false;
    directionCCW.input.disabled = false;
    planeYG.input.disabled = false;
    planeGB.input.disabled = false;

    speedInput.value = selected.speedPerTick.toFixed(2);
    if (selected.direction >= 0) {
      directionCW.input.checked = true;
      directionCCW.input.checked = false;
    } else {
      directionCW.input.checked = false;
      directionCCW.input.checked = true;
    }

    if (selected.plane === 'YG') {
      planeYG.input.checked = true;
      planeGB.input.checked = false;
    } else {
      planeYG.input.checked = false;
      planeGB.input.checked = true;
    }
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
