import * as solace from 'solclientjs';
import type { BrokerParams, ConnectionStatus } from '../config/types.js';

export class SolaceClient {
  private session: solace.Session | null = null;
  private statusCb: ((s: ConnectionStatus) => void) | null = null;

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCb = cb;
  }

  private emit(status: ConnectionStatus): void {
    this.statusCb?.(status);
  }

  connect(params: BrokerParams): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const props = new solace.SolclientFactoryProperties();
        props.profile = solace.SolclientFactoryProfiles.version10_5;
        solace.SolclientFactory.init(props);
      } catch {
        // Already initialized
      }

      this.emit('connecting');

      this.session = solace.SolclientFactory.createSession({
        url: params.url,
        vpnName: params.vpn,
        userName: params.username,
        password: params.password,
      });

      this.session.on(solace.SessionEventCode.UP_NOTICE, () => {
        this.emit('connected');
        resolve();
      });

      this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e: unknown) => {
        this.emit('error');
        const infoStr = (e as { infoStr?: string } | undefined)?.infoStr;
        reject(new Error(infoStr ?? 'Connection failed'));
      });

      this.session.on(solace.SessionEventCode.DISCONNECTED, () => {
        this.emit('disconnected');
      });

      try {
        this.session.connect();
      } catch (err) {
        this.emit('error');
        reject(err);
      }
    });
  }

  publish(topic: string, payload: string): void {
    if (!this.session) throw new Error('Not connected');
    const msg = solace.SolclientFactory.createMessage();
    msg.setDestination(solace.SolclientFactory.createTopicDestination(topic));
    msg.setBinaryAttachment(payload);
    msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
    this.session.send(msg);
  }

  disconnect(): void {
    this.session?.disconnect();
    this.session = null;
  }
}
