import { load } from 'js-yaml';
import type { AppConfig, EventConfig } from './types.js';

export interface LoadedConfig {
  config: AppConfig;
  records: Map<string, unknown[]>;
}

export async function loadConfig(base = ''): Promise<LoadedConfig> {
  const yamlRes = await fetch(`${base}/events/config.yaml`);
  if (!yamlRes.ok) throw new Error(`Failed to fetch config: ${yamlRes.status}`);
  const yamlText = await yamlRes.text();
  const config = load(yamlText) as AppConfig;
  if (!config || !Array.isArray(config.events)) {
    throw new Error('config.yaml is malformed: missing or invalid "events" array');
  }

  const records = new Map<string, unknown[]>();
  await Promise.all(
    config.events.map(async (event: EventConfig) => {
      const dataRes = await fetch(`${base}${event.dataFile}`);
      if (!dataRes.ok) throw new Error(`Failed to fetch ${event.dataFile}: ${dataRes.status}`);
      const raw = await dataRes.json();
      if (!Array.isArray(raw)) {
        throw new Error(`Data file ${event.dataFile} did not return a JSON array`);
      }
      records.set(event.id, raw);
    })
  );

  return { config, records };
}
