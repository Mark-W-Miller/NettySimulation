// logWindow.ts — floating log viewer with category filters
import { getCategories, log, LogRecord, subscribe } from '../app/log/db';

interface LogWindowState {
  open: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

const STORAGE_KEY = 'nettysimulation.logWindow';
const DEFAULT_LAYOUT: LogWindowState = {
  open: false,
  left: 72,
  top: 72,
  width: 460,
  height: 320,
};

let layoutState: LogWindowState = loadLayoutState();

let windowElement: HTMLDivElement | null = null;
let logListElement: HTMLDivElement | null = null;
let categoryContainer: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;
let selectedCategories = new Set<string>();
let cachedRecords: ReadonlyArray<LogRecord> = [];
let stylesInjected = false;

export function restoreLogWindow(): void {
  ensureStyles();
  if (!windowElement && layoutState.open) {
    createLogWindow();
  }
  if (layoutState.open) {
    showLogWindow();
  }
}

export function showLogWindow(): void {
  ensureStyles();

  if (!windowElement) {
    createLogWindow();
  }

  if (!windowElement) {
    return;
  }

  applyLayout(windowElement);
  windowElement.style.display = 'flex';
  windowElement.focus();
  if (!layoutState.open) {
    updateLayoutState({ open: true });
    log('ui', 'Log window opened');
  }
}

function ensureStyles(): void {
  if (stylesInjected) {
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
    .log-window {
      position: fixed;
      top: 72px;
      left: 72px;
      width: 460px;
      height: 320px;
      min-width: 320px;
      min-height: 220px;
      background: rgba(17, 24, 39, 0.92);
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.4);
      border-radius: 8px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: hidden;
      z-index: 2000;
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
    }

    .log-window__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.85);
      cursor: move;
      user-select: none;
    }

    .log-window__title {
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #e2e8f0;
    }

    .log-window__close {
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
    }

    .log-window__close:hover {
      color: #f8fafc;
    }

    .log-window__filters {
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.6);
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
    }

    .log-window__filters label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #cbd5f5;
    }

    .log-window__list {
      flex: 1;
      overflow: auto;
      padding: 8px 0 12px 0;
    }

    .log-window__row {
      display: grid;
      grid-template-columns: 86px 80px 1fr;
      gap: 8px;
      padding: 4px 14px;
      font-size: 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .log-window__row:nth-child(odd) {
      background: rgba(15, 23, 42, 0.35);
    }

    .log-window__row time {
      color: #94a3b8;
    }

    .log-window__row-category {
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #38bdf8;
    }

    .log-window__row-message {
      white-space: pre-wrap;
      word-break: break-word;
      color: #e2e8f0;
    }

    .log-window__row--error .log-window__row-message {
      color: #f87171;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

function createLogWindow(): void {
  windowElement = document.createElement('div');
  windowElement.className = 'log-window';
  applyLayout(windowElement);
  windowElement.style.display = layoutState.open ? 'flex' : 'none';

  const header = document.createElement('div');
  header.className = 'log-window__header';
  const title = document.createElement('div');
  title.className = 'log-window__title';
  title.textContent = 'Log Viewer';
  const closeButton = document.createElement('button');
  closeButton.className = 'log-window__close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    if (windowElement) {
      persistBounds();
      windowElement.style.display = 'none';
      if (layoutState.open) {
        updateLayoutState({ open: false });
        log('ui', 'Log window closed');
      }
    }
  });
  header.appendChild(title);
  header.appendChild(closeButton);

  enableDrag(header, windowElement);

  categoryContainer = document.createElement('div');
  categoryContainer.className = 'log-window__filters';

  logListElement = document.createElement('div');
  logListElement.className = 'log-window__list';

  windowElement.appendChild(header);
  windowElement.appendChild(categoryContainer);
  windowElement.appendChild(logListElement);

  document.body.appendChild(windowElement);
  windowElement.addEventListener('pointerup', persistBounds);
  windowElement.addEventListener('pointercancel', persistBounds);

  selectedCategories = new Set(getCategories());
  unsubscribe = subscribe((entries) => {
    cachedRecords = entries;
    refreshCategoryControls();
    renderLogEntries();
  });

  const initialRecords = cachedRecords;
  if (initialRecords.length === 0) {
    cachedRecords = [];
  }
  refreshCategoryControls();
  renderLogEntries();
}

