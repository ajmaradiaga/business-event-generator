import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadConfig } from './ConfigLoader.js';

const YAML_CONTENT = `
events:
  - id: test-event
    type: sap.s4.custom.Test.Created
    source: /test/source
    topic: test/{{Field}}
    dataFile: /events/data/test.json
    subjectField: Field
    fields:
      root:
        - Field
`;

const DATA_CONTENT = [{ Field: 'value1' }, { Field: 'value2' }];

describe('loadConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses YAML and pre-fetches data files', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const body = url.includes('config.yaml')
        ? YAML_CONTENT
        : JSON.stringify(DATA_CONTENT);
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(JSON.parse(body)),
      });
    }));

    const result = await loadConfig('');

    expect(result.config.events).toHaveLength(1);
    expect(result.config.events[0].id).toBe('test-event');
    expect(result.records.get('test-event')).toEqual(DATA_CONTENT);
  });

  it('throws when config.yaml fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(loadConfig('')).rejects.toThrow('Failed to fetch config: 404');
  });

  it('throws when data file fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('config.yaml')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(YAML_CONTENT),
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    }));

    await expect(loadConfig('')).rejects.toThrow('Failed to fetch /events/data/test.json: 500');
  });

  it('throws when data file returns non-array JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('config.yaml')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(YAML_CONTENT),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ unexpected: 'object' }),
      });
    }));

    await expect(loadConfig('')).rejects.toThrow('did not return a JSON array');
  });
});
