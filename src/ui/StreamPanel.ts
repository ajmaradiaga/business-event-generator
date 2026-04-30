import '@ui5/webcomponents/dist/Panel.js';
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
          <div id="stream-list"></div>
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
    const item = document.createElement('div');
    item.style.cssText = 'border-bottom: 1px solid var(--sapList_BorderColor, #e5e5e5); cursor: pointer;';

    const badge = entry.broker === 'aem'
      ? `<span style="background:#e8f1ff;color:#0a6ed1;border-radius:3px;padding:1px 6px;font-size:0.75rem;font-weight:600;">AEM</span>`
      : `<span style="background:#e8f7ee;color:#107e3e;border-radius:3px;padding:1px 6px;font-size:0.75rem;font-weight:600;">EMIS</span>`;

    let prettyPayload: string;
    try {
      prettyPayload = JSON.stringify(JSON.parse(entry.payload), null, 2);
    } catch {
      prettyPayload = entry.payload;
    }

    item.innerHTML = `
    <div class="stream-row" style="display:flex;align-items:flex-start;padding:0.6rem 1rem;gap:0.75rem;">
      <span style="margin-top:2px;color:var(--sapPositiveColor,#107e3e);font-size:1rem;">✓</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;color:var(--sapTextColor,#32363a);">${this.escapeHtml(entry.label)}</div>
        <div style="color:var(--sapContent_LabelColor,#6a6d70);font-size:0.8rem;margin-top:2px;">${this.escapeHtml(entry.detail)}</div>
        <div class="stream-topic" style="color:var(--sapLinkColor,#0a6ed1);font-size:0.78rem;margin-top:3px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(entry.topic)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:2px;flex-shrink:0;">
        ${badge}
        <span class="stream-chevron" style="color:var(--sapContent_LabelColor,#6a6d70);font-size:0.9rem;">▸</span>
      </div>
    </div>
    <div class="stream-payload" style="display:none;background:#f7f9ff;border-top:1px solid var(--sapList_BorderColor,#e5e5e5);padding:0.75rem 1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <span style="font-size:0.78rem;color:var(--sapContent_LabelColor,#6a6d70);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">CloudEvent Payload</span>
        <button class="stream-copy-btn" style="padding:0.2rem 0.6rem;border-radius:4px;border:1px solid var(--sapLinkColor,#0a6ed1);background:white;color:var(--sapLinkColor,#0a6ed1);font-size:0.78rem;cursor:pointer;">⎘ Copy</button>
      </div>
      <pre style="margin:0;font-size:0.78rem;line-height:1.5;background:#1e1e2e;color:#cdd6f4;padding:0.75rem;border-radius:4px;overflow-x:auto;white-space:pre;">${this.escapeHtml(prettyPayload)}</pre>
    </div>
  `;

    const row = item.querySelector('.stream-row') as HTMLElement;
    const payloadPanel = item.querySelector('.stream-payload') as HTMLElement;
    const chevron = item.querySelector('.stream-chevron') as HTMLElement;

    const toggleRow = () => {
      const expanded = payloadPanel.style.display !== 'none';
      payloadPanel.style.display = expanded ? 'none' : 'block';
      chevron.textContent = expanded ? '▸' : '▾';
      chevron.style.color = expanded
        ? 'var(--sapContent_LabelColor,#6a6d70)'
        : 'var(--sapLinkColor,#0a6ed1)';
    };

    row.addEventListener('click', toggleRow);
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(); }
    });

    const copyBtn = item.querySelector('.stream-copy-btn') as HTMLButtonElement;
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(entry.payload).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 1500);
      }).catch(() => { /* silent fail in non-secure contexts */ });
    });

    this.listEl.appendChild(item);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
