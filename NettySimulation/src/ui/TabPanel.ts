// TabPanel.ts — manages the right-hand control panel with tabs and collapse toggle

export interface TabConfig {
  id: string;
  label: string;
  render: () => HTMLElement;
  isDefault?: boolean;
}

export class TabPanel {
  public readonly element: HTMLElement;

  private readonly tabsContainer: HTMLElement;
  private readonly bodyContainer: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private open = true;
  private activeTabId: string | null = null;
  private readonly tabs = new Map<
    string,
    {
      button: HTMLButtonElement;
      content: HTMLElement;
    }
  >();

  constructor() {
    this.element = document.createElement('aside');
    this.element.className = 'tab-panel';

    const header = document.createElement('div');
    header.className = 'tab-panel__header';

    this.tabsContainer = document.createElement('div');
    this.tabsContainer.className = 'tab-panel__tabs';

    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'tab-panel__toggle';
    this.toggleButton.setAttribute('aria-label', 'Toggle panel');
    this.toggleButton.addEventListener('click', () => this.toggle());

    header.appendChild(this.tabsContainer);
    header.appendChild(this.toggleButton);
    this.element.appendChild(header);

    this.bodyContainer = document.createElement('div');
    this.bodyContainer.className = 'tab-panel__body';
    this.element.appendChild(this.bodyContainer);

    this.refreshToggleIcon();
  }

  addTab(config: TabConfig): void {
    if (this.tabs.has(config.id)) {
      throw new Error(`Tab with id "${config.id}" already exists`);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-panel__tab';
    button.textContent = config.label;
    button.setAttribute('data-tab-id', config.id);
    button.addEventListener('click', () => this.setActiveTab(config.id));

    const content = config.render();
    content.classList.add('tab-panel__content');
    content.setAttribute('data-tab-content', config.id);
    content.hidden = true;

    this.tabsContainer.appendChild(button);
    this.bodyContainer.appendChild(content);

    this.tabs.set(config.id, { button, content });

    if (this.activeTabId === null || config.isDefault) {
      this.setActiveTab(config.id);
    }
  }

  toggle(force?: boolean): void {
    if (typeof force === 'boolean') {
      this.open = force;
    } else {
      this.open = !this.open;
    }
    this.element.classList.toggle('is-collapsed', !this.open);
    this.bodyContainer.hidden = !this.open;
    this.tabsContainer.classList.toggle('is-disabled', !this.open);
    for (const { button } of this.tabs.values()) {
      button.tabIndex = this.open ? 0 : -1;
    }
    this.refreshToggleIcon();
  }

  setActiveTab(id: string): void {
    if (this.activeTabId === id) {
      return;
    }

    for (const [tabId, { button, content }] of this.tabs.entries()) {
      const isActive = tabId === id;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      content.hidden = !isActive;
    }

    this.activeTabId = id;
  }

  private refreshToggleIcon(): void {
    this.toggleButton.textContent = this.open ? '⟩' : '⟨';
  }
}
