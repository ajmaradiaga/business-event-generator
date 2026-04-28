import type { IPublisher } from './IPublisher.js';
import type { ConnectionStatus, EmisServiceKey } from '../config/types.js';

export class EmisClient implements IPublisher {
  private statusCb: ((s: ConnectionStatus) => void) | null = null;
  private token: string | null = null;
  private baseUrl: string | null = null;

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCb = cb;
  }

  private emit(status: ConnectionStatus): void {
    this.statusCb?.(status);
  }

  async connect(serviceKeyJson: string): Promise<void> {
    let key: EmisServiceKey;
    try {
      key = JSON.parse(serviceKeyJson) as EmisServiceKey;
    } catch {
      this.emit('error');
      throw new Error('Invalid service key JSON');
    }

    if (!key?.oa2?.tokenendpoint || !key?.oa2?.clientid || !key?.oa2?.clientsecret || !key?.uri) {
      this.emit('error');
      throw new Error('Service key missing required fields (oa2.tokenendpoint, oa2.clientid, oa2.clientsecret, uri)');
    }

    this.emit('connecting');
    const token = await this.fetchToken(key);
    this.token = token;
    this.baseUrl = key.uri;
    this.emit('connected');
  }

  private async fetchToken(key: EmisServiceKey): Promise<string> {
    const credentials = btoa(`${key.oa2.clientid}:${key.oa2.clientsecret}`);
    let response: Response;
    try {
      response = await fetch(key.oa2.tokenendpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      this.emit('error');
      throw err;
    }

    if (!response.ok) {
      this.emit('error');
      const body = await response.text().catch(() => '');
      throw new Error(`Token fetch failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  publish(topic: string, payload: string): void {
    if (!this.token || !this.baseUrl) throw new Error('Not connected');

    const targetUrl = `${this.baseUrl}/messagingrest/v1/topics/${encodeURIComponent(topic)}/messages`;
    // In dev mode, route through the local Vite proxy to avoid CORS
    const url = import.meta.env.DEV
      ? `/emis-proxy?target=${encodeURIComponent(targetUrl)}`
      : targetUrl;

    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/cloudevents+json',
        'x-qos': '0',
      },
      body: payload,
    }).then(res => {
      if (res.status === 401) {
        this.token = null;
        this.emit('error');
      }
    }).catch(err => {
      console.error('[EmisClient] publish error:', err);
    });
  }

  disconnect(): void {
    this.token = null;
    this.baseUrl = null;
    this.emit('disconnected');
  }
}
