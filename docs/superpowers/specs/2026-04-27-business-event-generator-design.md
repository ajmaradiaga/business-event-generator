# Business Event Generator — Design Spec

**Date:** 2026-04-27  
**Status:** Approved

---

## Overview

A static single-page application deployed to GitHub Pages that connects to a Solace PubSub+ event mesh broker and publishes synthetic SAP business events at a configurable rate. v1 generates Business Partner Created events from sample data. The app is SAP-branded with Fiori look and feel.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| UI framework | `@ui5/webcomponents` + `@ui5/webcomponents-fiori` |
| Build tool | Vite + TypeScript |
| Broker client | `solclientjs` (Solace PubSub+ WebSocket) |
| YAML parsing | `js-yaml` |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |
| Event spec | CloudEvents 1.0 |

---

## Project Structure

```
business-event-generator/
├── public/
│   └── events/
│       ├── config.yaml                   # event type registry (build-time)
│       └── data/
│           └── business-partners.json    # BP sample data (converted from .js)
├── src/
│   ├── broker/
│   │   └── SolaceClient.ts              # solclientjs wrapper
│   ├── generator/
│   │   ├── CloudEventBuilder.ts         # builds CloudEvent envelope
│   │   └── DataSampler.ts               # picks random BP record, filters fields
│   ├── config/
│   │   ├── ConfigLoader.ts              # fetches + parses YAML at startup
│   │   └── types.ts                     # EventConfig, FieldMap TypeScript types
│   ├── ui/
│   │   ├── App.ts                       # root component, wires all modules
│   │   ├── BrokerPanel.ts               # left panel: connection + controls
│   │   └── StreamPanel.ts               # right panel: live stream + stats
│   └── main.ts
├── .github/
│   └── workflows/
│       └── deploy.yml
├── index.html
├── vite.config.ts
└── tsconfig.json
```

---

## Architecture

Module-per-concern. No external state library. Props flow down via method calls; events bubble up via callbacks. Four independent modules communicate through `App.ts`:

```
ConfigLoader ──► App ──► SolaceClient
                  │
                  ├──► DataSampler ──► CloudEventBuilder ──► SolaceClient.publish()
                  │
                  ├──► BrokerPanel (left UI)
                  └──► StreamPanel (right UI)
```

Publishing loop: `setInterval` in main thread at `60000 / rate` ms. Adequate at max 60 msg/min; no Web Worker needed.

---

## YAML Config Schema

Location: `public/events/config.yaml`  
Loaded once at app startup via `fetch('/events/config.yaml')`. `ConfigLoader` parses the YAML, then pre-fetches all `dataFile` paths referenced in the config, returning a map of `eventId → records[]`. All data is in memory before the UI renders.

Adding a new event type: add an entry + drop a JSON data file under `public/events/data/`.

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

### TypeScript types

```typescript
interface EventConfig {
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

interface AppConfig {
  events: EventConfig[];
}
```

---

## CloudEvent Output

Each publish: pick a random record from the data array, apply field whitelist from config, generate fresh `id` (UUID v4) and `time` (ISO 8601 now).

```json
{
  "specversion": "1.0",
  "type": "sap.s4.custom.BusinessPartner.Created",
  "source": "/sap/s4/erp/business-partner",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "time": "2026-04-27T10:30:00.000Z",
  "datacontenttype": "application/json",
  "subject": "1003769",
  "data": {
    "BusinessPartner": "1003769",
    "BusinessPartnerUUID": "1d7c1ee6-9883-4588-8017-b44fb30b66e4",
    "BusinessPartnerFullName": "Rosa Carmona Garrido",
    "BusinessPartnerCategory": "1",
    "BusinessPartnerGrouping": "BP02",
    "FirstName": "Rosa",
    "LastName": "Carmona",
    "IsNaturalPerson": "X",
    "CreationDate": "/Date(1518393600000)/",
    "CreatedByUser": "CC0000000002",
    "Address": {
      "Country": "MX",
      "Region": "",
      "CityName": "San Soledad los altos",
      "PostalCode": "30434-6288",
      "StreetName": "Circunvalación Bahrein 296 353",
      "HouseNumber": "7049",
      "AddressTimeZone": "MDT"
    }
  }
}
```

`subject` is set to the value of `subjectField` from the selected record. Navigation property results are flattened to a single object (first element if array); if the array is empty the nav prop key is omitted from `data`. The key in `data` strips the `to_` prefix (e.g. `to_BusinessPartnerAddress` → `Address`).

---

## Broker Connection

Protocol: Solace PubSub+ over **WebSocket Secure** (`wss://`).  
Library: `solclientjs` (npm).  
QoS: **Direct** messaging (fire-and-forget, no persistence needed for a demo generator).

Connection parameters (entered by user in UI, never persisted):

| Field | Description |
|-------|-------------|
| URL | `wss://host:port` |
| VPN | Solace message VPN name |
| Username | Client username |
| Password | Client password |

