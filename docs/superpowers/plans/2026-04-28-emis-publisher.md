# EMIS Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EMIS (Event Mesh in SAP Integration Suite) as a second broker target, publishable simultaneously with AEM, using AMQP 1.0 over WebSocket via the `rhea` library.

**Architecture:** `EmisClient` wraps rhea for AMQP-over-WSS publishing; OAuth token is fetched via browser `fetch()` before the WebSocket upgrade. `BrokerPanel` gains custom tab buttons (AEM / EMIS) — both panels stay in the DOM so both publishing loops run concurrently. `StreamPanel` adds per-broker `additional-text` tags and All/AEM/EMIS filter buttons. `App.ts` manages two independent publishing intervals via a shared generic `tick()`.

**Tech Stack:** TypeScript 5, Vite 6, @ui5/webcomponents v2, rhea 3.x, Vitest 3

---

## File Map

| Action | File | What changes |
|---|---|---|
| Create | `src/broker/IPublisher.ts` | Shared `publish / disconnect / onStatusChange` interface |
| Create | `src/broker/EmisClient.ts` | AMQP 1.0 over WSS; OAuth token fetch; rhea connection |
| Create | `src/broker/EmisClient.test.ts` | Unit tests for EmisClient |
| Create | `src/ui/EmisPanel.ts` | EMIS config UI: service key textarea, auth button, event/rate/start/stop |
| Create | `src/rhea-ws.d.ts` | Type declaration for `rhea/lib/ws` sub-path |
| Modify | `src/config/types.ts` | Add `EmisServiceKey`, `BrokerType`; add `broker` field to `StreamEntry` |
| Modify | `src/broker/SolaceClient.ts` | Add `implements IPublisher` (no logic change) |
| Modify | `src/ui/BrokerPanel.ts` | Wrap AEM content + inject EmisPanel under custom tab buttons |
| Modify | `src/ui/StreamPanel.ts` | Broker `additional-text` tags; All/AEM/EMIS filter buttons; per-broker stats |
| Modify | `src/ui/App.ts` | Two brokers, two intervals, generic `tick()`, wire all callbacks |
| Modify | `src/styles.css` | Broker tab button styles, filter button styles |
| Modify | `vite.config.ts` | Add rhea to `optimizeDeps`; add `define: { 'process.env': '{}' }` |

---

## Task 1: Install rhea, update types, fix vite config

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/rhea-ws.d.ts`
- Modify: `vite.config.ts`
- Modify: `src/config/types.ts`
- Modify: `src/ui/App.ts` (add `broker: 'aem'` to the existing `streamPanel.append` call — prevents TS error before Task 8)

- [ ] **Step 1: Install rhea**

```bash
npm install rhea
```

Expected: `rhea` added to `dependencies` in `package.json`.

- [ ] **Step 2: Add rhea/lib/ws type declaration**

Create `src/rhea-ws.d.ts`:

```typescript
declare module 'rhea/lib/ws' {
  export function connect(
    Impl: typeof WebSocket
  ): (url: string, protocols: string | string[], options: unknown) => () => unknown;
}
```

- [ ] **Step 3: Update vite.config.ts**

Full file replacement:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/business-event-generator/',
  optimizeDeps: {
    include: ['solclientjs', 'rhea'],
  },
  define: {
    'process.env': '{}',
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Update src/config/types.ts**

Full file replacement:

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

export interface EmisServiceKey {
  broker: { type: string };
  oa2: {
    clientid: string;
    clientsecret: string;
    tokenendpoint: string;
    granttype: string;
  };
  protocol: string[];
  uri: string;
}

export type BrokerType = 'aem' | 'emis';

export interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
  broker: BrokerType;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CloudEvent {
  specversion: '1.0';
  type: string;
  source: string;
  id: string;
  time: string;
  datacontenttype: 'application/json';
  subject: string;
  data: Record<string, unknown>;
}
```

