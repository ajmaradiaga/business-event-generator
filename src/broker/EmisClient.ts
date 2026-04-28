import rhea from 'rhea';
import * as ws from 'rhea/lib/ws';
import type { IPublisher } from './IPublisher.js';
import type { ConnectionStatus, EmisServiceKey } from '../config/types.js';

type RheaConnection = {
  on: (event: string, cb: (ctx: { connection: RheaConnection; error?: Error }) => void) => void;
  open_sender: (opts: { target: { address: string } }) => { send: (msg: unknown) => void; detach: () => void };
  close: () => void;
};

export class EmisClient implements IPublisher {
  private statusCb: ((s: ConnectionStatus) => void) | null = null;
  private connection: RheaConnection | null = null;
  private sender: { send: (msg: unknown) => void; detach: () => void } | null = null;

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

    return new Promise((resolve, reject) => {
      const container = rhea.create_container();
      const wsFactory = ws.connect(WebSocket)(key.uri, ['amqp'], {});

      const conn = container.connect({
        connection_details: wsFactory as never,
        username: key.oa2.clientid,
        password: token,
        sasl_mechanisms: 'PLAIN',
      } as never) as unknown as RheaConnection;

      this.connection = conn;

      conn.on('connection_open', (ctx) => {
        this.sender = ctx.connection.open_sender({ target: { address: '' } });
        this.emit('connected');
        resolve();
      });

      conn.on('connection_error', (ctx) => {
        this.emit('error');
        reject(ctx.error ?? new Error('AMQP connection error'));
      });

      conn.on('connection_close', () => {
        this.emit('disconnected');
      });
    });
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
    if (!this.sender) throw new Error('Not connected');
    this.sender.send({
      body: payload,
      properties: {
        to: `topic:${topic}`,
        content_type: 'application/cloudevents+json',
      },
    });
  }

  disconnect(): void {
    this.sender?.detach();
    this.sender = null;
    this.connection?.close();
    this.connection = null;
  }
}
