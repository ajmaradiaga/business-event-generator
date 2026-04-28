import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '../styles.css';
import { BrokerPanel } from './BrokerPanel.js';
import { StreamPanel } from './StreamPanel.js';
import { SolaceClient } from '../broker/SolaceClient.js';
import { pick, filter } from '../generator/DataSampler.js';
import { resolveTopic, build } from '../generator/CloudEventBuilder.js';
import type { LoadedConfig } from '../config/ConfigLoader.js';
import type { EventConfig } from '../config/types.js';

export class App {
  private broker: SolaceClient;
  private brokerPanel: BrokerPanel;
  private streamPanel: StreamPanel;
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentRate = 10;
  private currentEventId: string;
  private config: LoadedConfig;

  constructor(container: HTMLElement, config: LoadedConfig) {
    this.config = config;
    this.currentEventId = config.config.events[0].id;
    this.broker = new SolaceClient();
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

    this.broker.onStatusChange(status => {
      this.brokerPanel.setStatus(status);
      if (status === 'disconnected' || status === 'error') {
        this.stopPublishing();
      }
    });

    this.brokerPanel.onConnect = async params => {
      try {
        await this.broker.connect(params);
      } catch (err) {
        console.error('Connection failed:', err);
      }
    };

    this.brokerPanel.onDisconnect = () => {
      this.stopPublishing();
      this.broker.disconnect();
    };

    this.brokerPanel.onStart = rate => {
      this.currentRate = rate;
      this.startPublishing();
    };

    this.brokerPanel.onStop = () => this.stopPublishing();

    this.brokerPanel.onRateChange = rate => {
      this.currentRate = rate;
      this.streamPanel.updateRate(rate);
      if (this.interval !== null) {
        this.stopPublishing();
        this.startPublishing();
      }
    };

    this.brokerPanel.onEventChange = eventId => {
      this.currentEventId = eventId;
    };
  }

  private startPublishing(): void {
    if (this.interval !== null) clearInterval(this.interval);
    this.brokerPanel.setPublishing(true);
    this.interval = setInterval(() => this.tick(), Math.floor(60000 / this.currentRate));
  }

  private stopPublishing(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.brokerPanel.setPublishing(false);
  }

  private tick(): void {
    const eventConfig = this.config.config.events.find(
      (e: EventConfig) => e.id === this.currentEventId
    );
    if (!eventConfig) return;

    const records = this.config.records.get(this.currentEventId);
    if (!records?.length) return;

    const rawRecord = pick(records) as Record<string, unknown>;
    const filteredData = filter(rawRecord, eventConfig.fields);
    const topic = resolveTopic(eventConfig.topic, rawRecord);
    const cloudEvent = build(filteredData, eventConfig);

    try {
      this.broker.publish(topic, JSON.stringify(cloudEvent));
    } catch (err) {
      console.error('Publish failed:', err);
      this.stopPublishing();
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
    });
  }
}
