# Stream Panel: Topic Display & Expandable Payload

**Date:** 2026-04-29

## Goal

Enhance the Publishing Stream panel so each message row shows the resolved topic and can be expanded in-place to reveal the full CloudEvent payload as formatted JSON with a copy-to-clipboard button.

## Scope

Three files change:

| File | Change |
|---|---|
| `src/config/types.ts` | Add `payload: string` to `StreamEntry` |
| `src/ui/StreamPanel.ts` | Replace `ui5-li` renderer with custom div-based items |
| `src/ui/App.ts` | Pass `payload` when calling `streamPanel.append()` |

## Data Model

`StreamEntry` gains one field:

```typescript
interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
  broker: BrokerType;
  payload: string;  // JSON.stringify(cloudEvent) — the exact string sent to the broker
}
```

## Rendering

### Collapsed row (always visible)

Each item renders as a `div` (replaces `ui5-li`). Layout left-to-right:

- Success icon (✓, SAP green)
- Text block (flex: 1):
  - Line 1: label — bold, primary text colour
  - Line 2: detail — grey, 0.8rem
  - Line 3: topic — monospace, SAP blue (`#0a6ed1`), truncated with `text-overflow: ellipsis`
- Right side: broker badge (AEM blue / EMIS green) + chevron (`▸`)

The `ui5-list` element is replaced with a plain `<div id="stream-list">`. All other panel elements (`ui5-panel`, filter bar, stats, clear button, scroll container) are unchanged.

### Expanded panel (toggled on click)

Clicking anywhere on the collapsed row toggles the expansion panel immediately below it. The chevron rotates from `▸` to `▾`.

The expansion panel contains:

- Header row: "CloudEvent Payload" label (uppercase, grey) + **Copy** button (right-aligned)
- Dark-background `<pre>` with `JSON.stringify(JSON.parse(entry.payload), null, 2)` — plain pretty-printed JSON, no syntax highlighting
- Copy button calls `navigator.clipboard.writeText(entry.payload)` (compact JSON, same string sent to broker) and briefly shows "✓ Copied!" for 1.5 s

Multiple items can be expanded simultaneously. Clicking an expanded row collapses it.

## App.ts Wiring

```typescript
// Before
broker.publish(topic, JSON.stringify(cloudEvent));
this.streamPanel.append({ id, label, detail, topic, broker });

// After
const payloadStr = JSON.stringify(cloudEvent);
broker.publish(topic, payloadStr);
this.streamPanel.append({ id, label, detail, topic, broker, payload: payloadStr });
```

The same string is reused for both publish and append — no extra serialisation.

## Payload Lifecycle

Payloads live inside their DOM nodes. When a node is removed from the list (MAX_ENTRIES = 50 overflow eviction), the payload is garbage-collected with it. No separate payload store or Map is needed.

## Error Handling

`navigator.clipboard.writeText()` can fail in non-secure contexts. The copy button is a best-effort UX aid; failures are silently ignored (no error toast needed for this tool).

## Out of Scope

- Syntax highlighting (avoids a parser dependency)
- Searching or filtering by topic text
- Persisting payloads across page reloads
