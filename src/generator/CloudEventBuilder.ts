import type { CloudEvent, EventConfig } from '../config/types.js';

export function resolveTopic(template: string, record: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, fieldName: string) => {
    // 1. Check root fields
    const rootVal = record[fieldName];
    if (rootVal !== null && rootVal !== undefined && rootVal !== '') {
      return String(rootVal);
    }

    // 2. Check first result of each nav prop
    for (const value of Object.values(record)) {
      if (value !== null && typeof value === 'object') {
        const nav = value as { results?: unknown[] };
        if (Array.isArray(nav.results) && nav.results.length > 0) {
          const first = nav.results[0] as Record<string, unknown>;
          const navVal = first[fieldName];
          if (navVal !== null && navVal !== undefined && navVal !== '') {
            return String(navVal);
          }
        }
      }
    }

    return '_';
  });
}

export function build(
  filteredData: Record<string, unknown>,
  eventConfig: EventConfig
): CloudEvent {
  return {
    specversion: '1.0',
    type: eventConfig.type,
    source: eventConfig.source,
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    subject: String(filteredData[eventConfig.subjectField] ?? '_'),
    data: filteredData,
  };
}
