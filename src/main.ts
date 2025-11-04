// main.ts — bootstraps the NettySimulation app and logs readiness
import './styles/app.css';
import { App } from './app/App';
import { TabPanel } from './ui/TabPanel';
import { createDisplayTab } from './ui/display';
import { createSimTab } from './ui/sim';
import { createPropertiesTab } from './ui/properties';

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Root element #app not found in document.');
}

const app = new App();

const shell = document.createElement('div');
shell.className = 'app-shell';

const sceneHost = document.createElement('div');
sceneHost.className = 'scene-host';
shell.appendChild(sceneHost);

const panel = new TabPanel();
panel.addTab({
  id: 'display',
  label: 'Display',
  render: () => createDisplayTab(app),
});

panel.addTab({
  id: 'sim',
  label: 'Sim',
  isDefault: true,
  render: () => createSimTab(app, () => panel.setActiveTab('properties')),
});

panel.addTab({
  id: 'properties',
  label: 'Properties',
  render: () => createPropertiesTab(app),
});

shell.appendChild(panel.element);

rootElement.innerHTML = '';
rootElement.appendChild(shell);

app.mount(sceneHost);

console.log('NettySimulation ready');