`SolaceClient.ts` public interface:

```typescript
connect(params: BrokerParams): Promise<void>
publish(topic: string, payload: string): void
disconnect(): void
onStatusChange(cb: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void): void
```

Connection status displayed as a colored badge in the left panel. Publishing is only enabled when status is `connected`.

---

## UI Layout

Fiori shell bar at top. Two-panel layout below.

```
┌─────────────────────────────────────────────────────────────────┐
│  [SAP Logo]  Business Event Generator                           │  ← ui5-shellbar
└─────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  BROKER CONNECTION       │  │  PUBLISHING STREAM               │
│  ─────────────────────   │  │  ─────────────────────────────   │
│  URL      [__________]   │  │  ● Sent: 42   Rate: 10/min       │
│  VPN      [__________]   │  │                                   │
│  Username [__________]   │  │  ✓ Rosa Carmona Garrido (MX)     │
│  Password [__________]   │  │    BP: 1003769 · 10:30:01        │
│  [Connect] [Disconnect]  │  │  ✓ Manuel Abreu (PT)             │
│  ● Connected             │  │    BP: 1003770 · 10:30:07        │
│                          │  │  ✓ Etta Sonnino-Marinetti (IT)   │
│  EVENT TYPE              │  │    BP: 1003771 · 10:30:13        │
│  [BP Created ▾]          │  │                                   │
│                          │  │  [Clear]                         │
│  RATE (msg/min)          │  │                                   │
│  [──●────────] 10        │  └──────────────────────────────────┘
│                          │
│  [▶ Start]  [■ Stop]     │
└──────────────────────────┘
```

### UI5 Components

| Component | Usage |
|-----------|-------|
| `ui5-shellbar` | Top bar with SAP logo + app title |
| `ui5-panel` | Left and right panel containers |
| `ui5-input` | URL, VPN, Username fields |
| `ui5-password-input` | Password field |
| `ui5-button` | Connect, Disconnect, Start, Stop, Clear |
| `ui5-select` / `ui5-option` | Event type dropdown (populated from config) |
| `ui5-slider` | Rate control (1–60 msg/min) |
| `ui5-list` / `ui5-li` | Stream entries (capped at last 50, auto-scroll) |
| `ui5-badge` | Connection status indicator |

Start/Stop disabled when not connected. Connect/Disconnect toggle based on status. Event type dropdown populated dynamically from `config.yaml` at startup — adding a YAML entry automatically adds it to the dropdown.

---

## Rate Limiting

- Range: 1–60 messages/minute
- Default: 10 messages/minute
- Implementation: `setInterval` at `Math.floor(60000 / rate)` ms
- Interval cleared on Stop or Disconnect
- Slider updates rate live; if currently publishing, interval restarts with new rate

---

## Dynamic Topic Resolution

Topic strings may contain `{{FieldName}}` placeholders that are replaced with values from the selected record before publishing.

Resolution order per placeholder:

1. Root fields (e.g. `{{BusinessPartner}}` → `record.BusinessPartner`)
2. First nav prop result fields (e.g. `{{Country}}` → `record.to_BusinessPartnerAddress.results[0].Country`)

If a placeholder resolves to an empty string or null, it is replaced with `_` to keep the topic valid.

Example: `sap/s4/custom/BusinessPartner/Created/{{Country}}/{{BusinessPartner}}`  
→ `sap/s4/custom/BusinessPartner/Created/MX/1003769`

Resolution is implemented in `CloudEventBuilder.resolveTopic(template, record)`.

---

## Data Pipeline (per publish tick)

1. `DataSampler.pick(records)` — random index into BP array
2. `DataSampler.filter(record, fieldMap)` — apply root + nav prop whitelists → `filteredData`
3. `CloudEventBuilder.resolveTopic(template, record)` — interpolate `{{field}}` placeholders → `resolvedTopic`
4. `CloudEventBuilder.build(filteredData, eventConfig, resolvedTopic)` — wrap in CE envelope with fresh `id` + `time`
5. `SolaceClient.publish(resolvedTopic, JSON.stringify(cloudEvent))`
6. `StreamPanel.append(entry)` — add to live list (cap at 50 entries)

---

## GitHub Pages Deployment

`vite.config.ts`:
```typescript
export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/business-event-generator/',
})
```

`.github/workflows/deploy.yml`: triggers on push to `main`.  
Steps: checkout → setup Node → `npm ci` → `npm run build` → deploy `dist/` via `actions/upload-pages-artifact` + `actions/deploy-pages`.

No hash routing or `404.html` workaround needed — single page, no client-side routing.

---

## Out of Scope (v1)

- Multiple simultaneous event types publishing in parallel
- Persisting broker credentials (intentional — security)
- Message history across page reloads
- MQTT or AMQP protocol support
- Guaranteed (persistent) messaging
