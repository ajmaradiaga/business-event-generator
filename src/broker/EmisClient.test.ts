import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmisClient } from './EmisClient.js';
import type { ConnectionStatus } from '../config/types.js';

const SERVICE_KEY = JSON.stringify({
  oa2: {
    clientid: 'client-id',
    clientsecret: 'client-secret',
    tokenendpoint: 'https://auth.example.com/oauth/token',
    granttype: 'client_credentials',
  },
  protocol: ['httprest'],
  broker: { type: 'saprestmgw' },
  uri: 'https://emis.example.com:1443',
});

function stubTokenFetch(token = 'test-token') {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: token }),
  });
}

describe('EmisClient', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('emits connecting then connected on successful connect', async () => {
    vi.stubGlobal('fetch', stubTokenFetch());
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await client.connect(SERVICE_KEY);

    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('emits error and throws when token fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await expect(client.connect(SERVICE_KEY)).rejects.toThrow('Token fetch failed: 401');
    expect(statuses).toContain('error');
  });

  it('emits error and rethrows when token fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await expect(client.connect(SERVICE_KEY)).rejects.toThrow('Network error');
    expect(statuses).toContain('error');
  });

  it('emits error and throws on invalid service key JSON', async () => {
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));

    await expect(client.connect('not-json')).rejects.toThrow('Invalid service key JSON');
    expect(statuses).toContain('error');
  });

  it('publish POSTs with bearer token and cloudevents content type', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    vi.stubGlobal('fetch', mockFetch);

    const client = new EmisClient();
    await client.connect(SERVICE_KEY);
    client.publish('my/topic', '{"hello":"world"}');
    await new Promise(r => setTimeout(r, 0));

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit & { headers: Record<string, string> }];
    // In DEV mode the URL is /emis-proxy?target=<encoded-url>; get() already decodes once
    const target = url.startsWith('/emis-proxy')
      ? (new URLSearchParams(url.split('?')[1]).get('target') ?? '')
      : url;
    expect(target).toContain('my%2Ftopic');
    expect(target).toContain('emis.example.com');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer tok');
    expect(init.headers['Content-Type']).toBe('application/cloudevents+json');
    expect(init.body).toBe('{"hello":"world"}');
  });

  it('emits error on 401 publish response (token expired)', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    vi.stubGlobal('fetch', mockFetch);

    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));
    await client.connect(SERVICE_KEY);

    client.publish('topic', '{}');
    await new Promise(r => setTimeout(r, 0));

    expect(statuses).toContain('error');
  });

  it('disconnect emits disconnected and publish throws afterwards', async () => {
    vi.stubGlobal('fetch', stubTokenFetch());
    const client = new EmisClient();
    const statuses: ConnectionStatus[] = [];
    client.onStatusChange(s => statuses.push(s));
    await client.connect(SERVICE_KEY);

    client.disconnect();

    expect(statuses).toContain('disconnected');
    expect(() => client.publish('topic', '{}')).toThrow('Not connected');
  });
});
