import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '../styles.css';
import { BrokerPanel } from './BrokerPanel.js';
import { StreamPanel } from './StreamPanel.js';
import { SolaceClient } from '../broker/SolaceClient.js';
import { EmisClient } from '../broker/EmisClient.js';
import type { IPublisher } from '../broker/IPublisher.js';
import { pick, filter } from '../generator/DataSampler.js';
import { resolveTopic, build } from '../generator/CloudEventBuilder.js';
import type { LoadedConfig } from '../config/ConfigLoader.js';
import type { BrokerType, EventConfig } from '../config/types.js';

export class App {
  private aemBroker: SolaceClient;
  private emisBroker: EmisClient;
  private brokerPanel: BrokerPanel;
  private streamPanel: StreamPanel;
  private config: LoadedConfig;

  private aemInterval: ReturnType<typeof setInterval> | null = null;
  private emisInterval: ReturnType<typeof setInterval> | null = null;

  private aemRate = 10;
  private emisRate = 10;
  private aemEventId: string;
  private emisEventId: string;

  constructor(container: HTMLElement, config: LoadedConfig) {
    this.config = config;
    this.aemEventId = config.config.events[0].id;
    this.emisEventId = config.config.events[0].id;

    this.aemBroker = new SolaceClient();
    this.emisBroker = new EmisClient();
    this.brokerPanel = new BrokerPanel(config.config.events);
    this.streamPanel = new StreamPanel();

    const shellBar = document.createElement('ui5-shellbar');
    shellBar.setAttribute('primary-title', 'Business Event Generator');
    shellBar.setAttribute('secondary-title', 'Demo');

    const panels = document.createElement('div');
    panels.className = 'app-panels';
    panels.appendChild(this.brokerPanel.element);
    panels.appendChild(this.streamPanel.element);

    container.appendChild(shellBar);
    container.appendChild(panels);

    this.wireAem();
    this.wireEmis();
  }

  // ─── AEM wiring ─────────────────────────────────────────────────────────────

  private wireAem(): void {
    this.aemBroker.onStatusChange(status => {
      this.brokerPanel.setStatus(status);
      if (status === 'disconnected' || status === 'error') {
        this.stopAem();
      }
    });

    this.brokerPanel.onConnect = async params => {
      try {
        await this.aemBroker.connect(params);
      } catch (err) {
        console.error('AEM connection failed:', err);
      }
    };

    this.brokerPanel.onDisconnect = () => {
      this.stopAem();
      this.aemBroker.disconnect();
    };

    this.brokerPanel.onStart = rate => {
      this.aemRate = rate;
      this.startAem();
    };

    this.brokerPanel.onStop = () => this.stopAem();

    this.brokerPanel.onRateChange = rate => {
      this.aemRate = rate;
      if (this.aemInterval !== null) {
        this.stopAem();
        this.startAem();
      }
    };

    this.brokerPanel.onEventChange = eventId => {
      this.aemEventId = eventId;
    };
  }

  private startAem(): void {
    if (this.aemInterval !== null) clearInterval(this.aemInterval);
    this.brokerPanel.setPublishing(true);
    this.aemInterval = setInterval(
      () => this.tick(this.aemBroker, 'aem', this.aemEventId, this.aemRate),
      Math.floor(60000 / this.aemRate)
    );
  }

  private stopAem(): void {
    if (this.aemInterval !== null) {
      clearInterval(this.aemInterval);
      this.aemInterval = null;
    }
    this.brokerPanel.setPublishing(false);
  }

  // ─── EMIS wiring ────────────────────────────────────────────────────────────

  private wireEmis(): void {
    this.emisBroker.onStatusChange(status => {
      this.brokerPanel.emis.setStatus(status);
      if (status === 'disconnected' || status === 'error') {
        this.stopEmis();
      }
    });

    this.brokerPanel.emis.onAuthenticate = async serviceKeyJson => {
      try {
        await this.emisBroker.connect(serviceKeyJson);
      } catch (err) {
        console.error('EMIS authentication failed:', err);
      }
    };

    this.brokerPanel.emis.onDisconnect = () => {
      this.stopEmis();
      this.emisBroker.disconnect();
    };

    this.brokerPanel.emis.onStart = rate => {
      this.emisRate = rate;
      this.startEmis();
    };

    this.brokerPanel.emis.onStop = () => this.stopEmis();

    this.brokerPanel.emis.onRateChange = rate => {
      this.emisRate = rate;
      if (this.emisInterval !== null) {
        this.stopEmis();
        this.startEmis();
      }
    };

    this.brokerPanel.emis.onEventChange = eventId => {
      this.emisEventId = eventId;
    };
  }

  private startEmis(): void {
    if (this.emisInterval !== null) clearInterval(this.emisInterval);
    this.brokerPanel.emis.setPublishing(true);
    this.emisInterval = setInterval(
      () => this.tick(this.emisBroker, 'emis', this.emisEventId, this.emisRate),
      Math.floor(60000 / this.emisRate)
    );
  }

  private stopEmis(): void {
    if (this.emisInterval !== null) {
      clearInterval(this.emisInterval);
      this.emisInterval = null;
    }
    this.brokerPanel.emis.setPublishing(false);
  }

  // ─── shared tick ────────────────────────────────────────────────────────────

  private tick(broker: IPublisher, brokerType: BrokerType, eventId: string, _rate: number): void {
    const eventConfig = this.config.config.events.find((e: EventConfig) => e.id === eventId);
    if (!eventConfig) return;

    const records = this.config.records.get(eventId);
    if (!records?.length) return;

    const rawRecord = pick(records) as Record<string, unknown>;
    const filteredData = filter(rawRecord, eventConfig.fields);
    const topic = resolveTopic(eventConfig.topic, rawRecord);
    const cloudEvent = build(filteredData, eventConfig);

    const payloadStr = JSON.stringify(cloudEvent);
    try {
      broker.publish(topic, payloadStr);
    } catch (err) {
      console.error(`${brokerType.toUpperCase()} publish failed:`, err);
      if (brokerType === 'aem') this.stopAem();
      else this.stopEmis();
      return;
    }

    const fullName = String(
      filteredData['BusinessPartnerFullName'] ??
        filteredData[eventConfig.subjectField] ??
        'Unknown'
    );
    const addr = filteredData['BusinessPartnerAddress'] as Record<string, unknown> | undefined;
    const country = addr?.['Country'] ? ` (${addr['Country']})` : '';
    const bpId = String(filteredData[eventConfig.subjectField] ?? '');
    const timeStr = new Date(cloudEvent.time).toLocaleTimeString();

    this.streamPanel.append({
      id: cloudEvent.id,
      label: `${fullName}${country}`,
      detail: `BP: ${bpId} · ${timeStr}`,
      topic,
      broker: brokerType,
      payload: payloadStr,
    });
  }
}
