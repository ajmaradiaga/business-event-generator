import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/Input.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Slider.js';
import '@ui5/webcomponents/dist/Label.js';
import type { EventConfig, BrokerParams, ConnectionStatus } from '../config/types.js';
import { EmisPanel } from './EmisPanel.js';

export class BrokerPanel {
  readonly element: HTMLElement;
  readonly emis: EmisPanel;

  private currentRate = 10;
  private _connected = false;

  onConnect: ((params: BrokerParams) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onStart: ((rate: number) => void) | null = null;
  onStop: (() => void) | null = null;
  onRateChange: ((rate: number) => void) | null = null;
  onEventChange: ((eventId: string) => void) | null = null;

  constructor(eventConfigs: EventConfig[]) {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 1; min-width: 280px; max-width: 360px;';

    this.emis = new EmisPanel(eventConfigs);

    const optionsHtml = eventConfigs
      .map(e => `<ui5-option value="${e.id}">${e.id.replace(/-/g, ' ')}</ui5-option>`)
      .join('');

    this.element.innerHTML = `
      <div class="broker-tabs">
        <button class="broker-tab active" data-tab="aem">AEM Broker</button>
        <button class="broker-tab" data-tab="emis">EMIS</button>
      </div>
      <div id="aem-content">
        <ui5-panel header-text="AEM Broker">
          <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem;">
            <div>
              <ui5-label for="bp-url" required>URL</ui5-label>
              <ui5-input id="bp-url" placeholder="wss://host:443" style="width: 100%;"></ui5-input>
            </div>
            <div>
              <ui5-label for="bp-vpn" required>VPN</ui5-label>
              <ui5-input id="bp-vpn" placeholder="Message VPN" style="width: 100%;"></ui5-input>
            </div>
            <div>
              <ui5-label for="bp-user" required>Username</ui5-label>
              <ui5-input id="bp-user" style="width: 100%;"></ui5-input>
            </div>
            <div>
              <ui5-label for="bp-pass" required>Password</ui5-label>
              <ui5-input id="bp-pass" type="Password" style="width: 100%;"></ui5-input>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <ui5-button id="connect-btn" design="Emphasized">Connect</ui5-button>
              <ui5-button id="disconnect-btn" design="Default" disabled>Disconnect</ui5-button>
            </div>
            <div id="status-badge" style="min-height: 1.5rem;"></div>

            <div>
              <ui5-label for="bp-event">Event Type</ui5-label>
              <ui5-select id="bp-event" style="width: 100%;">${optionsHtml}</ui5-select>
            </div>

            <div>
              <ui5-label>Rate (msg/min): <span id="rate-val">10</span></ui5-label>
              <ui5-slider id="bp-rate" min="1" max="60" value="10" show-tickmarks style="width: 100%;"></ui5-slider>
            </div>

            <div style="display: flex; gap: 0.5rem;">
              <ui5-button id="start-btn" design="Positive" disabled>▶ Start</ui5-button>
              <ui5-button id="stop-btn" design="Negative" disabled>■ Stop</ui5-button>
            </div>
          </div>
        </ui5-panel>
      </div>
      <div id="emis-content" style="display: none;"></div>
    `;

    this.element.querySelector('#emis-content')!.appendChild(this.emis.element);
    this.setupTabListeners();
    this.setupListeners();
  }

  private setupTabListeners(): void {
    this.element.querySelectorAll('.broker-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab;
        this.element.querySelectorAll('.broker-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        (this.element.querySelector('#aem-content') as HTMLElement).style.display =
          tab === 'aem' ? '' : 'none';
        (this.element.querySelector('#emis-content') as HTMLElement).style.display =
          tab === 'emis' ? '' : 'none';
      });
    });
  }

  private val(selector: string): string {
    const el = this.element.querySelector(selector);
    return (el as HTMLInputElement)?.value ?? '';
  }

  private setupListeners(): void {
    this.element.querySelector('#connect-btn')!.addEventListener('click', () => {
      this.onConnect?.({
        url: this.val('#bp-url'),
        vpn: this.val('#bp-vpn'),
        username: this.val('#bp-user'),
        password: this.val('#bp-pass'),
      });
    });

    this.element.querySelector('#disconnect-btn')!.addEventListener('click', () => {
      this.onDisconnect?.();
    });

    this.element.querySelector('#start-btn')!.addEventListener('click', () => {
      this.onStart?.(this.currentRate);
    });

    this.element.querySelector('#stop-btn')!.addEventListener('click', () => {
      this.onStop?.();
    });

    this.element.querySelector('#bp-rate')!.addEventListener('change', (e) => {
      this.currentRate = Number((e.target as HTMLInputElement).value);
      const label = this.element.querySelector('#rate-val');
      if (label) label.textContent = String(this.currentRate);
      this.onRateChange?.(this.currentRate);
    });

    this.element.querySelector('#bp-event')!.addEventListener('change', (e) => {
      const detail = (e as CustomEvent).detail;
      const selectedOption = detail?.selectedOption as HTMLElement | undefined;
      const eventId = selectedOption?.getAttribute('value') ?? '';
      if (eventId) this.onEventChange?.(eventId);
    });
  }

  setStatus(status: ConnectionStatus): void {
    const badge = this.element.querySelector('#status-badge')!;
    const colorMap: Record<ConnectionStatus, string> = {
      idle: '#6a6d70',
      connecting: '#e9730c',
      connected: '#107e3e',
      disconnected: '#6a6d70',
      error: '#bb0000',
    };
    const labelMap: Record<ConnectionStatus, string> = {
      idle: '',
      connecting: '● Connecting…',
      connected: '● Connected',
      disconnected: '○ Disconnected',
      error: '✕ Connection error',
    };
    badge.innerHTML = '';
    const span = document.createElement('span');
    span.style.color = colorMap[status];
    span.style.fontSize = '0.875rem';
    span.textContent = labelMap[status];
    badge.appendChild(span);

    const connectBtn = this.element.querySelector('#connect-btn') as HTMLElement;
    const disconnectBtn = this.element.querySelector('#disconnect-btn') as HTMLElement;
    const startBtn = this.element.querySelector('#start-btn') as HTMLElement;

    this._connected = status === 'connected';
    connectBtn.toggleAttribute('disabled', this._connected);
    disconnectBtn.toggleAttribute('disabled', !this._connected);
    startBtn.toggleAttribute('disabled', !this._connected);
  }

  setPublishing(active: boolean): void {
    const startBtn = this.element.querySelector('#start-btn') as HTMLElement;
    const stopBtn = this.element.querySelector('#stop-btn') as HTMLElement;
    startBtn.toggleAttribute('disabled', active || !this._connected);
    stopBtn.toggleAttribute('disabled', !active);
  }
}
