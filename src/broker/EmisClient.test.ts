import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConnectionStatus } from '../config/types.js';
import rhea from 'rhea';
import * as wsMod from 'rhea/lib/ws';

const VALID_KEY = JSON.stringify({
  broker: { type: 'sapmgw' },
  oa2: {
    clientid: 'client-id',
    clientsecret: 'client-secret',
    tokenendpoint: 'https://auth.example.com/oauth/token',
    granttype: 'client_credentials',
  },
  protocol: ['amqp10ws'],
  uri: 'wss://emis.example.com',
});

/** Flush all pending microtasks (Promise chains with multiple awaits) */
const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// ─── rhea mock wiring ────────────────────────────────────────────────────────
type Fn = (...args: unknown[]) => unknown;
let mockConnHandlers: Record<string, Fn> = {};
let mockSender: { send: ReturnType<typeof vi.fn>; detach: ReturnType<typeof vi.fn> };
let mockConnection: {
  on: ReturnType<typeof vi.fn>;
  open_sender: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};
let mockContainer: { connect: ReturnType<typeof vi.fn> };

function resetRheaMocks() {
  mockConnHandlers = {};
  mockSender = { send: vi.fn(), detach: vi.fn() };
  mockConnection = {
    on: vi.fn().mockImplementation((event: string, cb: Fn) => { mockConnHandlers[event] = cb; }),
    open_sender: vi.fn().mockReturnValue(mockSender),
    close: vi.fn(),
  };
  mockContainer = { connect: vi.fn().mockReturnValue(mockConnection) };
  // re-wire module mocks after vi.restoreAllMocks() clears vi.fn() implementations
  vi.mocked(rhea.create_container).mockImplementation(() => mockContainer as never);
  vi.mocked(wsMod.connect).mockReturnValue(vi.fn().mockReturnValue(vi.fn()));
}

vi.mock('rhea', () => ({
  default: { create_container: vi.fn() },
}));

vi.mock('rhea/lib/ws', () => ({
  connect: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  resetRheaMocks();
});

describe('EmisClient — token fetch', () => {
  it('emits error and rejects when service key JSON is invalid', async () => {
    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await expect(client.connect('not-valid-json')).rejects.toThrow();
    expect(statuses).toContain('error');
  });

  it('emits error and rejects when token fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await expect(client.connect(VALID_KEY)).rejects.toThrow('Network error');
    expect(statuses).toContain('error');
  });

  it('emits error and rejects when token endpoint returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    }));

    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await expect(client.connect(VALID_KEY)).rejects.toThrow();
    expect(statuses).toContain('error');
  });
});

describe('EmisClient — rhea connection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
    }));
    vi.stubGlobal('WebSocket', class {});
  });

  it('emits connecting then connected on successful connect', async () => {
    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    const connectPromise = client.connect(VALID_KEY);
    // flush microtasks so fetchToken resolves and conn.on() handlers register
    await flushPromises();
    // simulate rhea firing connection_open
    mockConnHandlers['connection_open']?.({ connection: mockConnection });
    await connectPromise;

    expect(statuses).toEqual(['connecting', 'connected']);
    expect(mockConnection.open_sender).toHaveBeenCalledWith({ target: { address: '' } });
  });

  it('emits error and rejects when rhea fires connection_error', async () => {
    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    const connectPromise = client.connect(VALID_KEY);
    // flush microtasks so fetchToken resolves and conn.on() handlers register
    await flushPromises();
    mockConnHandlers['connection_error']?.({ error: new Error('AMQP rejected') });
    await expect(connectPromise).rejects.toThrow();
    expect(statuses).toContain('error');
  });

  it('publish calls sender.send with topic and cloudevents content-type', async () => {
    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();

    const connectPromise = client.connect(VALID_KEY);
    // flush microtasks so fetchToken resolves and conn.on() handlers register
    await flushPromises();
    mockConnHandlers['connection_open']?.({ connection: mockConnection });
    await connectPromise;

    client.publish('sap/s4/custom/BP/Created/DE/123', '{"specversion":"1.0"}');

    expect(mockSender.send).toHaveBeenCalledWith({
      body: '{"specversion":"1.0"}',
      properties: {
        to: 'topic:sap/s4/custom/BP/Created/DE/123',
        content_type: 'application/cloudevents+json',
      },
    });
  });

  it('disconnect detaches sender and closes connection, emits disconnected', async () => {
    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    const connectPromise = client.connect(VALID_KEY);
    // flush microtasks so fetchToken resolves and conn.on() handlers register
    await flushPromises();
    mockConnHandlers['connection_open']?.({ connection: mockConnection });
    await connectPromise;

    client.disconnect();
    // simulate connection_close from rhea
    mockConnHandlers['connection_close']?.();

    expect(mockSender.detach).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
    expect(statuses).toContain('disconnected');
  });
});
