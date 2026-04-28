import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Slider.js';
import '@ui5/webcomponents/dist/Label.js';
import '@ui5/webcomponents/dist/TextArea.js';
import type { EventConfig, ConnectionStatus } from '../config/types.js';

export class EmisPanel {
  readonly element: HTMLElement;
  private currentRate = 10;
  private _connected = false;

  onAuthenticate: ((serviceKeyJson: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onStart: ((rate: number) => void) | null = null;
  onStop: (() => void) | null = null;
  onRateChange: ((rate: number) => void) | null = null;
  onEventChange: ((eventId: string) => void) | null = null;

  constructor(eventConfigs: EventConfig[]) {
    this.element = document.createElement('div');

    const optionsHtml = eventConfigs
      .map(e => `<ui5-option value="${e.id}">${e.id.replace(/-/g, ' ')}</ui5-option>`)
      .join('');

    this.element.innerHTML = `
      <ui5-panel header-text="EMIS Connection">
        <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem;">
          <div>
            <ui5-label for="emis-key">Service Key (JSON)</ui5-label>
            <ui5-textarea
              id="emis-key"
              placeholder='Paste sapmgw service key JSON here...'
              rows="5"
              style="width: 100%; font-family: monospace; font-size: 0.8rem;"
            ></ui5-textarea>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <ui5-button id="emis-auth-btn" design="Emphasized">Authenticate</ui5-button>
            <ui5-button id="emis-disc-btn" design="Default" disabled>Disconnect</ui5-button>
          </div>
          <div id="emis-status-badge" style="min-height: 1.5rem;"></div>

          <div>
            <ui5-label for="emis-event">Event Type</ui5-label>
            <ui5-select id="emis-event" style="width: 100%;">${optionsHtml}</ui5-select>
          </div>

          <div>
            <ui5-label>Rate (msg/min): <span id="emis-rate-val">10</span></ui5-label>
            <ui5-slider id="emis-rate" min="1" max="60" value="10" show-tickmarks style="width: 100%;"></ui5-slider>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <ui5-button id="emis-start-btn" design="Positive" disabled>▶ Start</ui5-button>
            <ui5-button id="emis-stop-btn" design="Negative" disabled>■ Stop</ui5-button>
          </div>
        </div>
      </ui5-panel>
    `;

    this.setupListeners();
  }

  private val(selector: string): string {
    const el = this.element.querySelector(selector);
    return (el as HTMLInputElement)?.value ?? '';
  }

  private setupListeners(): void {
    this.element.querySelector('#emis-auth-btn')!.addEventListener('click', () => {
      this.onAuthenticate?.(this.val('#emis-key'));
    });

    this.element.querySelector('#emis-disc-btn')!.addEventListener('click', () => {
      this.onDisconnect?.();
    });

    this.element.querySelector('#emis-start-btn')!.addEventListener('click', () => {
      this.onStart?.(this.currentRate);
    });

    this.element.querySelector('#emis-stop-btn')!.addEventListener('click', () => {
      this.onStop?.();
    });

    this.element.querySelector('#emis-rate')!.addEventListener('change', (e) => {
      this.currentRate = Number((e.target as HTMLInputElement).value);
      const label = this.element.querySelector('#emis-rate-val');
      if (label) label.textContent = String(this.currentRate);
      this.onRateChange?.(this.currentRate);
    });

    this.element.querySelector('#emis-event')!.addEventListener('change', (e) => {
      const detail = (e as CustomEvent).detail;
      const selectedOption = detail?.selectedOption as HTMLElement | undefined;
      const eventId = selectedOption?.getAttribute('value') ?? '';
      if (eventId) this.onEventChange?.(eventId);
    });
  }

  setStatus(status: ConnectionStatus): void {
    const badge = this.element.querySelector('#emis-status-badge')!;
    const colorMap: Record<ConnectionStatus, string> = {
      idle: '#6a6d70',
      connecting: '#e9730c',
      connected: '#107e3e',
      disconnected: '#6a6d70',
      error: '#bb0000',
    };
    const labelMap: Record<ConnectionStatus, string> = {
      idle: '',
      connecting: '● Authenticating…',
      connected: '● Authenticated',
      disconnected: '○ Disconnected',
      error: '✕ Authentication error',
    };
    badge.innerHTML = '';
    const span = document.createElement('span');
    span.style.color = colorMap[status];
    span.style.fontSize = '0.875rem';
    span.textContent = labelMap[status];
    badge.appendChild(span);

    const authBtn = this.element.querySelector('#emis-auth-btn') as HTMLElement;
    const discBtn = this.element.querySelector('#emis-disc-btn') as HTMLElement;
    const startBtn = this.element.querySelector('#emis-start-btn') as HTMLElement;

    this._connected = status === 'connected';
    authBtn.toggleAttribute('disabled', this._connected);
    discBtn.toggleAttribute('disabled', !this._connected);
    startBtn.toggleAttribute('disabled', !this._connected);
  }

  setPublishing(active: boolean): void {
    const startBtn = this.element.querySelector('#emis-start-btn') as HTMLElement;
    const stopBtn = this.element.querySelector('#emis-stop-btn') as HTMLElement;
    startBtn.toggleAttribute('disabled', active || !this._connected);
    stopBtn.toggleAttribute('disabled', !active);
  }
}
