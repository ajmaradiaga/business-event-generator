import type { ConnectionStatus } from '../config/types.js';

export interface IPublisher {
  publish(topic: string, payload: string): void;
  disconnect(): void;
  onStatusChange(cb: (status: ConnectionStatus) => void): void;
}