function enableDrag(handle: HTMLElement, target: HTMLElement): void {
  let dragging = false;
  let pointerId: number | null = null;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && target.closest('.log-window__close')) {
      // Allow the close button to receive the click without enabling drag.
      return;
    }
    dragging = true;
    pointerId = event.pointerId;
    offsetX = event.clientX - target.offsetLeft;
    offsetY = event.clientY - target.offsetTop;
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging || pointerId !== event.pointerId) {
      return;
    }
    const newLeft = event.clientX - offsetX;
    const newTop = event.clientY - offsetY;
    const clampedLeft = Math.max(0, newLeft);
    const clampedTop = Math.max(0, newTop);
    target.style.left = `${clampedLeft}px`;
    target.style.top = `${clampedTop}px`;
    updateLayoutState({ left: clampedLeft, top: clampedTop });
  });

  const endDrag = (event: PointerEvent) => {
    if (dragging && pointerId === event.pointerId) {
      dragging = false;
      pointerId = null;
      handle.releasePointerCapture(event.pointerId);
    }
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('pointerup', persistBounds);
  handle.addEventListener('pointercancel', persistBounds);
}

function refreshCategoryControls(): void {
  if (!categoryContainer) {
    return;
  }

  const categories = getCategories();
  for (const category of categories) {
    if (!selectedCategories.has(category)) {
      selectedCategories.add(category);
    }
  }

  categoryContainer.innerHTML = '';
  for (const category of categories) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedCategories.has(category);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedCategories.add(category);
      } else {
        selectedCategories.delete(category);
      }
      renderLogEntries();
    });
    const span = document.createElement('span');
    span.textContent = category;
    label.appendChild(checkbox);
    label.appendChild(span);
    categoryContainer.appendChild(label);
  }
}

function renderLogEntries(): void {
  if (!logListElement) {
    return;
  }
  logListElement.innerHTML = '';

  const filtered = cachedRecords.filter((record) => selectedCategories.has(record.category));
  for (const record of filtered) {
    const row = document.createElement('div');
    row.className = 'log-window__row';
    if (record.level === 'error') {
      row.classList.add('log-window__row--error');
    }

    const timeCell = document.createElement('time');
    timeCell.textContent = new Date(record.timestamp).toLocaleTimeString();
    const categoryCell = document.createElement('div');
    categoryCell.className = 'log-window__row-category';
    categoryCell.textContent = record.category;
    const messageCell = document.createElement('div');
    messageCell.className = 'log-window__row-message';
    messageCell.textContent = record.message;

    row.appendChild(timeCell);
    row.appendChild(categoryCell);
    row.appendChild(messageCell);
    logListElement.appendChild(row);
  }
}

function loadLayoutState(): LogWindowState {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_LAYOUT };
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_LAYOUT };
    }
    const parsed = JSON.parse(stored) as Partial<LogWindowState>;
    return {
      open: Boolean(parsed.open),
      left: Number.isFinite(parsed.left) ? Number(parsed.left) : DEFAULT_LAYOUT.left,
      top: Number.isFinite(parsed.top) ? Number(parsed.top) : DEFAULT_LAYOUT.top,
      width: Number.isFinite(parsed.width) ? Math.max(320, Number(parsed.width)) : DEFAULT_LAYOUT.width,
      height: Number.isFinite(parsed.height) ? Math.max(220, Number(parsed.height)) : DEFAULT_LAYOUT.height,
    };
  } catch (error) {
    console.warn('logWindow: failed to parse layout state', error);
    return { ...DEFAULT_LAYOUT };
  }
}

function updateLayoutState(partial: Partial<LogWindowState>): void {
  layoutState = { ...layoutState, ...partial };
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutState));
  } catch (error) {
    console.warn('logWindow: failed to persist layout state', error);
  }
}

function applyLayout(target: HTMLElement): void {
  target.style.left = `${layoutState.left}px`;
  target.style.top = `${layoutState.top}px`;
  target.style.width = `${layoutState.width}px`;
  target.style.height = `${layoutState.height}px`;
}

function persistBounds(): void {
  if (!windowElement) {
    return;
  }
  updateLayoutState({
    left: Math.max(0, windowElement.offsetLeft),
    top: Math.max(0, windowElement.offsetTop),
    width: Math.max(320, windowElement.offsetWidth),
    height: Math.max(220, windowElement.offsetHeight),
  });
}
