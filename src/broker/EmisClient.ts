import type { IPublisher } from './IPublisher.js';
import type { ConnectionStatus, EmisServiceKey } from '../config/types.js';

export class EmisClient implements IPublisher {
  private statusCb: ((s: ConnectionStatus) => void) | null = null;

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
    // rhea connect in Task 4
    void token;
  }

  private async fetchToken(key: EmisServiceKey): Promise<string> {
    const credentials = btoa(`${key.oa2.clientid}:${key.oa2.clientsecret}`);
    let response: Response;
    try {
      response = await fetch(key.oa2.tokenendpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
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

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  publish(_topic: string, _payload: string): void {
    // implemented in Task 4
  }

  disconnect(): void {
    // implemented in Task 4
  }
}
