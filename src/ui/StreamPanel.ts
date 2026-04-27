import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/List.js';
import '@ui5/webcomponents/dist/StandardListItem.js';
import '@ui5/webcomponents/dist/Button.js';
import type { StreamEntry } from '../config/types.js';

const MAX_ENTRIES = 50;

export class StreamPanel {
  readonly element: HTMLElement;
  private entries: StreamEntry[] = [];
  private sentCount = 0;
  private currentRate = 10;

  private statsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private listContainer!: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 2; min-width: 0;';
    this.element.innerHTML = `
      <ui5-panel header-text="Publishing Stream" style="height: 100%;">
        <div id="stats" style="padding: 0.5rem 1rem; color: var(--sapContent_LabelColor, #6a6d70); font-size: 0.875rem;">
          Sent: 0 &nbsp;|&nbsp; Rate: 10/min
        </div>
        <div id="list-container" style="height: 400px; overflow-y: auto; border-top: 1px solid var(--sapList_BorderColor, #e5e5e5);">
          <ui5-list id="stream-list" separators="Inner"></ui5-list>
        </div>
        <div style="padding: 0.5rem 1rem;">
          <ui5-button id="clear-btn" design="Transparent">Clear</ui5-button>
        </div>
      </ui5-panel>
    `;

    this.statsEl = this.element.querySelector('#stats')!;
    this.listEl = this.element.querySelector('#stream-list')!;
    this.listContainer = this.element.querySelector('#list-container')!;

    this.element.querySelector('#clear-btn')!.addEventListener('click', () => this.clear());
  }

  append(entry: StreamEntry): void {
    if (this.entries.length >= MAX_ENTRIES) {
      this.entries.shift();
      this.listEl.firstElementChild?.remove();
    }
    this.entries.push(entry);

    this.sentCount++;
    const item = document.createElement('ui5-li');
    item.setAttribute('description', entry.detail);
    item.setAttribute('icon', 'message-success');
    item.textContent = entry.label;
    this.listEl.appendChild(item);

    this.listContainer.scrollTop = this.listContainer.scrollHeight;
    this.updateStats();
  }

  updateRate(rate: number): void {
    this.currentRate = rate;
    this.updateStats();
  }

  clear(): void {
    this.entries = [];
    this.sentCount = 0;
    this.listEl.innerHTML = '';
    this.updateStats();
  }

  private updateStats(): void {
    this.statsEl.innerHTML = `Sent: ${this.sentCount} &nbsp;|&nbsp; Rate: ${this.currentRate}/min`;
  }
}
