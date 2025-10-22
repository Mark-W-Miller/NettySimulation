// main.ts — bootstraps the NettySimulation app and logs readiness
import './styles/app.css';
import { App } from './app/App';

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Root element #app not found in document.');
}

const app = new App();
app.mount(rootElement);

console.log('NettySimulation ready');