- [ ] **Step 5: Fix App.ts append call (TS won't compile without broker field)**

In `src/ui/App.ts`, find the `streamPanel.append` call (lines 126–131) and add `broker: 'aem'`:

```typescript
    this.streamPanel.append({
      id: cloudEvent.id,
      label: `${fullName}${country}`,
      detail: `BP: ${bpId} · ${timeStr}`,
      topic,
      broker: 'aem',
    });
```

- [ ] **Step 6: Run tests — must still pass**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/config/types.ts src/rhea-ws.d.ts vite.config.ts src/ui/App.ts package.json package-lock.json
git commit -m "feat: install rhea, add EmisServiceKey/BrokerType types, fix vite config"
```

---

## Task 2: IPublisher interface + SolaceClient implements it

**Files:**
- Create: `src/broker/IPublisher.ts`
- Modify: `src/broker/SolaceClient.ts`

- [ ] **Step 1: Create src/broker/IPublisher.ts**

```typescript
import type { ConnectionStatus } from '../config/types.js';

export interface IPublisher {
  publish(topic: string, payload: string): void;
  disconnect(): void;
  onStatusChange(cb: (status: ConnectionStatus) => void): void;
}
```

- [ ] **Step 2: Add `implements IPublisher` to SolaceClient**

In `src/broker/SolaceClient.ts`, change line 4:

```typescript
import type { IPublisher } from './IPublisher.js';
```

Add the import after the existing imports, then change the class declaration:

```typescript
export class SolaceClient implements IPublisher {
```

No other logic changes.

- [ ] **Step 3: Run tests — must still pass**

```bash
npm test
```

Expected: all existing tests pass (TypeScript now validates SolaceClient satisfies IPublisher).

- [ ] **Step 4: Commit**

```bash
git add src/broker/IPublisher.ts src/broker/SolaceClient.ts
git commit -m "feat: add IPublisher interface; SolaceClient implements it"
```

---

## Task 3: EmisClient — OAuth token fetch (TDD)

**Files:**
- Create: `src/broker/EmisClient.ts` (partial — token fetch only)
- Create: `src/broker/EmisClient.test.ts` (token fetch tests)

The `fetchToken` method does:
```
POST {tokenendpoint}
Authorization: Basic base64(clientid:clientsecret)
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials
```
Returns the `access_token` string from the JSON response.

- [ ] **Step 1: Write the failing tests**

Create `src/broker/EmisClient.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — must fail**

```bash
npm test -- EmisClient
```

Expected: FAIL with "Cannot find module './EmisClient.js'"

- [ ] **Step 3: Implement EmisClient with token fetch only**

Create `src/broker/EmisClient.ts`:

```typescript
import type { IPublisher } from './IPublisher.js';
import type { ConnectionStatus, EmisServiceKey } from '../config/types.js';

export class EmisClient implements IPublisher {
  private statusCb: ((s: ConnectionStatus) => void) | null = null;

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCb = cb;
  }

  private emit(status: ConnectionStatus): void {
    this.statusCb?.(status);
  }

  async connect(serviceKeyJson: string): Promise<void> {
    let key: EmisServiceKey;
    try {
      key = JSON.parse(serviceKeyJson) as EmisServiceKey;
    } catch {
      this.emit('error');
      throw new Error('Invalid service key JSON');
    }

    if (!key?.oa2?.tokenendpoint || !key?.oa2?.clientid || !key?.oa2?.clientsecret || !key?.uri) {
      this.emit('error');
      throw new Error('Service key missing required fields (oa2.tokenendpoint, oa2.clientid, oa2.clientsecret, uri)');
    }

    this.emit('connecting');
    const token = await this.fetchToken(key);
    // rhea connect in Task 4
    void token;
  }

  private async fetchToken(key: EmisServiceKey): Promise<string> {
    const credentials = btoa(`${key.oa2.clientid}:${key.oa2.clientsecret}`);
    let response: Response;
    try {
      response = await fetch(key.oa2.tokenendpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      this.emit('error');
      throw err;
    }

    if (!response.ok) {
      this.emit('error');
      const body = await response.text().catch(() => '');
      throw new Error(`Token fetch failed: ${response.status} ${body}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  publish(_topic: string, _payload: string): void {
    // implemented in Task 4
  }

  disconnect(): void {
    // implemented in Task 4
  }
}
```

- [ ] **Step 4: Run tests — must pass**

```bash
npm test -- EmisClient
```

Expected: 3 token fetch tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/broker/EmisClient.ts src/broker/EmisClient.test.ts
git commit -m "feat: EmisClient token fetch with error handling"
```

---

## Task 4: EmisClient — rhea connect, publish, disconnect (TDD)

**Files:**
- Modify: `src/broker/EmisClient.test.ts` (add rhea connection tests)
- Modify: `src/broker/EmisClient.ts` (complete implementation)

rhea API used in this task:
```typescript
import rhea from 'rhea';
import * as ws from 'rhea/lib/ws';

const container = rhea.create_container();
const wsFactory = ws.connect(WebSocket)(key.uri, ['amqp'], {});
const connection = container.connect({
  connection_details: wsFactory,
  username: key.oa2.clientid,
  password: oauthToken,
  sasl_mechanisms: 'PLAIN',
});
// Events on connection:
connection.on('connection_open', (ctx) => { sender = ctx.connection.open_sender({ target: { address: '' } }); })
connection.on('connection_error', (ctx) => { /* ctx.error */ })
connection.on('connection_close', () => { /* closed */ })
connection.on('disconnected', () => { /* disconnected */ })

// Publish:
sender.send({ body: payload, properties: { to: 'topic:' + topic, content_type: 'application/cloudevents+json' } });

// Disconnect:
sender?.detach();
connection?.close();
```

- [ ] **Step 1: Add rhea connection tests to EmisClient.test.ts**

Append to `src/broker/EmisClient.test.ts` (after the existing imports and `VALID_KEY` constant):

```typescript
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
}

vi.mock('rhea', () => ({
  default: { create_container: vi.fn().mockImplementation(() => mockContainer) },
}));

vi.mock('rhea/lib/ws', () => ({
  connect: vi.fn().mockReturnValue(vi.fn().mockReturnValue(vi.fn())),
}));

// ─── connection tests ─────────────────────────────────────────────────────────
describe('EmisClient — rhea connection', () => {
  beforeEach(() => {
    resetRheaMocks();
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
    mockConnHandlers['connection_error']?.({ error: new Error('AMQP rejected') });
    await expect(connectPromise).rejects.toThrow();
    expect(statuses).toContain('error');
  });

  it('publish calls sender.send with topic and cloudevents content-type', async () => {
    const { EmisClient } = await import('./EmisClient.js');
    const client = new EmisClient();

    const connectPromise = client.connect(VALID_KEY);
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
```

- [ ] **Step 2: Run tests — connection tests must fail**

```bash
npm test -- EmisClient
```

Expected: 3 token tests PASS, 4 connection tests FAIL (connect() never resolves, sender undefined, etc.)

- [ ] **Step 3: Complete EmisClient implementation**

Replace `src/broker/EmisClient.ts` in full:

```typescript
import rhea from 'rhea';
import * as ws from 'rhea/lib/ws';
import type { IPublisher } from './IPublisher.js';
import type { ConnectionStatus, EmisServiceKey } from '../config/types.js';

export class EmisClient implements IPublisher {
  private statusCb: ((s: ConnectionStatus) => void) | null = null;
  private connection: ReturnType<typeof rhea.create_container>['connect'] extends (...a: unknown[]) => infer R ? R : never | null = null as never;
  private sender: { send: (msg: unknown) => void; detach: () => void } | null = null;

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCb = cb;
  }

  private emit(status: ConnectionStatus): void {
    this.statusCb?.(status);
  }

  async connect(serviceKeyJson: string): Promise<void> {
    let key: EmisServiceKey;
    try {
      key = JSON.parse(serviceKeyJson) as EmisServiceKey;
    } catch {
      this.emit('error');
      throw new Error('Invalid service key JSON');
    }

    if (!key?.oa2?.tokenendpoint || !key?.oa2?.clientid || !key?.oa2?.clientsecret || !key?.uri) {
      this.emit('error');
      throw new Error('Service key missing required fields (oa2.tokenendpoint, oa2.clientid, oa2.clientsecret, uri)');
    }

    this.emit('connecting');
    const token = await this.fetchToken(key);

    return new Promise((resolve, reject) => {
      const container = rhea.create_container();
      const wsFactory = ws.connect(WebSocket)(key.uri, ['amqp'], {});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conn = container.connect({
        connection_details: wsFactory as never,
        username: key.oa2.clientid,
        password: token,
        sasl_mechanisms: 'PLAIN',
      } as never) as {
        on: (event: string, cb: (ctx: { connection: typeof conn; error?: Error }) => void) => void;
        open_sender: (opts: { target: { address: string } }) => { send: (msg: unknown) => void; detach: () => void };
        close: () => void;
      };

      this.connection = conn as never;

      conn.on('connection_open', (ctx) => {
        this.sender = ctx.connection.open_sender({ target: { address: '' } });
        this.emit('connected');
        resolve();
      });

      conn.on('connection_error', (ctx) => {
        this.emit('error');
        reject(ctx.error ?? new Error('AMQP connection error'));
      });

      conn.on('connection_close', () => {
        this.emit('disconnected');
      });

      conn.on('disconnected', () => {
        this.emit('disconnected');
      });
    });
  }

  private async fetchToken(key: EmisServiceKey): Promise<string> {
    const credentials = btoa(`${key.oa2.clientid}:${key.oa2.clientsecret}`);
    let response: Response;
    try {
      response = await fetch(key.oa2.tokenendpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      this.emit('error');
      throw err;
    }

    if (!response.ok) {
      this.emit('error');
      const body = await response.text().catch(() => '');
      throw new Error(`Token fetch failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  publish(topic: string, payload: string): void {
    if (!this.sender) throw new Error('Not connected');
    this.sender.send({
      body: payload,
      properties: {
        to: `topic:${topic}`,
        content_type: 'application/cloudevents+json',
      },
    });
  }

  disconnect(): void {
    this.sender?.detach();
    this.sender = null;
    (this.connection as { close?: () => void } | null)?.close?.();
    this.connection = null as never;
  }
}
```

**Note on TypeScript casting:** rhea ships CommonJS typings that don't perfectly match Vite/ESM imports. The `as never` casts suppress incompatible type errors from rhea's internal types while keeping the logic type-safe at the call sites. If you see persistent TS errors, try `import type { Connection, Sender } from 'rhea'` and cast accordingly.

- [ ] **Step 4: Run all tests — all must pass**

```bash
npm test
```

Expected: all 7 EmisClient tests PASS, all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/broker/EmisClient.ts src/broker/EmisClient.test.ts
git commit -m "feat: EmisClient AMQP 1.0 over WebSocket with rhea"
```

