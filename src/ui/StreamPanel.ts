import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/List.js';
import '@ui5/webcomponents/dist/ListItemStandard.js';
import '@ui5/webcomponents/dist/Button.js';
import type { StreamEntry, BrokerType } from '../config/types.js';

const MAX_ENTRIES = 50;

type Filter = 'all' | BrokerType;

export class StreamPanel {
  readonly element: HTMLElement;
  private entries: StreamEntry[] = [];
  private aemCount = 0;
  private emisCount = 0;
  private activeFilter: Filter = 'all';

  private statsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private listContainer!: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 2; min-width: 0;';
    this.element.innerHTML = `
      <ui5-panel header-text="Publishing Stream" style="height: 100%;">
        <div class="stream-filter">
          <button class="stream-filter-btn active" data-filter="all">All</button>
          <button class="stream-filter-btn" data-filter="aem">AEM</button>
          <button class="stream-filter-btn" data-filter="emis">EMIS</button>
        </div>
        <div id="stats" style="padding: 0.5rem 1rem; color: var(--sapContent_LabelColor, #6a6d70); font-size: 0.875rem;">
          AEM: 0 &nbsp;|&nbsp; EMIS: 0 &nbsp;|&nbsp; Total: 0
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

    this.element.querySelectorAll('.stream-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFilter = (btn as HTMLElement).dataset.filter as Filter;
        this.element.querySelectorAll('.stream-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.rerender();
      });
    });
  }

  append(entry: StreamEntry): void {
    if (this.entries.length >= MAX_ENTRIES) {
      this.entries.shift();
    }
    this.entries.push(entry);

    if (entry.broker === 'aem') this.aemCount++;
    else this.emisCount++;

    if (this.activeFilter === 'all' || this.activeFilter === entry.broker) {
      this.renderItem(entry);
      const visibleItems = this.listEl.children;
      if (visibleItems.length > MAX_ENTRIES) {
        visibleItems[0].remove();
      }
      this.listContainer.scrollTop = this.listContainer.scrollHeight;
    }

    this.updateStats();
  }

  private renderItem(entry: StreamEntry): void {
    const item = document.createElement('ui5-li');
    item.setAttribute('description', entry.detail);
    item.setAttribute('icon', 'message-success');
    item.setAttribute('additional-text', entry.broker === 'aem' ? 'AEM' : 'EMIS');
    item.setAttribute('additional-text-state', entry.broker === 'aem' ? 'Information' : 'Positive');
    item.textContent = entry.label;
    this.listEl.appendChild(item);
  }

  private rerender(): void {
    this.listEl.innerHTML = '';
    const visible = this.activeFilter === 'all'
      ? this.entries
      : this.entries.filter(e => e.broker === this.activeFilter);
    visible.forEach(e => this.renderItem(e));
    this.listContainer.scrollTop = this.listContainer.scrollHeight;
  }

  clear(): void {
    this.entries = [];
    this.aemCount = 0;
    this.emisCount = 0;
    this.listEl.innerHTML = '';
    this.updateStats();
  }

  private updateStats(): void {
    this.statsEl.innerHTML =
      `AEM: ${this.aemCount} &nbsp;|&nbsp; EMIS: ${this.emisCount} &nbsp;|&nbsp; Total: ${this.aemCount + this.emisCount}`;
  }
}
