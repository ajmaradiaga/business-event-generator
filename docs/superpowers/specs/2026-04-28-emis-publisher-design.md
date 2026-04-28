# EMIS Publisher Design

**Date:** 2026-04-28  
**Status:** Approved

## Overview

Add EMIS (Event Mesh capability in SAP Integration Suite) as a second publish target alongside the existing AEM (Advanced Event Mesh / Solace) broker. Both brokers publish simultaneously and independently. The UI gains a two-tab layout in the left panel (AEM / EMIS) and a filter tab bar in the stream panel (All / AEM / EMIS).

## Decisions

| Question | Decision |
|---|---|
| Tab layout | Option C: tabs in left panel, filtered stream on right |
| Simultaneous publishing | Yes — both brokers can run at the same time |
| Event/rate config | Independent per broker tab |
| Token expiry | Silent auto-refresh (handled by rhea OAuth internally) |
| Protocol | AMQP 1.0 over WebSocket via `rhea` |
| Library | `rhea` (browser-native WebSocket support, not `@sap/xb-msg-amqp-v100` which is Node.js only) |

## Architecture

### New files

| File | Purpose |
|---|---|
| `src/broker/IPublisher.ts` | Shared interface: `publish`, `disconnect`, `onStatusChange` |
| `src/broker/EmisClient.ts` | AMQP 1.0 over WSS publisher with OAuth |
| `src/ui/EmisPanel.ts` | EMIS config panel: service key textarea, authenticate, event/rate controls |

### Modified files

| File | Change |
|---|---|
| `src/broker/SolaceClient.ts` | Declare implements `IPublisher` (no logic change) |
| `src/config/types.ts` | Add `EmisServiceKey`, `BrokerType`; extend `StreamEntry` with `broker` field |
| `src/ui/BrokerPanel.ts` | Add `ui5-tab-container` with AEM and EMIS tabs; host `EmisPanel`; independent event/rate per tab |
| `src/ui/StreamPanel.ts` | Add All/AEM/EMIS filter tabs; tag entries by broker type |
| `src/ui/App.ts` | Two publisher instances, two independent tick intervals, generic `tick()` function |
| `src/styles.css` | Tab and broker-tag styles |

### IPublisher interface

`connect()` is intentionally excluded — Solace takes `BrokerParams`, EMIS takes a service key string. Each client exposes `connect()` with its specific type; App.ts calls each directly. The interface covers the shared publish flow only.

```typescript
export interface IPublisher {
  publish(topic: string, payload: string): void;
  disconnect(): void;
  onStatusChange(cb: (status: ConnectionStatus) => void): void;
}
```

## EmisClient

### Service key format (sapmgw binding)

```json
{
  "broker": { "type": "sapmgw" },
  "oa2": {
    "clientid": "sb-...",
    "clientsecret": "...",
    "tokenendpoint": "https://subaccount.authentication.eu10.hana.ondemand.com/oauth/token",
    "granttype": "client_credentials"
  },
  "protocol": ["amqp10ws"],
  "uri": "wss://enterprise-messaging.cfapps.eu10.hana.ondemand.com"
}
```

This is a **sapmgw** service key (not saprestmgw). Must be created as a separate binding in the SAP BTP cockpit.

### connect(serviceKeyJson: string)

1. Parse and validate JSON shape
2. `fetch()` OAuth token: `POST oa2.tokenendpoint` with `Authorization: Basic base64(clientid:clientsecret)`, body `grant_type=client_credentials`
3. Parse `uri` to extract host/path
4. rhea WebSocket connect:
   ```typescript
   import * as ws from 'rhea/lib/ws';
   const factory = ws.connect(WebSocket)(serviceKey.uri, ['amqp'], {});
   container.connect({
     connection_details: factory,
     username: serviceKey.oa2.clientid,
     password: oauthToken,
     sasl_mechanisms: 'PLAIN'
   });
   ```
5. Emit `'connected'` on rhea `connection_open` event

**CORS requirement:** The OAuth `fetch()` to XSUAA is a cross-origin browser request. The XSUAA token endpoint must have CORS configured to allow the app's origin. The AMQP WebSocket connection itself has no CORS restriction.

### publish(topic: string, payload: string)

- Sender attached on connect to a wildcard/anonymous address (`''`), reused for the session lifetime
- Variable topic routing via AMQP `to` property in message properties (standard AMQP 1.0 behaviour):
  ```typescript
  sender.send({
    body: payload,
    properties: {
      to: 'topic:' + topic,
      content_type: 'application/cloudevents+json'
    }
  });
  ```

- Fallback if `to` routing is rejected by EMIS: create one sender per unique topic, cached by topic string

### disconnect()

Close rhea sender and connection. Emit `'disconnected'` status.

### Error handling

| Scenario | Behaviour |
|---|---|
| Invalid JSON in service key field | Immediately emit `'error'` status, do not attempt fetch |
| OAuth token fetch fails (network, 401) | Emit `'error'` status, abort connect |
| AMQP connection rejected | Emit `'error'` status |
| Publish fails | Log to console, emit `'error'` status; interval continues |
| CORS blocked on token fetch | Browser console shows CORS error; status set to `'error'` with message pointing to XSUAA CORS config |

## UI

### BrokerPanel

- Wrap existing AEM content and new EMIS content in `ui5-tab-container`
- Both tab panels always rendered in the DOM (tab switch shows/hides, preserving state and keeping both publishing loops alive)

**AEM tab** — unchanged:
- URL, VPN, Username, Password inputs
- Connect / Disconnect buttons
- Status badge
- Event selector, rate slider, Start / Stop buttons

**EMIS tab** — new:
- `ui5-textarea` for service key JSON paste
- "Authenticate" button — calls `emisBroker.connect(serviceKeyJson)`, validates credentials, retrieves token
- Status badge (idle / connecting / connected / error)
- Event selector (independent from AEM)
- Rate slider (independent from AEM)
- Start / Stop buttons

### StreamPanel

- Three filter buttons above the event list: **All** | **AEM** | **EMIS**
- All entries retained in memory; filter only affects the rendered list
- Each entry displays a small coloured broker tag (blue = AEM, green = EMIS)
- Stats line shows per-broker counts when a filter is active: `AEM: 12 | EMIS: 7`

## App.ts

```typescript
private aemBroker: SolaceClient;
private emisBroker: EmisClient;

private aemInterval: number | null = null;
private emisInterval: number | null = null;

private tick(
  broker: IPublisher,
  brokerType: BrokerType,
  eventId: string,
  records: unknown[],
  rate: number
): void { ... }
```

- `onAemConnect`, `onAemStart`, `onAemStop` wire to AEM tab events
- `onEmisAuthenticate`, `onEmisStart`, `onEmisStop` wire to EMIS tab events
- Both intervals call the same `tick()`, tagging `StreamEntry.broker` with their type
- Stream entries forwarded to `StreamPanel.append()` with broker tag

## Types

```typescript
// New
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

// Updated
export interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
  broker: BrokerType; // new
}
```

## Dependencies

- Add `rhea` to `package.json` dependencies
- No other new dependencies

## Known Limitations

- XSUAA token endpoint CORS must be configured for the app's origin; otherwise authentication will fail with a browser CORS error
- rhea's `to` property routing requires EMIS to support AMQP variable routing (standard behaviour, but untested — fallback is to create a sender per unique topic)
