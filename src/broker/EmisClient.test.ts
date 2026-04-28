import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConnectionStatus } from '../config/types.js';

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

vi.mock('rhea', () => ({
  default: { create_container: vi.fn() },
}));

vi.mock('rhea/lib/ws', () => ({
  connect: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
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
