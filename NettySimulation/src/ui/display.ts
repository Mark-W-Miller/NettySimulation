// display.ts — builds the Display tab UI for scene visibility controls
import { App } from '../app/App';

export function createDisplayTab(app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'display-tab';

  const checkboxRow = document.createElement('label');
  checkboxRow.className = 'tab-panel__checkbox';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = app.isAxisVisible();
  checkbox.id = 'display-tab-show-axis';
  checkbox.addEventListener('change', () => {
    app.setAxisVisible(checkbox.checked);
  });

  const labelText = document.createElement('span');
  labelText.textContent = 'Show Axis';

  checkboxRow.appendChild(checkbox);
  checkboxRow.appendChild(labelText);

  container.appendChild(checkboxRow);

  return container;
}
