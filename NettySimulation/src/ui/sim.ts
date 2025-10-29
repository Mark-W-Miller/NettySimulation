// sim.ts — builds the Simulation tab UI for starting/stopping and tuning speed
import { App } from '../app/App';

export function createSimTab(app: App, openPropertiesTab: () => void): HTMLElement {
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

  container.appendChild(controls);
  container.appendChild(speedGroup);

  const segmentLabel = document.createElement('div');
  segmentLabel.className = 'sim-objects-label';
  segmentLabel.textContent = 'Simulation Segments';

  const segmentList = document.createElement('ul');
  segmentList.className = 'sim-objects-list';

  container.appendChild(segmentLabel);
  container.appendChild(segmentList);

  const updateUI = () => {
    const running = app.isSimulationRunning();
    startButton.disabled = running;
    stopButton.disabled = !running;
    const speed = app.getSimulationSpeed();
    speedValue.textContent = `${speed} beats/sec`;
    if (String(speed) !== slider.value) {
      slider.value = String(speed);
    }
  };

  const refreshSegmentList = () => {
    segmentList.innerHTML = '';
    const segments = app.getSimulationSegments();
    const selectedSegment = app.getSelectedSimulationSegmentId();
    for (const segment of segments) {
      const item = document.createElement('li');
      item.textContent = segment.name;
      if (segment.id === selectedSegment) {
        item.classList.add('is-selected');
      }
      item.addEventListener('click', () => {
        if (segment.id !== app.getSelectedSimulationSegmentId()) {
          app.selectSimulationSegment(segment.id);
          const url = new URL(window.location.href);
          url.hash = `segment=${segment.id}`;
          history.pushState({ segment: segment.id }, '', url.toString());
        }
        openPropertiesTab();
      });
      segmentList.appendChild(item);
    }

    if (selectedSegment) {
      const url = new URL(window.location.href);
      url.hash = `segment=${selectedSegment}`;
      history.replaceState({ segment: selectedSegment }, '', url.toString());
    }
  };

  const lastSegment = window.location.hash.match(/#segment=(.+)$/)?.[1];
  if (lastSegment) {
    app.selectSimulationSegment(lastSegment);
    openPropertiesTab();
  }

  const handlePopState = (event: PopStateEvent) => {
    const hashSegment = window.location.hash.match(/#segment=(.+)$/)?.[1];
    if (hashSegment && hashSegment !== app.getSelectedSimulationSegmentId()) {
      app.selectSimulationSegment(hashSegment);
      openPropertiesTab();
    }
  };
  window.addEventListener('popstate', handlePopState);
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

  const unsubscribe = app.onSimChange(() => {
    updateUI();
    refreshSegmentList();
  });

  updateUI();
  refreshSegmentList();

  container.addEventListener('DOMNodeRemoved', () => {
    unsubscribe();
    window.removeEventListener('popstate', handlePopState);
  });

  return container;
}
