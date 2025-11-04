// display.ts — builds the Display tab UI for scene visibility controls
import { App } from '../app/App';
import { showLogWindow } from './logWindow';

type AxisKey = 'x' | 'y' | 'z';

const AXIS_LABELS: Record<AxisKey, string> = {
  x: 'Show X Axis (G)',
  y: 'Show Y Axis (Y)',
  z: 'Show Z Axis (B)',
};

export function createDisplayTab(app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'display-tab';

  const axisGroup = document.createElement('div');
  axisGroup.className = 'display-axis-group';

  const checkboxes: Record<AxisKey, HTMLInputElement> = {
    x: document.createElement('input'),
    y: document.createElement('input'),
    z: document.createElement('input'),
  } as Record<AxisKey, HTMLInputElement>;

  const secondaryAxesRow = document.createElement('label');
  secondaryAxesRow.className = 'tab-panel__checkbox';
  const secondaryCheckbox = document.createElement('input');
  secondaryCheckbox.type = 'checkbox';
  secondaryCheckbox.addEventListener('change', () => {
    app.setSecondaryAxesVisible(secondaryCheckbox.checked);
  });
  const secondaryLabel = document.createElement('span');
  secondaryLabel.textContent = 'Show Secondary Axes';
  secondaryAxesRow.appendChild(secondaryCheckbox);
  secondaryAxesRow.appendChild(secondaryLabel);

  (['x', 'y', 'z'] as AxisKey[]).forEach((axis) => {
    const row = document.createElement('label');
    row.className = 'tab-panel__checkbox';

    const checkbox = checkboxes[axis];
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      app.setAxisVisibility(axis, checkbox.checked);
    });

    const labelText = document.createElement('span');
    labelText.textContent = AXIS_LABELS[axis];

    row.appendChild(checkbox);
    row.appendChild(labelText);
    axisGroup.appendChild(row);
  });

  container.appendChild(axisGroup);
  container.appendChild(secondaryAxesRow);

  const logButton = document.createElement('button');
  logButton.type = 'button';
  logButton.className = 'display-log-button';
  logButton.textContent = 'Open Log Viewer';
  Object.assign(logButton.style, {
    marginTop: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(30, 41, 59, 0.45)',
    color: '#e2e8f0',
    cursor: 'pointer',
  });
  logButton.addEventListener('click', () => {
    showLogWindow();
  });
  container.appendChild(logButton);

  const opacityRow = document.createElement('div');
  opacityRow.className = 'display-axis-opacity';

  const opacityLabel = document.createElement('span');
  opacityLabel.textContent = 'Axis Opacity';
  opacityLabel.className = 'display-axis-opacity__label';

  const opacityValue = document.createElement('span');
  opacityValue.className = 'display-axis-opacity__value';

  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range';
  opacitySlider.min = '0';
  opacitySlider.max = '1';
  opacitySlider.step = '0.01';
  opacitySlider.addEventListener('input', () => {
    const value = Number.parseFloat(opacitySlider.value);
    opacityValue.textContent = `${Math.round(value * 100)}%`;
    app.setAxisOpacity(value);
  });

  opacityRow.appendChild(opacityLabel);
  opacityRow.appendChild(opacitySlider);
  opacityRow.appendChild(opacityValue);
  container.appendChild(opacityRow);

  const radiusRow = document.createElement('div');
  radiusRow.className = 'display-axis-radius';

  const radiusLabel = document.createElement('span');
  radiusLabel.className = 'display-axis-opacity__label';
  radiusLabel.textContent = 'Axis Radius Scale';

  const radiusInput = document.createElement('input');
  radiusInput.type = 'number';
  radiusInput.min = '1';
  radiusInput.max = '64';
  radiusInput.step = '1';
  radiusInput.className = 'display-axis-radius__input';
  radiusInput.addEventListener('change', () => {
    const previous = Number.parseInt(radiusInput.dataset.prev ?? '1', 10);
    const raw = Number.parseInt(radiusInput.value, 10);
    const clamped = Number.isFinite(raw) ? Math.max(1, Math.min(64, raw)) : previous;
    radiusInput.value = String(clamped);
    radiusInput.dataset.prev = radiusInput.value;
    app.setAxisRadiusScale(clamped);
  });

  radiusRow.appendChild(radiusLabel);
  radiusRow.appendChild(radiusInput);
  container.appendChild(radiusRow);

  const updateUI = () => {
    const visibility = app.getAxisVisibility();
    (['x', 'y', 'z'] as AxisKey[]).forEach((axis) => {
      checkboxes[axis].checked = visibility[axis];
    });
    secondaryCheckbox.checked = app.getSecondaryAxesVisible();
    const opacity = app.getAxisOpacity();
    opacitySlider.value = String(opacity);
    opacityValue.textContent = `${Math.round(opacity * 100)}%`;
    const axisRadiusScale = app.getAxisRadiusScale();
    radiusInput.value = String(axisRadiusScale);
    radiusInput.dataset.prev = radiusInput.value;
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
