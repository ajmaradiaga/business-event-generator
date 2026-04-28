import type { ConnectionStatus } from '../config/types.js';

// connect() is intentionally excluded — connection setup is implementation-specific.
// AEM (SolaceClient) takes BrokerParams; EMIS (EmisClient) takes a service key string.
export interface IPublisher {
  publish(topic: string, payload: string): void;
  disconnect(): void;
  // Single-subscriber: last call overwrites the previous callback.
  onStatusChange(cb: (status: ConnectionStatus) => void): void;
}
