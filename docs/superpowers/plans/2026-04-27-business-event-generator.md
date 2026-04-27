# Business Event Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages SPA that connects to a Solace PubSub+ broker and publishes synthetic SAP Business Partner Created CloudEvents at a user-configurable rate.

**Architecture:** Module-per-concern, no state library. `ConfigLoader` fetches build-time YAML + data files at startup. `DataSampler` and `CloudEventBuilder` are pure functions. `SolaceClient` wraps `solclientjs`. `App` wires everything; `BrokerPanel` and `StreamPanel` are vanilla TS classes managing DOM.

**Tech Stack:** Vite 6 + TypeScript 5, `@ui5/webcomponents` v2 + `@ui5/webcomponents-fiori` v2, `solclientjs` v10, `js-yaml` v4, Vitest 3, GitHub Actions

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | deps, scripts |
| `vite.config.ts` | base URL, optimizeDeps, test env |
| `tsconfig.json` | compiler options |
| `index.html` | entry HTML |
| `.gitignore` | ignore node_modules, dist, .superpowers |
| `scripts/convert-data.cjs` | one-time: convert BP .js → JSON |
| `public/events/config.yaml` | event type registry |
| `public/events/data/business-partners.json` | BP sample data array |
| `src/config/types.ts` | `EventConfig`, `AppConfig`, `BrokerParams`, `StreamEntry`, `ConnectionStatus` |
| `src/config/ConfigLoader.ts` | fetch config.yaml, pre-fetch all dataFiles → `LoadedConfig` |
| `src/config/ConfigLoader.test.ts` | mock fetch, verify parsing + data loading |
| `src/generator/DataSampler.ts` | `pick(records)`, `filter(record, fields)` |
| `src/generator/DataSampler.test.ts` | randomness, field whitelist, nav prop flattening |
| `src/generator/CloudEventBuilder.ts` | `resolveTopic(template, rawRecord)`, `build(filtered, config, topic)` |
| `src/generator/CloudEventBuilder.test.ts` | placeholder resolution, CE envelope shape |
| `src/broker/SolaceClient.ts` | `connect`, `publish`, `disconnect`, `onStatusChange` |
| `src/broker/SolaceClient.test.ts` | mock solclientjs, verify status transitions + publish |
| `src/ui/StreamPanel.ts` | right panel DOM: stats + scrollable message list |
| `src/ui/BrokerPanel.ts` | left panel DOM: connection form + rate slider + start/stop |
| `src/ui/App.ts` | shell bar + two-panel layout, wires all modules |
| `src/main.ts` | bootstrap: loadConfig → new App |
| `.github/workflows/deploy.yml` | CI: build + deploy to GitHub Pages on push to main |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.ts` (placeholder)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "business-event-generator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ui5/webcomponents": "^2.0.0",
    "@ui5/webcomponents-fiori": "^2.0.0",
    "js-yaml": "^4.1.0",
    "solclientjs": "^10.8.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/business-event-generator/',
  optimizeDeps: {
    include: ['solclientjs'],
  },
  test: {
    environment: 'jsdom',
  },
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SAP Business Event Generator</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 6: Create src/main.ts placeholder**

```typescript
export {};
```

- [ ] **Step 7: Install dependencies and verify**

```bash
npm install
npm run test
```

Expected: `No test files found` (passes with 0 tests).

- [ ] **Step 8: Commit**

```bash
git add package.json vite.config.ts tsconfig.json index.html .gitignore src/main.ts
git commit -m "chore: scaffold Vite + TypeScript project"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/config/types.ts`

- [ ] **Step 1: Create src/config/types.ts**

```typescript
export interface EventConfig {
  id: string;
  type: string;
  source: string;
  topic: string;
  dataFile: string;
  subjectField: string;
  fields: {
    root: string[];
    [navProp: string]: string[];
  };
}

export interface AppConfig {
  events: EventConfig[];
}

export interface BrokerParams {
  url: string;
  vpn: string;
  username: string;
  password: string;
}

export interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
```

- [ ] **Step 2: Verify TypeScript accepts the file**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/types.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: Sample Data Setup

**Files:**
- Create: `scripts/convert-data.cjs`
- Create: `public/events/config.yaml`
- Create: `public/events/data/business-partners.json` (generated)

- [ ] **Step 1: Create scripts/convert-data.cjs**

```javascript
#!/usr/bin/env node
// Converts the CJS business-partner-data-min.js mock server file to a plain JSON array.
// Usage: node scripts/convert-data.cjs <path-to-business-partner-data-min.js>
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/convert-data.cjs <path-to-input-file>');
  process.exit(1);
}

let source = fs.readFileSync(inputPath, 'utf8');

// Strip moment dependency — it is only used for yearMonth which does not appear in data
source = source.replace(/const moment = require\(["']moment["']\);?\n?/, '');
source = source.replace(/const yearMonth = [^\n]+\n?/, '');

// Evaluate the CJS module in a sandboxed context
const mod = { exports: {} };
const fn = new Function('module', 'exports', 'require', source);
fn(mod, mod.exports, () => ({}));

const data = mod.exports.data;
if (!Array.isArray(data)) {
  console.error('Expected module.exports.data to be an array');
  process.exit(1);
}

const outDir = path.join(__dirname, '..', 'public', 'events', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'business-partners.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`Wrote ${data.length} records to ${outPath}`);
```

- [ ] **Step 2: Run the conversion**

```bash
node scripts/convert-data.cjs /Users/I503541/repos/github.com/cloud-s4-sdk-book/business-partner/business-partner-data-min.js
```

Expected: `Wrote N records to public/events/data/business-partners.json`

- [ ] **Step 3: Create public/events/config.yaml**

```yaml
events:
  - id: business-partner-created
    type: sap.s4.custom.BusinessPartner.Created
    source: /sap/s4/erp/business-partner
    topic: sap/s4/custom/BusinessPartner/Created/{{Country}}/{{BusinessPartner}}
    dataFile: /events/data/business-partners.json
    subjectField: BusinessPartner
    fields:
      root:
        - BusinessPartner
        - BusinessPartnerUUID
        - BusinessPartnerFullName
        - BusinessPartnerCategory
        - BusinessPartnerGrouping
        - FirstName
        - LastName
        - IsNaturalPerson
        - CreationDate
        - CreatedByUser
      to_BusinessPartnerAddress:
        - Country
        - Region
        - CityName
        - PostalCode
        - StreetName
        - HouseNumber
        - AddressTimeZone
```

- [ ] **Step 4: Commit**

```bash
git add scripts/convert-data.cjs public/events/config.yaml public/events/data/business-partners.json
git commit -m "feat: add sample data and event config"
```

---

## Task 4: ConfigLoader

**Files:**
- Create: `src/config/ConfigLoader.ts`
- Create: `src/config/ConfigLoader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/ConfigLoader.test.ts`:

```typescript
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadConfig', () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ConfigLoader.js'`

- [ ] **Step 3: Implement src/config/ConfigLoader.ts**

```typescript
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

  const records = new Map<string, unknown[]>();
  await Promise.all(
    config.events.map(async (event: EventConfig) => {
      const dataRes = await fetch(`${base}${event.dataFile}`);
      if (!dataRes.ok) throw new Error(`Failed to fetch ${event.dataFile}: ${dataRes.status}`);
      const raw = await dataRes.json();
      records.set(event.id, Array.isArray(raw) ? raw : (raw.data ?? []));
    })
  );

  return { config, records };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/config/ConfigLoader.ts src/config/ConfigLoader.test.ts
git commit -m "feat: add ConfigLoader with YAML + data file loading"
```

---

## Task 5: DataSampler

**Files:**
- Create: `src/generator/DataSampler.ts`
- Create: `src/generator/DataSampler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/generator/DataSampler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pick, filter } from './DataSampler.js';

const records = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carol' },
];

describe('pick', () => {
  it('returns an element from the array', () => {
    const result = pick(records);
    expect(records).toContain(result);
  });

  it('returns different elements over many calls (statistical)', () => {
    const seen = new Set<unknown>();
    for (let i = 0; i < 100; i++) seen.add(pick(records));
    expect(seen.size).toBeGreaterThan(1);
  });
});

const bpRecord = {
  BusinessPartner: '1003769',
  BusinessPartnerFullName: 'Rosa Carmona Garrido',
  CreatedByUser: 'CC0000000002',
  IgnoredField: 'should not appear',
  to_BusinessPartnerAddress: {
    results: [
      {
        Country: 'MX',
        CityName: 'San Soledad',
        IgnoredAddressField: 'should not appear',
      },
    ],
  },
  to_BusinessPartnerBank: { results: [] },
};

const fieldConfig = {
  root: ['BusinessPartner', 'BusinessPartnerFullName', 'CreatedByUser'],
  to_BusinessPartnerAddress: ['Country', 'CityName'],
};

describe('filter', () => {
  it('includes only root fields in whitelist', () => {
    const result = filter(bpRecord, fieldConfig);
    expect(result).toHaveProperty('BusinessPartner', '1003769');
    expect(result).toHaveProperty('BusinessPartnerFullName', 'Rosa Carmona Garrido');
    expect(result).not.toHaveProperty('IgnoredField');
  });

  it('flattens first nav prop result under stripped key', () => {
    const result = filter(bpRecord, fieldConfig);
    expect(result).toHaveProperty('BusinessPartnerAddress');
    const addr = result['BusinessPartnerAddress'] as Record<string, unknown>;
    expect(addr).toHaveProperty('Country', 'MX');
    expect(addr).toHaveProperty('CityName', 'San Soledad');
    expect(addr).not.toHaveProperty('IgnoredAddressField');
  });

  it('omits nav prop key when results array is empty', () => {
    const result = filter(bpRecord, fieldConfig);
    expect(result).not.toHaveProperty('BusinessPartnerBank');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './DataSampler.js'`

- [ ] **Step 3: Implement src/generator/DataSampler.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/generator/DataSampler.ts src/generator/DataSampler.test.ts
git commit -m "feat: add DataSampler (pick + filter)"
```

---

## Task 6: CloudEventBuilder

**Files:**
- Create: `src/generator/CloudEventBuilder.ts`
- Create: `src/generator/CloudEventBuilder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/generator/CloudEventBuilder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveTopic, build } from './CloudEventBuilder.js';
import type { EventConfig } from '../config/types.js';

const rawRecord = {
  BusinessPartner: '1003769',
  to_BusinessPartnerAddress: {
    results: [{ Country: 'MX', Region: '' }],
  },
};

describe('resolveTopic', () => {
  it('replaces root field placeholder', () => {
    expect(resolveTopic('prefix/{{BusinessPartner}}', rawRecord)).toBe('prefix/1003769');
  });

  it('replaces nav prop field placeholder', () => {
    expect(resolveTopic('prefix/{{Country}}', rawRecord)).toBe('prefix/MX');
  });

  it('replaces multiple placeholders', () => {
    expect(resolveTopic('prefix/{{Country}}/{{BusinessPartner}}', rawRecord)).toBe(
      'prefix/MX/1003769'
    );
  });

  it('replaces empty/null value with underscore', () => {
    expect(resolveTopic('prefix/{{Region}}', rawRecord)).toBe('prefix/_');
  });

  it('replaces unknown field with underscore', () => {
    expect(resolveTopic('prefix/{{NoSuchField}}', rawRecord)).toBe('prefix/_');
  });
});

const eventConfig: EventConfig = {
  id: 'business-partner-created',
  type: 'sap.s4.custom.BusinessPartner.Created',
  source: '/sap/s4/erp/business-partner',
  topic: 'sap/s4/custom/BusinessPartner/Created/{{Country}}/{{BusinessPartner}}',
  dataFile: '/events/data/business-partners.json',
  subjectField: 'BusinessPartner',
  fields: { root: ['BusinessPartner'], to_BusinessPartnerAddress: ['Country'] },
};

const filteredData = {
  BusinessPartner: '1003769',
  BusinessPartnerAddress: { Country: 'MX' },
};

describe('build', () => {
  it('returns a valid CloudEvent envelope', () => {
    const ce = build(filteredData, eventConfig, 'sap/s4/custom/BusinessPartner/Created/MX/1003769');
    expect(ce.specversion).toBe('1.0');
    expect(ce.type).toBe('sap.s4.custom.BusinessPartner.Created');
    expect(ce.source).toBe('/sap/s4/erp/business-partner');
    expect(ce.datacontenttype).toBe('application/json');
    expect(ce.subject).toBe('1003769');
    expect(ce.data).toEqual(filteredData);
  });

  it('generates a fresh UUID id each call', () => {
    const a = build(filteredData, eventConfig, 'topic');
    const b = build(filteredData, eventConfig, 'topic');
    expect(a.id).not.toBe(b.id);
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(10);
  });

  it('sets time to current ISO timestamp', () => {
    const before = Date.now();
    const ce = build(filteredData, eventConfig, 'topic');
    const after = Date.now();
    const ts = new Date(ce.time as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './CloudEventBuilder.js'`

- [ ] **Step 3: Implement src/generator/CloudEventBuilder.ts**

```typescript
import type { EventConfig } from '../config/types.js';

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
  eventConfig: EventConfig,
  resolvedTopic: string
): Record<string, unknown> {
  void resolvedTopic; // topic is used by caller for publish; included here for interface symmetry
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add src/generator/CloudEventBuilder.ts src/generator/CloudEventBuilder.test.ts
git commit -m "feat: add CloudEventBuilder (topic resolution + CE envelope)"
```

---

## Task 7: SolaceClient

**Files:**
- Create: `src/broker/SolaceClient.ts`
- Create: `src/broker/SolaceClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/broker/SolaceClient.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './SolaceClient.js'`

- [ ] **Step 3: Implement src/broker/SolaceClient.ts**

```typescript
import * as solace from 'solclientjs';
import type { BrokerParams, ConnectionStatus } from '../config/types.js';

export class SolaceClient {
  private session: solace.Session | null = null;
  private statusCb: ((s: ConnectionStatus) => void) | null = null;

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCb = cb;
  }

  private emit(status: ConnectionStatus): void {
    this.statusCb?.(status);
  }

  connect(params: BrokerParams): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const props = new solace.SolclientFactoryProperties();
        props.profile = solace.SolclientFactoryProfiles.version10_5;
        solace.SolclientFactory.init(props);
      } catch {
        // Already initialized
      }

      this.emit('connecting');

      this.session = solace.SolclientFactory.createSession({
        url: params.url,
        vpnName: params.vpn,
        userName: params.username,
        password: params.password,
      });

      this.session.on(solace.SessionEventCode.UP_NOTICE, () => {
        this.emit('connected');
        resolve();
      });

      this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e: solace.SessionEvent) => {
        this.emit('error');
        reject(new Error(e.infoStr ?? 'Connection failed'));
      });

      this.session.on(solace.SessionEventCode.DISCONNECTED, () => {
        this.emit('disconnected');
      });

      try {
        this.session.connect();
      } catch (err) {
        this.emit('error');
        reject(err);
      }
    });
  }

  publish(topic: string, payload: string): void {
    if (!this.session) throw new Error('Not connected');
    const msg = solace.SolclientFactory.createMessage();
    msg.setDestination(solace.SolclientFactory.createTopicDestination(topic));
    msg.setBinaryAttachment(payload);
    msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
    this.session.send(msg);
  }

  disconnect(): void {
    this.session?.disconnect();
    this.session = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: `12 passed` (all previous + 4 new)

- [ ] **Step 5: Commit**

```bash
git add src/broker/SolaceClient.ts src/broker/SolaceClient.test.ts
git commit -m "feat: add SolaceClient wrapping solclientjs"
```

---

## Task 8: StreamPanel

**Files:**
- Create: `src/ui/StreamPanel.ts`

- [ ] **Step 1: Create src/ui/StreamPanel.ts**

```typescript
import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/List.js';
import '@ui5/webcomponents/dist/StandardListItem.js';
import '@ui5/webcomponents/dist/Button.js';
import type { StreamEntry } from '../config/types.js';

const MAX_ENTRIES = 50;

export class StreamPanel {
  readonly element: HTMLElement;
  private entries: StreamEntry[] = [];
  private sentCount = 0;
  private currentRate = 10;

  private statsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private listContainer!: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 2; min-width: 0;';
    this.element.innerHTML = `
      <ui5-panel header-text="Publishing Stream" style="height: 100%;">
        <div id="stats" style="padding: 0.5rem 1rem; color: var(--sapContent_LabelColor, #6a6d70); font-size: 0.875rem;">
          Sent: 0 &nbsp;|&nbsp; Rate: 10/min
        </div>
        <div id="list-container" style="height: 400px; overflow-y: auto; border-top: 1px solid var(--sapList_BorderColor, #e5e5e5);">
          <ui5-list id="stream-list" separators="Inner"></ui5-list>
        </div>
        <div style="padding: 0.5rem 1rem;">
          <ui5-button id="clear-btn" design="Transparent">Clear</ui5-button>
        </div>
      </ui5-panel>
    `;

    this.statsEl = this.element.querySelector('#stats')!;
    this.listEl = this.element.querySelector('#stream-list')!;
    this.listContainer = this.element.querySelector('#list-container')!;

    this.element.querySelector('#clear-btn')!.addEventListener('click', () => this.clear());
  }

  append(entry: StreamEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
      this.listEl.firstElementChild?.remove();
    }

    this.sentCount++;
    const item = document.createElement('ui5-li');
    item.setAttribute('description', entry.detail);
    item.setAttribute('icon', 'message-success');
    item.textContent = entry.label;
    this.listEl.appendChild(item);

    this.listContainer.scrollTop = this.listContainer.scrollHeight;
    this.updateStats();
  }

  updateRate(rate: number): void {
    this.currentRate = rate;
    this.updateStats();
  }

  clear(): void {
    this.entries = [];
    this.sentCount = 0;
    this.listEl.innerHTML = '';
    this.updateStats();
  }

  private updateStats(): void {
    this.statsEl.innerHTML = `Sent: ${this.sentCount} &nbsp;|&nbsp; Rate: ${this.currentRate}/min`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/StreamPanel.ts
git commit -m "feat: add StreamPanel UI component"
```

---

## Task 9: BrokerPanel

**Files:**
- Create: `src/ui/BrokerPanel.ts`

- [ ] **Step 1: Create src/ui/BrokerPanel.ts**

```typescript
import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/Input.js';
import '@ui5/webcomponents/dist/PasswordInput.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Slider.js';
import '@ui5/webcomponents/dist/Label.js';
import type { EventConfig, BrokerParams, ConnectionStatus } from '../config/types.js';

export class BrokerPanel {
  readonly element: HTMLElement;
  private currentRate = 10;

  onConnect: ((params: BrokerParams) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onStart: ((rate: number) => void) | null = null;
  onStop: (() => void) | null = null;
  onRateChange: ((rate: number) => void) | null = null;
  onEventChange: ((eventId: string) => void) | null = null;

  constructor(eventConfigs: EventConfig[]) {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 1; min-width: 280px; max-width: 360px;';

    const optionsHtml = eventConfigs
      .map(e => `<ui5-option value="${e.id}">${e.id.replace(/-/g, ' ')}</ui5-option>`)
      .join('');

    this.element.innerHTML = `
      <ui5-panel header-text="Broker Connection">
        <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem;">
          <div>
            <ui5-label for="bp-url" required>URL</ui5-label>
            <ui5-input id="bp-url" placeholder="wss://host:443" style="width: 100%;"></ui5-input>
          </div>
          <div>
            <ui5-label for="bp-vpn" required>VPN</ui5-label>
            <ui5-input id="bp-vpn" placeholder="Message VPN" style="width: 100%;"></ui5-input>
          </div>
          <div>
            <ui5-label for="bp-user" required>Username</ui5-label>
            <ui5-input id="bp-user" style="width: 100%;"></ui5-input>
          </div>
          <div>
            <ui5-label for="bp-pass" required>Password</ui5-label>
            <ui5-password-input id="bp-pass" style="width: 100%;"></ui5-password-input>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <ui5-button id="connect-btn" design="Emphasized">Connect</ui5-button>
            <ui5-button id="disconnect-btn" design="Default" disabled>Disconnect</ui5-button>
          </div>
          <div id="status-badge" style="min-height: 1.5rem;"></div>

          <div>
            <ui5-label for="bp-event">Event Type</ui5-label>
            <ui5-select id="bp-event" style="width: 100%;">${optionsHtml}</ui5-select>
          </div>

          <div>
            <ui5-label>Rate (msg/min): <span id="rate-val">10</span></ui5-label>
            <ui5-slider id="bp-rate" min="1" max="60" value="10" show-tickmarks style="width: 100%;"></ui5-slider>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <ui5-button id="start-btn" design="Positive" disabled>▶ Start</ui5-button>
            <ui5-button id="stop-btn" design="Negative" disabled>■ Stop</ui5-button>
          </div>
        </div>
      </ui5-panel>
    `;

    this.setupListeners();
  }

  private val(selector: string): string {
    const el = this.element.querySelector(selector);
    return (el as HTMLInputElement)?.value ?? '';
  }

  private setupListeners(): void {
    this.element.querySelector('#connect-btn')!.addEventListener('click', () => {
      this.onConnect?.({
        url: this.val('#bp-url'),
        vpn: this.val('#bp-vpn'),
        username: this.val('#bp-user'),
        password: this.val('#bp-pass'),
      });
    });

    this.element.querySelector('#disconnect-btn')!.addEventListener('click', () => {
      this.onDisconnect?.();
    });

    this.element.querySelector('#start-btn')!.addEventListener('click', () => {
      this.onStart?.(this.currentRate);
    });

    this.element.querySelector('#stop-btn')!.addEventListener('click', () => {
      this.onStop?.();
    });

    this.element.querySelector('#bp-rate')!.addEventListener('change', (e) => {
      this.currentRate = Number((e.target as HTMLInputElement).value);
      const label = this.element.querySelector('#rate-val');
      if (label) label.textContent = String(this.currentRate);
      this.onRateChange?.(this.currentRate);
    });

    this.element.querySelector('#bp-event')!.addEventListener('change', (e) => {
      const detail = (e as CustomEvent).detail;
      const selectedOption = detail?.selectedOption as HTMLElement | undefined;
      const eventId = selectedOption?.getAttribute('value') ?? '';
      if (eventId) this.onEventChange?.(eventId);
    });
  }

  setStatus(status: ConnectionStatus): void {
    const badge = this.element.querySelector('#status-badge')!;
    const colorMap: Record<ConnectionStatus, string> = {
      idle: '#6a6d70',
      connecting: '#e9730c',
      connected: '#107e3e',
      disconnected: '#6a6d70',
      error: '#bb0000',
    };
    const labelMap: Record<ConnectionStatus, string> = {
      idle: '',
      connecting: '● Connecting…',
      connected: '● Connected',
      disconnected: '○ Disconnected',
      error: '✕ Connection error',
    };
    badge.innerHTML = `<span style="color: ${colorMap[status]}; font-size: 0.875rem;">${labelMap[status]}</span>`;

    const connectBtn = this.element.querySelector('#connect-btn') as HTMLElement;
    const disconnectBtn = this.element.querySelector('#disconnect-btn') as HTMLElement;
    const startBtn = this.element.querySelector('#start-btn') as HTMLElement;

    const connected = status === 'connected';
    connectBtn.toggleAttribute('disabled', connected);
    disconnectBtn.toggleAttribute('disabled', !connected);
    startBtn.toggleAttribute('disabled', !connected);
  }

  setPublishing(active: boolean): void {
    const startBtn = this.element.querySelector('#start-btn') as HTMLElement;
    const stopBtn = this.element.querySelector('#stop-btn') as HTMLElement;
    startBtn.toggleAttribute('disabled', active);
    stopBtn.toggleAttribute('disabled', !active);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/BrokerPanel.ts
git commit -m "feat: add BrokerPanel UI component"
```

---

## Task 10: App, main, and styles

**Files:**
- Create: `src/ui/App.ts`
- Modify: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Create src/styles.css**

```css
:root {
  --sap-bg: #f5f6f7;
  --sap-panel-gap: 1rem;
}

body {
  background: var(--sap-bg);
  margin: 0;
  font-family: "72", "72full", Arial, Helvetica, sans-serif;
}

.app-panels {
  display: flex;
  gap: var(--sap-panel-gap);
  padding: var(--sap-panel-gap);
  align-items: flex-start;
}

@media (max-width: 768px) {
  .app-panels {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: Create src/ui/App.ts**

```typescript
import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '../styles.css';
import { BrokerPanel } from './BrokerPanel.js';
import { StreamPanel } from './StreamPanel.js';
import { SolaceClient } from '../broker/SolaceClient.js';
import { pick, filter } from '../generator/DataSampler.js';
import { resolveTopic, build } from '../generator/CloudEventBuilder.js';
import type { LoadedConfig, EventConfig } from '../config/types.js';

export class App {
  private broker: SolaceClient;
  private brokerPanel: BrokerPanel;
  private streamPanel: StreamPanel;
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentRate = 10;
  private currentEventId: string;
  private config: LoadedConfig;

  constructor(container: HTMLElement, config: LoadedConfig) {
    this.config = config;
    this.currentEventId = config.config.events[0].id;
    this.broker = new SolaceClient();
    this.brokerPanel = new BrokerPanel(config.config.events);
    this.streamPanel = new StreamPanel();

    const shellBar = document.createElement('ui5-shellbar');
    shellBar.setAttribute('primary-title', 'Business Event Generator');
    shellBar.setAttribute('secondary-title', 'SAP Event Mesh Demo');

    const panels = document.createElement('div');
    panels.className = 'app-panels';
    panels.appendChild(this.brokerPanel.element);
    panels.appendChild(this.streamPanel.element);

    container.appendChild(shellBar);
    container.appendChild(panels);

    this.broker.onStatusChange(status => {
      this.brokerPanel.setStatus(status);
      if (status === 'disconnected' || status === 'error') {
        this.stopPublishing();
      }
    });

    this.brokerPanel.onConnect = async params => {
      try {
        await this.broker.connect(params);
      } catch (err) {
        console.error('Connection failed:', err);
      }
    };

    this.brokerPanel.onDisconnect = () => {
      this.stopPublishing();
      this.broker.disconnect();
    };

    this.brokerPanel.onStart = rate => {
      this.currentRate = rate;
      this.startPublishing();
    };

    this.brokerPanel.onStop = () => this.stopPublishing();

    this.brokerPanel.onRateChange = rate => {
      this.currentRate = rate;
      this.streamPanel.updateRate(rate);
      if (this.interval !== null) {
        this.stopPublishing();
        this.startPublishing();
      }
    };

    this.brokerPanel.onEventChange = eventId => {
      this.currentEventId = eventId;
    };
  }

  private startPublishing(): void {
    if (this.interval !== null) clearInterval(this.interval);
    this.brokerPanel.setPublishing(true);
    this.interval = setInterval(() => this.tick(), Math.floor(60000 / this.currentRate));
  }

  private stopPublishing(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.brokerPanel.setPublishing(false);
  }

  private tick(): void {
    const eventConfig = this.config.config.events.find(
      (e: EventConfig) => e.id === this.currentEventId
    );
    if (!eventConfig) return;

    const records = this.config.records.get(this.currentEventId);
    if (!records?.length) return;

    const rawRecord = pick(records) as Record<string, unknown>;
    const filteredData = filter(rawRecord, eventConfig.fields);
    const topic = resolveTopic(eventConfig.topic, rawRecord);
    const cloudEvent = build(filteredData, eventConfig, topic);

    try {
      this.broker.publish(topic, JSON.stringify(cloudEvent));
    } catch (err) {
      console.error('Publish failed:', err);
      this.stopPublishing();
      return;
    }

    const fullName = String(
      filteredData['BusinessPartnerFullName'] ??
        filteredData[eventConfig.subjectField] ??
        'Unknown'
    );
    const addr = filteredData['BusinessPartnerAddress'] as Record<string, unknown> | undefined;
    const country = addr?.['Country'] ? ` (${addr['Country']})` : '';
    const bpId = String(filteredData[eventConfig.subjectField] ?? '');
    const timeStr = new Date(cloudEvent['time'] as string).toLocaleTimeString();

    this.streamPanel.append({
      id: cloudEvent['id'] as string,
      label: `${fullName}${country}`,
      detail: `BP: ${bpId} · ${timeStr}`,
      topic,
    });
  }
}
```

- [ ] **Step 3: Replace src/main.ts**

```typescript
import { loadConfig } from './config/ConfigLoader.js';
import { App } from './ui/App.js';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app element not found');

  const config = await loadConfig();
  new App(container, config);
}

bootstrap().catch(err => {
  const container = document.getElementById('app');
  if (container) {
    container.innerHTML = `<p style="color: #bb0000; padding: 2rem;">Failed to initialize: ${String(err)}</p>`;
  }
});
```

- [ ] **Step 4: Verify all tests still pass**

```bash
npm test
```

Expected: `12 passed` (no regressions)

- [ ] **Step 5: Verify the dev server starts and renders**

```bash
npm run dev
```

Open `http://localhost:5173/business-event-generator/` in a browser. Expected: shell bar renders, two panels visible, broker form shows inputs.

- [ ] **Step 6: Verify production build succeeds**

```bash
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/App.ts src/main.ts src/styles.css
git commit -m "feat: add App root, wire all modules, complete UI"
```

---

## Task 11: GitHub Actions Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run build
        env:
          VITE_BASE_URL: /${{ github.event.repository.name }}/

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Enable GitHub Pages in repo settings**

In your GitHub repository:
1. Go to **Settings → Pages**
2. Set **Source** to **GitHub Actions**

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy to GitHub Pages"
git remote add origin https://github.com/<your-username>/business-event-generator.git
git push -u origin main
```

Expected: GitHub Actions workflow triggers, builds, and deploys. Check **Actions** tab for status.

---

## Self-Review Notes

Spec section → task coverage:

| Spec section | Covered by |
|---|---|
| Project structure | Task 1 (scaffold) + all tasks |
| TypeScript types | Task 2 |
| YAML config schema + data | Task 3 |
| ConfigLoader | Task 4 |
| DataSampler (pick + filter) | Task 5 |
| CloudEventBuilder (topic + CE build) | Task 6 |
| Dynamic topic resolution | Task 6 (resolveTopic) |
| Data pipeline per tick | Task 10 (App.tick) |
| SolaceClient | Task 7 |
| StreamPanel UI | Task 8 |
| BrokerPanel UI | Task 9 |
| App wiring + rate limiting | Task 10 |
| GitHub Pages deployment | Task 11 |

**Type consistency check:** `StreamEntry.label / .detail / .topic / .id` — defined in Task 2, used in Task 8 (`append`) and Task 10 (`tick`). `LoadedConfig` — defined in Task 4 (`ConfigLoader`), used in Task 10 (`App` constructor). `ConnectionStatus` — defined in Task 2, used in Task 7 (`SolaceClient`) and Task 9 (`BrokerPanel.setStatus`). `EventConfig.fields` — defined in Task 2, used in Task 5 (`DataSampler.filter`). All consistent.

**`filter` output key naming:** Task 5 tests assert `result['BusinessPartnerAddress']` (strips `to_`). Task 10 `App.tick` accesses `filteredData['BusinessPartnerAddress']`. Consistent.

**`build` unused parameter:** `resolvedTopic` parameter in `build()` is passed but only used by the caller for `publish`. The `void resolvedTopic` line suppresses the lint warning. This is intentional — the signature matches the spec pipeline.
