import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConnectionStatus } from '../config/types.js';

// Track session event handlers so tests can trigger them
let handlers: Record<string | number, () => void> = {};
let mockSession: {
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};
let mockMessage: {
  setDestination: ReturnType<typeof vi.fn>;
  setBinaryAttachment: ReturnType<typeof vi.fn>;
  setDeliveryMode: ReturnType<typeof vi.fn>;
};

vi.mock('solclientjs', () => {
  mockSession = {
    on: vi.fn().mockImplementation((code: string | number, cb: () => void) => {
      handlers[code] = cb;
    }),
    connect: vi.fn().mockImplementation(() => {
      // Simulate async UP_NOTICE
      setTimeout(() => handlers[0]?.(), 0);
    }),
    disconnect: vi.fn(),
    send: vi.fn(),
  };
  mockMessage = {
    setDestination: vi.fn(),
    setBinaryAttachment: vi.fn(),
    setDeliveryMode: vi.fn(),
  };
  return {
    SolclientFactoryProperties: class {
      profile: unknown;
    },
    SolclientFactoryProfiles: { version10_5: 'v10.5' },
    SolclientFactory: {
      init: vi.fn(),
      createSession: vi.fn(() => mockSession),
      createMessage: vi.fn(() => mockMessage),
      createTopicDestination: vi.fn((t: string) => ({ name: t })),
    },
    SessionEventCode: { UP_NOTICE: 0, CONNECT_FAILED_ERROR: 1, DISCONNECTED: 2 },
    MessageDeliveryModeType: { DIRECT: 0 },
  };
});

describe('SolaceClient', () => {
  beforeEach(() => {
    handlers = {};
    vi.clearAllMocks();
    // Restore default on implementation (registers handlers by code)
    if (mockSession) {
      mockSession.on.mockImplementation((code: string | number, cb: () => void) => {
        handlers[code] = cb;
      });
      // Restore default connect implementation (fires UP_NOTICE)
      mockSession.connect.mockImplementation(() => {
        setTimeout(() => handlers[0]?.(), 0);
      });
    }
  });

  it('sets status to connecting then connected on successful connect', async () => {
    const { SolaceClient } = await import('./SolaceClient.js');
    const client = new SolaceClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await client.connect({ url: 'wss://host:443', vpn: 'vpn', username: 'user', password: 'pass' });

    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('sets status to error when connect fails', async () => {
    const { SolaceClient } = await import('./SolaceClient.js');
    const client = new SolaceClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    // Override connect to fire CONNECT_FAILED_ERROR instead
    mockSession.connect.mockImplementation(() => {
      setTimeout(() => handlers[1]?.(), 0);
    });

    await expect(
      client.connect({ url: 'wss://host:443', vpn: 'vpn', username: 'user', password: 'pass' })
    ).rejects.toThrow();

    expect(statuses).toContain('error');
  });

  it('publish constructs and sends a Solace message', async () => {
    const { SolaceClient } = await import('./SolaceClient.js');
    const client = new SolaceClient();
    await client.connect({ url: 'wss://host:443', vpn: 'vpn', username: 'user', password: 'pass' });

    client.publish('test/topic', '{"hello":"world"}');

    expect(mockMessage.setDestination).toHaveBeenCalled();
    expect(mockMessage.setBinaryAttachment).toHaveBeenCalledWith('{"hello":"world"}');
    expect(mockSession.send).toHaveBeenCalledWith(mockMessage);
  });

  it('disconnect calls session.disconnect', async () => {
    const { SolaceClient } = await import('./SolaceClient.js');
    const client = new SolaceClient();
    await client.connect({ url: 'wss://host:443', vpn: 'vpn', username: 'user', password: 'pass' });
    client.disconnect();

    expect(mockSession.disconnect).toHaveBeenCalled();
  });
});
