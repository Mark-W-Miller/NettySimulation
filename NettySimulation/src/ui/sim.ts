// sim.ts — builds the Simulation tab UI for starting/stopping and tuning speed
import { App } from '../app/App';

export function createSimTab(app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'sim-tab';

  const controls = document.createElement('div');
  controls.className = 'sim-controls';

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.textContent = 'Start';
  startButton.className = 'sim-button';

  const stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.textContent = 'Stop';
  stopButton.className = 'sim-button';

  controls.appendChild(startButton);
  controls.appendChild(stopButton);

  const speedGroup = document.createElement('div');
  speedGroup.className = 'sim-speed-group';

  const speedLabel = document.createElement('label');
  speedLabel.className = 'sim-speed-label';
  speedLabel.textContent = 'Speed';
  speedLabel.htmlFor = 'sim-speed-slider';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '60';
  slider.step = '1';
  slider.id = 'sim-speed-slider';
  slider.className = 'sim-speed-slider';
  slider.value = String(app.getSimulationSpeed());

  const speedValue = document.createElement('span');
  speedValue.className = 'sim-speed-value';

  speedGroup.appendChild(speedLabel);
  speedGroup.appendChild(slider);
  speedGroup.appendChild(speedValue);

  const objectListLabel = document.createElement('div');
  objectListLabel.className = 'sim-objects-label';
  objectListLabel.textContent = 'Sim Objects';

  const objectList = document.createElement('ul');
  objectList.className = 'sim-objects-list';

  container.appendChild(controls);
  container.appendChild(speedGroup);
  container.appendChild(objectListLabel);
  container.appendChild(objectList);

  const updateUI = () => {
    const running = app.isSimulationRunning();
    startButton.disabled = running;
    stopButton.disabled = !running;
    speedValue.textContent = `${app.getSimulationSpeed()} beats/sec`;
  };

  const refreshObjectList = () => {
    objectList.innerHTML = '';
    for (const simObject of app.getSimObjects()) {
      const item = document.createElement('li');
      item.textContent = simObject.id;
      objectList.appendChild(item);
    }
  };

  startButton.addEventListener('click', () => {
    app.startSimulation();
    updateUI();
  });

  stopButton.addEventListener('click', () => {
    app.stopSimulation();
    updateUI();
  });

  slider.addEventListener('input', () => {
    const speed = Number.parseInt(slider.value, 10);
    app.setSimulationSpeed(speed);
    updateUI();
  });

  updateUI();
  refreshObjectList();
  requestAnimationFrame(() => {
    refreshObjectList();
    updateUI();
  });

  return container;
}
