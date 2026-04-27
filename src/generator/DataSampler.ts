import type { EventConfig } from '../config/types.js';

export function pick(records: unknown[]): unknown {
  return records[Math.floor(Math.random() * records.length)];
}

export function filter(
  record: Record<string, unknown>,
  fields: EventConfig['fields']
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields.root) {
    if (field in record) result[field] = record[field];
  }

  for (const [navProp, navFields] of Object.entries(fields)) {
    if (navProp === 'root') continue;

    const nav = record[navProp] as { results?: unknown[] } | undefined;
    if (!nav?.results?.length) continue;

    const first = nav.results[0] as Record<string, unknown>;
    const outputKey = navProp.replace(/^to_/, '');
    const navResult: Record<string, unknown> = {};
    for (const field of navFields) {
      if (field in first) navResult[field] = first[field];
    }
    result[outputKey] = navResult;
  }

  return result;
}