---

## Task 5: EmisPanel UI component

**Files:**
- Create: `src/ui/EmisPanel.ts`

EmisPanel mirrors BrokerPanel's public API shape (setStatus, setPublishing, callbacks) so App.ts can wire both symmetrically.

- [ ] **Step 1: Create src/ui/EmisPanel.ts**

```typescript
import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Slider.js';
import '@ui5/webcomponents/dist/Label.js';
import '@ui5/webcomponents/dist/TextArea.js';
import type { EventConfig, ConnectionStatus } from '../config/types.js';

export class EmisPanel {
  readonly element: HTMLElement;
  private currentRate = 10;
  private _connected = false;

  onAuthenticate: ((serviceKeyJson: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onStart: ((rate: number) => void) | null = null;
  onStop: (() => void) | null = null;
  onRateChange: ((rate: number) => void) | null = null;
  onEventChange: ((eventId: string) => void) | null = null;

  constructor(eventConfigs: EventConfig[]) {
    this.element = document.createElement('div');

    const optionsHtml = eventConfigs
      .map(e => `<ui5-option value="${e.id}">${e.id.replace(/-/g, ' ')}</ui5-option>`)
      .join('');

    this.element.innerHTML = `
      <ui5-panel header-text="EMIS Connection">
        <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem;">
          <div>
            <ui5-label for="emis-key">Service Key (JSON)</ui5-label>
            <ui5-textarea
              id="emis-key"
              placeholder='Paste sapmgw service key JSON here...'
              rows="5"
              style="width: 100%; font-family: monospace; font-size: 0.8rem;"
            ></ui5-textarea>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <ui5-button id="emis-auth-btn" design="Emphasized">Authenticate</ui5-button>
            <ui5-button id="emis-disc-btn" design="Default" disabled>Disconnect</ui5-button>
          </div>
          <div id="emis-status-badge" style="min-height: 1.5rem;"></div>

          <div>
            <ui5-label for="emis-event">Event Type</ui5-label>
            <ui5-select id="emis-event" style="width: 100%;">${optionsHtml}</ui5-select>
          </div>

          <div>
            <ui5-label>Rate (msg/min): <span id="emis-rate-val">10</span></ui5-label>
            <ui5-slider id="emis-rate" min="1" max="60" value="10" show-tickmarks style="width: 100%;"></ui5-slider>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <ui5-button id="emis-start-btn" design="Positive" disabled>▶ Start</ui5-button>
            <ui5-button id="emis-stop-btn" design="Negative" disabled>■ Stop</ui5-button>
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
    this.element.querySelector('#emis-auth-btn')!.addEventListener('click', () => {
      this.onAuthenticate?.(this.val('#emis-key'));
    });

    this.element.querySelector('#emis-disc-btn')!.addEventListener('click', () => {
      this.onDisconnect?.();
    });

    this.element.querySelector('#emis-start-btn')!.addEventListener('click', () => {
      this.onStart?.(this.currentRate);
    });

    this.element.querySelector('#emis-stop-btn')!.addEventListener('click', () => {
      this.onStop?.();
    });

    this.element.querySelector('#emis-rate')!.addEventListener('change', (e) => {
      this.currentRate = Number((e.target as HTMLInputElement).value);
      const label = this.element.querySelector('#emis-rate-val');
      if (label) label.textContent = String(this.currentRate);
      this.onRateChange?.(this.currentRate);
    });

    this.element.querySelector('#emis-event')!.addEventListener('change', (e) => {
      const detail = (e as CustomEvent).detail;
      const selectedOption = detail?.selectedOption as HTMLElement | undefined;
      const eventId = selectedOption?.getAttribute('value') ?? '';
      if (eventId) this.onEventChange?.(eventId);
    });
  }

  setStatus(status: ConnectionStatus): void {
    const badge = this.element.querySelector('#emis-status-badge')!;
    const colorMap: Record<ConnectionStatus, string> = {
      idle: '#6a6d70',
      connecting: '#e9730c',
      connected: '#107e3e',
      disconnected: '#6a6d70',
      error: '#bb0000',
    };
    const labelMap: Record<ConnectionStatus, string> = {
      idle: '',
      connecting: '● Authenticating…',
      connected: '● Authenticated',
      disconnected: '○ Disconnected',
      error: '✕ Authentication error',
    };
    badge.innerHTML = '';
    const span = document.createElement('span');
    span.style.color = colorMap[status];
    span.style.fontSize = '0.875rem';
    span.textContent = labelMap[status];
    badge.appendChild(span);

    const authBtn = this.element.querySelector('#emis-auth-btn') as HTMLElement;
    const discBtn = this.element.querySelector('#emis-disc-btn') as HTMLElement;
    const startBtn = this.element.querySelector('#emis-start-btn') as HTMLElement;

    this._connected = status === 'connected';
    authBtn.toggleAttribute('disabled', this._connected);
    discBtn.toggleAttribute('disabled', !this._connected);
    startBtn.toggleAttribute('disabled', !this._connected);
  }

  setPublishing(active: boolean): void {
    const startBtn = this.element.querySelector('#emis-start-btn') as HTMLElement;
    const stopBtn = this.element.querySelector('#emis-stop-btn') as HTMLElement;
    startBtn.toggleAttribute('disabled', active || !this._connected);
    stopBtn.toggleAttribute('disabled', !active);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/EmisPanel.ts
git commit -m "feat: EmisPanel UI component"
```

---

## Task 6: BrokerPanel — tab container

**Files:**
- Modify: `src/ui/BrokerPanel.ts`
- Modify: `src/styles.css`

Use custom tab buttons (not `ui5-tab-container`) so both panels stay in the DOM simultaneously — essential for concurrent publishing.

- [ ] **Step 1: Update src/styles.css** — add broker tab styles at the end:

```css
.broker-tabs {
  display: flex;
  border-bottom: 1px solid var(--sapList_BorderColor, #e5e5e5);
}

.broker-tab {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-family: "72", "72full", Arial, Helvetica, sans-serif;
  font-size: 0.875rem;
  color: var(--sapContent_LabelColor, #6a6d70);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.broker-tab.active {
  color: var(--sapHighlightColor, #0070f3);
  border-bottom-color: var(--sapHighlightColor, #0070f3);
  font-weight: 600;
}
```

- [ ] **Step 2: Replace src/ui/BrokerPanel.ts in full**

```typescript
import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/Input.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Slider.js';
import '@ui5/webcomponents/dist/Label.js';
import type { EventConfig, BrokerParams, ConnectionStatus } from '../config/types.js';
import { EmisPanel } from './EmisPanel.js';

export class BrokerPanel {
  readonly element: HTMLElement;
  readonly emis: EmisPanel;

  private currentRate = 10;
  private _connected = false;

  onConnect: ((params: BrokerParams) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onStart: ((rate: number) => void) | null = null;
  onStop: (() => void) | null = null;
  onRateChange: ((rate: number) => void) | null = null;
  onEventChange: ((eventId: string) => void) | null = null;

  constructor(eventConfigs: EventConfig[]) {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 1; min-width: 280px; max-width: 360px;';

    this.emis = new EmisPanel(eventConfigs);

    const optionsHtml = eventConfigs
      .map(e => `<ui5-option value="${e.id}">${e.id.replace(/-/g, ' ')}</ui5-option>`)
      .join('');

    this.element.innerHTML = `
      <div class="broker-tabs">
        <button class="broker-tab active" data-tab="aem">AEM Broker</button>
        <button class="broker-tab" data-tab="emis">EMIS</button>
      </div>
      <div id="aem-content">
        <ui5-panel header-text="AEM Broker">
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
              <ui5-input id="bp-pass" type="Password" style="width: 100%;"></ui5-input>
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
      </div>
      <div id="emis-content" style="display: none;"></div>
    `;

    this.element.querySelector('#emis-content')!.appendChild(this.emis.element);
    this.setupTabListeners();
    this.setupListeners();
  }

  private setupTabListeners(): void {
    this.element.querySelectorAll('.broker-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab;
        this.element.querySelectorAll('.broker-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        (this.element.querySelector('#aem-content') as HTMLElement).style.display =
          tab === 'aem' ? '' : 'none';
        (this.element.querySelector('#emis-content') as HTMLElement).style.display =
          tab === 'emis' ? '' : 'none';
      });
    });
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
    badge.innerHTML = '';
    const span = document.createElement('span');
    span.style.color = colorMap[status];
    span.style.fontSize = '0.875rem';
    span.textContent = labelMap[status];
    badge.appendChild(span);

    const connectBtn = this.element.querySelector('#connect-btn') as HTMLElement;
    const disconnectBtn = this.element.querySelector('#disconnect-btn') as HTMLElement;
    const startBtn = this.element.querySelector('#start-btn') as HTMLElement;

    this._connected = status === 'connected';
    connectBtn.toggleAttribute('disabled', this._connected);
    disconnectBtn.toggleAttribute('disabled', !this._connected);
    startBtn.toggleAttribute('disabled', !this._connected);
  }

  setPublishing(active: boolean): void {
    const startBtn = this.element.querySelector('#start-btn') as HTMLElement;
    const stopBtn = this.element.querySelector('#stop-btn') as HTMLElement;
    startBtn.toggleAttribute('disabled', active || !this._connected);
    stopBtn.toggleAttribute('disabled', !active);
  }
}
```

- [ ] **Step 3: Run tests — must still pass**

```bash
npm test
```

Expected: all tests pass (BrokerPanel has no unit tests; TypeScript compilation validates the shape).

- [ ] **Step 4: Commit**

```bash
git add src/ui/BrokerPanel.ts src/styles.css
git commit -m "feat: BrokerPanel AEM/EMIS tab container"
```

---

## Task 7: StreamPanel — broker tags, filter, and stats

**Files:**
- Modify: `src/ui/StreamPanel.ts`
- Modify: `src/styles.css`

Changes:
- `append()` adds `additional-text` (AEM/EMIS) and `additional-text-state` to each list item
- Filter buttons (All / AEM / EMIS) at top of panel; re-render list on filter change
- Stats show `AEM: X | EMIS: Y | Total: Z`; remove `updateRate` (rate is now per-panel, not shared)

- [ ] **Step 1: Add filter button styles to src/styles.css**

Append to `src/styles.css`:

```css
.stream-filter {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--sapList_BorderColor, #e5e5e5);
}

.stream-filter-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--sapList_BorderColor, #e5e5e5);
  border-radius: 0.25rem;
  background: none;
  cursor: pointer;
  font-family: "72", "72full", Arial, Helvetica, sans-serif;
  font-size: 0.8125rem;
  color: var(--sapContent_LabelColor, #6a6d70);
}

.stream-filter-btn.active {
  background: var(--sapHighlightColor, #0070f3);
  border-color: var(--sapHighlightColor, #0070f3);
  color: #fff;
}
```

- [ ] **Step 2: Replace src/ui/StreamPanel.ts in full**

```typescript
import '@ui5/webcomponents/dist/Panel.js';
import '@ui5/webcomponents/dist/List.js';
import '@ui5/webcomponents/dist/ListItemStandard.js';
import '@ui5/webcomponents/dist/Button.js';
import type { StreamEntry, BrokerType } from '../config/types.js';

const MAX_ENTRIES = 50;

type Filter = 'all' | BrokerType;

export class StreamPanel {
  readonly element: HTMLElement;
  private entries: StreamEntry[] = [];
  private aemCount = 0;
  private emisCount = 0;
  private activeFilter: Filter = 'all';

  private statsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private listContainer!: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = 'flex: 2; min-width: 0;';
    this.element.innerHTML = `
      <ui5-panel header-text="Publishing Stream" style="height: 100%;">
        <div class="stream-filter">
          <button class="stream-filter-btn active" data-filter="all">All</button>
          <button class="stream-filter-btn" data-filter="aem">AEM</button>
          <button class="stream-filter-btn" data-filter="emis">EMIS</button>
        </div>
        <div id="stats" style="padding: 0.5rem 1rem; color: var(--sapContent_LabelColor, #6a6d70); font-size: 0.875rem;">
          AEM: 0 &nbsp;|&nbsp; EMIS: 0 &nbsp;|&nbsp; Total: 0
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

    this.element.querySelectorAll('.stream-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFilter = (btn as HTMLElement).dataset.filter as Filter;
        this.element.querySelectorAll('.stream-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.rerender();
      });
    });
  }

  append(entry: StreamEntry): void {
    if (this.entries.length >= MAX_ENTRIES) {
      this.entries.shift();
    }
    this.entries.push(entry);

    if (entry.broker === 'aem') this.aemCount++;
    else this.emisCount++;

    if (this.activeFilter === 'all' || this.activeFilter === entry.broker) {
      this.renderItem(entry);
      // Remove oldest rendered item if over limit
      const visibleItems = this.listEl.children;
      if (visibleItems.length > MAX_ENTRIES) {
        visibleItems[0].remove();
      }
      this.listContainer.scrollTop = this.listContainer.scrollHeight;
    }

    this.updateStats();
  }

  private renderItem(entry: StreamEntry): void {
    const item = document.createElement('ui5-li');
    item.setAttribute('description', entry.detail);
    item.setAttribute('icon', 'message-success');
    item.setAttribute('additional-text', entry.broker === 'aem' ? 'AEM' : 'EMIS');
    item.setAttribute('additional-text-state', entry.broker === 'aem' ? 'Information' : 'Positive');
    item.textContent = entry.label;
    this.listEl.appendChild(item);
  }

  private rerender(): void {
    this.listEl.innerHTML = '';
    const visible = this.activeFilter === 'all'
      ? this.entries
      : this.entries.filter(e => e.broker === this.activeFilter);
    visible.forEach(e => this.renderItem(e));
    this.listContainer.scrollTop = this.listContainer.scrollHeight;
  }

  clear(): void {
    this.entries = [];
    this.aemCount = 0;
    this.emisCount = 0;
    this.listEl.innerHTML = '';
    this.updateStats();
  }

  private updateStats(): void {
    this.statsEl.innerHTML =
      `AEM: ${this.aemCount} &nbsp;|&nbsp; EMIS: ${this.emisCount} &nbsp;|&nbsp; Total: ${this.aemCount + this.emisCount}`;
  }
}
```

- [ ] **Step 3: Remove stale `updateRate` call from App.ts**

`StreamPanel.updateRate` no longer exists. In `src/ui/App.ts`, update the `onRateChange` handler to remove that call:

```typescript
    this.brokerPanel.onRateChange = rate => {
      this.currentRate = rate;
      if (this.interval !== null) {
        this.stopPublishing();
        this.startPublishing();
      }
    };
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/StreamPanel.ts src/styles.css src/ui/App.ts
git commit -m "feat: StreamPanel broker tags, All/AEM/EMIS filter, per-broker stats"
```

---

## Task 8: App.ts — wire dual brokers

**Files:**
- Modify: `src/ui/App.ts`

This rewrites App.ts to manage two independent publishing loops. The `tick()` function is generic — both brokers call it with their own `brokerType`, `eventId`, and `rate`.

- [ ] **Step 1: Replace src/ui/App.ts in full**

```typescript
import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '../styles.css';
import { BrokerPanel } from './BrokerPanel.js';
import { StreamPanel } from './StreamPanel.js';
import { SolaceClient } from '../broker/SolaceClient.js';
import { EmisClient } from '../broker/EmisClient.js';
import type { IPublisher } from '../broker/IPublisher.js';
import { pick, filter } from '../generator/DataSampler.js';
import { resolveTopic, build } from '../generator/CloudEventBuilder.js';
import type { LoadedConfig } from '../config/ConfigLoader.js';
import type { BrokerType, EventConfig } from '../config/types.js';

export class App {
  private aemBroker: SolaceClient;
  private emisBroker: EmisClient;
  private brokerPanel: BrokerPanel;
  private streamPanel: StreamPanel;
  private config: LoadedConfig;

  private aemInterval: ReturnType<typeof setInterval> | null = null;
  private emisInterval: ReturnType<typeof setInterval> | null = null;

  private aemRate = 10;
  private emisRate = 10;
  private aemEventId: string;
  private emisEventId: string;

  constructor(container: HTMLElement, config: LoadedConfig) {
    this.config = config;
    this.aemEventId = config.config.events[0].id;
    this.emisEventId = config.config.events[0].id;

    this.aemBroker = new SolaceClient();
    this.emisBroker = new EmisClient();
    this.brokerPanel = new BrokerPanel(config.config.events);
    this.streamPanel = new StreamPanel();

    const shellBar = document.createElement('ui5-shellbar');
    shellBar.setAttribute('primary-title', 'Business Event Generator');
    shellBar.setAttribute('secondary-title', 'Demo');

    const panels = document.createElement('div');
    panels.className = 'app-panels';
    panels.appendChild(this.brokerPanel.element);
    panels.appendChild(this.streamPanel.element);

    container.appendChild(shellBar);
    container.appendChild(panels);

    this.wireAem();
    this.wireEmis();
  }

  // ─── AEM wiring ─────────────────────────────────────────────────────────────

  private wireAem(): void {
    this.aemBroker.onStatusChange(status => {
      this.brokerPanel.setStatus(status);
      if (status === 'disconnected' || status === 'error') {
        this.stopAem();
      }
    });

    this.brokerPanel.onConnect = async params => {
      try {
        await this.aemBroker.connect(params);
      } catch (err) {
        console.error('AEM connection failed:', err);
      }
    };

    this.brokerPanel.onDisconnect = () => {
      this.stopAem();
      this.aemBroker.disconnect();
    };

    this.brokerPanel.onStart = rate => {
      this.aemRate = rate;
      this.startAem();
    };

    this.brokerPanel.onStop = () => this.stopAem();

    this.brokerPanel.onRateChange = rate => {
      this.aemRate = rate;
      if (this.aemInterval !== null) {
        this.stopAem();
        this.startAem();
      }
    };

    this.brokerPanel.onEventChange = eventId => {
      this.aemEventId = eventId;
    };
  }

  private startAem(): void {
    if (this.aemInterval !== null) clearInterval(this.aemInterval);
    this.brokerPanel.setPublishing(true);
    this.aemInterval = setInterval(
      () => this.tick(this.aemBroker, 'aem', this.aemEventId, this.aemRate),
      Math.floor(60000 / this.aemRate)
    );
  }

  private stopAem(): void {
    if (this.aemInterval !== null) {
      clearInterval(this.aemInterval);
      this.aemInterval = null;
    }
    this.brokerPanel.setPublishing(false);
  }

  // ─── EMIS wiring ────────────────────────────────────────────────────────────

  private wireEmis(): void {
    this.emisBroker.onStatusChange(status => {
      this.brokerPanel.emis.setStatus(status);
      if (status === 'disconnected' || status === 'error') {
        this.stopEmis();
      }
    });

    this.brokerPanel.emis.onAuthenticate = async serviceKeyJson => {
      try {
        await this.emisBroker.connect(serviceKeyJson);
      } catch (err) {
        console.error('EMIS authentication failed:', err);
      }
    };

    this.brokerPanel.emis.onDisconnect = () => {
      this.stopEmis();
      this.emisBroker.disconnect();
    };

    this.brokerPanel.emis.onStart = rate => {
      this.emisRate = rate;
      this.startEmis();
    };

    this.brokerPanel.emis.onStop = () => this.stopEmis();

    this.brokerPanel.emis.onRateChange = rate => {
      this.emisRate = rate;
      if (this.emisInterval !== null) {
        this.stopEmis();
        this.startEmis();
      }
    };

    this.brokerPanel.emis.onEventChange = eventId => {
      this.emisEventId = eventId;
    };
  }

  private startEmis(): void {
    if (this.emisInterval !== null) clearInterval(this.emisInterval);
    this.brokerPanel.emis.setPublishing(true);
    this.emisInterval = setInterval(
      () => this.tick(this.emisBroker, 'emis', this.emisEventId, this.emisRate),
      Math.floor(60000 / this.emisRate)
    );
  }

  private stopEmis(): void {
    if (this.emisInterval !== null) {
      clearInterval(this.emisInterval);
      this.emisInterval = null;
    }
    this.brokerPanel.emis.setPublishing(false);
  }

  // ─── shared tick ────────────────────────────────────────────────────────────

  private tick(broker: IPublisher, brokerType: BrokerType, eventId: string, _rate: number): void {
    const eventConfig = this.config.config.events.find((e: EventConfig) => e.id === eventId);
    if (!eventConfig) return;

    const records = this.config.records.get(eventId);
    if (!records?.length) return;

    const rawRecord = pick(records) as Record<string, unknown>;
    const filteredData = filter(rawRecord, eventConfig.fields);
    const topic = resolveTopic(eventConfig.topic, rawRecord);
    const cloudEvent = build(filteredData, eventConfig);

    try {
      broker.publish(topic, JSON.stringify(cloudEvent));
    } catch (err) {
      console.error(`${brokerType.toUpperCase()} publish failed:`, err);
      if (brokerType === 'aem') this.stopAem();
      else this.stopEmis();
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
    const timeStr = new Date(cloudEvent.time).toLocaleTimeString();

    this.streamPanel.append({
      id: cloudEvent.id,
      label: `${fullName}${country}`,
      detail: `BP: ${bpId} · ${timeStr}`,
      topic,
      broker: brokerType,
    });
  }
}
```

- [ ] **Step 2: Run all tests — all must pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build — must succeed with no TypeScript errors**

```bash
npm run build
```

Expected: build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.ts
git commit -m "feat: App.ts dual-broker wiring with independent AEM and EMIS publishing loops"
```

---

## Task 9: Smoke test in browser

This is a manual verification step. No code changes — just confirm the UI works end-to-end.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify AEM tab (existing behaviour)**

1. Open `http://localhost:5173/business-event-generator/`
2. Confirm the panel shows two tab buttons: **AEM Broker** | **EMIS** — AEM active by default
3. Fill in AEM connection details and click Connect
4. Confirm status badge shows "● Connected"
5. Click Start — confirm events appear in the stream with "AEM" tag in blue
6. Click the **EMIS** filter button — list should empty (no EMIS events yet)
7. Click **All** — AEM events reappear

- [ ] **Step 3: Verify EMIS tab UI**

1. Click the **EMIS** tab button
2. Confirm EmisPanel renders: service key textarea, Authenticate / Disconnect buttons, event/rate/start/stop controls
3. Confirm AEM publishing continues in the background while EMIS tab is shown

- [ ] **Step 4: Verify simultaneous publishing (if EMIS credentials available)**

1. Paste a valid sapmgw service key into the textarea
2. Click **Authenticate** — status should change to "● Authenticated"
3. Click **Start** — EMIS events appear in the stream with "EMIS" tag in green
4. Confirm AEM events also continue if AEM was already publishing
5. Use **AEM** / **EMIS** / **All** filter buttons — correct events shown per filter
6. Stats should show `AEM: X | EMIS: Y | Total: Z`

- [ ] **Step 5: If EMIS CORS error appears**

The browser console will show: `Access-Control-Allow-Origin` error on the token fetch. This means the XSUAA tenant needs the app's origin added as a trusted CORS origin. This is a SAP BTP configuration step outside the app code — see the Known Limitations section of the design spec.
