// sim.ts — builds the Simulation tab UI for segment browsing and selection
import { App } from '../app/App';

export function createSimTab(app: App, openPropertiesTab: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'sim-tab';

  const segmentIntro = document.createElement('p');
  segmentIntro.className = 'sim-objects-intro';
  segmentIntro.textContent = 'Choose a simulation segment to load it into the scene.';
  container.appendChild(segmentIntro);

  const segmentLabel = document.createElement('div');
  segmentLabel.className = 'sim-objects-label';
  segmentLabel.textContent = 'Simulation Segments';

  const segmentList = document.createElement('ul');
  segmentList.className = 'sim-objects-list';

  container.appendChild(segmentLabel);
  container.appendChild(segmentList);

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
  const unsubscribe = app.onSimChange(() => {
    refreshSegmentList();
  });

  refreshSegmentList();

  container.addEventListener('DOMNodeRemoved', () => {
    unsubscribe();
    window.removeEventListener('popstate', handlePopState);
  });

  return container;
}
