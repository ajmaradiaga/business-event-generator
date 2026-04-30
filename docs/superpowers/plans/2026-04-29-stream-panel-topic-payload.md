# Stream Panel: Topic Display & Expandable Payload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the resolved topic on every stream item and allow the user to expand any item in-place to see and copy the full CloudEvent JSON payload.

**Architecture:** Add `payload: string` to `StreamEntry`, wire it in `App.ts`, then replace the fixed `ui5-li` renderer in `StreamPanel` with custom div-based items that include a topic line and a toggleable payload panel.

**Tech Stack:** TypeScript, Vite, SAP UI5 Web Components v2, Vitest + jsdom

---

## File Map

| File | Change |
|---|---|
| `src/config/types.ts` | Add `payload: string` to `StreamEntry` interface |
| `src/ui/App.ts` | Capture `payloadStr` in `tick()`, pass to `streamPanel.append()` |
| `src/ui/StreamPanel.ts` | Replace `ui5-list`/`ui5-li` with custom div items; add `escapeHtml` helper |
| `src/ui/StreamPanel.test.ts` | **New** — unit tests for rendering, expand/collapse, filter, clear |

---

## Task 1: Add `payload` field to `StreamEntry`

**Files:**
- Modify: `src/config/types.ts:39-45`

- [ ] **Step 1: Add the field**

In `src/config/types.ts`, change `StreamEntry` from:

```typescript
export interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
  broker: BrokerType;
}
```

to:

```typescript
export interface StreamEntry {
  id: string;
  label: string;
  detail: string;
  topic: string;
  broker: BrokerType;
  payload: string;
}
```

- [ ] **Step 2: Verify TypeScript reports the expected error**

Run:
```bash
npm run build 2>&1 | grep "payload"
```

Expected output (TypeScript catching that `App.ts` doesn't supply the new field yet):
```
src/ui/App.ts(...): error TS2345: Argument of type '{ id: ...; }' is not assignable to parameter of type 'StreamEntry'.
  Property 'payload' is missing ...
```

- [ ] **Step 3: Commit**

```bash
git add src/config/types.ts
git commit -m "feat: add payload field to StreamEntry"
```

---

## Task 2: Write failing StreamPanel tests (TDD)

**Files:**
- Create: `src/ui/StreamPanel.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/ui/StreamPanel.test.ts` with the following content:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamPanel } from './StreamPanel.js';
import type { StreamEntry } from '../config/types.js';

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const makeEntry = (overrides: Partial<StreamEntry> = {}): StreamEntry => ({
  id: 'test-id-1',
  label: 'Test User [DE]',
  detail: 'BP: 1000001 · 12:00:00',
  topic: 'sap/s4/custom/BusinessPartner/Created/DE/1000001',
  broker: 'aem',
  payload: JSON.stringify({ specversion: '1.0', type: 'test.event', id: 'test-id-1', data: {} }),
  ...overrides,
});

describe('StreamPanel', () => {
  let panel: StreamPanel;

  beforeEach(() => {
    panel = new StreamPanel();
    document.body.appendChild(panel.element);
  });

  afterEach(() => {
    panel.element.remove();
  });

  it('renders topic for appended entry', () => {
    panel.append(makeEntry());
    const topicEl = panel.element.querySelector('.stream-topic');
    expect(topicEl?.textContent).toBe('sap/s4/custom/BusinessPartner/Created/DE/1000001');
  });

  it('payload panel is hidden by default', () => {
    panel.append(makeEntry());
    const payloadPanel = panel.element.querySelector('.stream-payload') as HTMLElement;
    expect(payloadPanel?.style.display).toBe('none');
  });

  it('clicking the row expands the payload panel', () => {
    panel.append(makeEntry());
    const row = panel.element.querySelector('.stream-row') as HTMLElement;
    const payloadPanel = panel.element.querySelector('.stream-payload') as HTMLElement;

    row.click();
    expect(payloadPanel.style.display).toBe('block');
  });

  it('clicking an expanded row collapses it again', () => {
    panel.append(makeEntry());
    const row = panel.element.querySelector('.stream-row') as HTMLElement;
    const payloadPanel = panel.element.querySelector('.stream-payload') as HTMLElement;

    row.click();
    row.click();
    expect(payloadPanel.style.display).toBe('none');
  });

  it('expanded payload pre contains formatted JSON', () => {
    panel.append(makeEntry());
    (panel.element.querySelector('.stream-row') as HTMLElement).click();
    const pre = panel.element.querySelector('.stream-payload pre') as HTMLElement;
    expect(pre.textContent).toContain('"specversion"');
    expect(pre.textContent).toContain('"1.0"');
  });

  it('copy button calls clipboard with compact payload', () => {
    const entry = makeEntry();
    panel.append(entry);
    (panel.element.querySelector('.stream-row') as HTMLElement).click();
    const copyBtn = panel.element.querySelector('.stream-copy-btn') as HTMLElement;
    copyBtn.click();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(entry.payload);
  });

  it('clear removes all rendered entries', () => {
    panel.append(makeEntry({ id: '1' }));
    panel.append(makeEntry({ id: '2' }));
    panel.clear();
    const listEl = panel.element.querySelector('#stream-list') as HTMLElement;
    expect(listEl.children.length).toBe(0);
  });

  it('filters entries by broker type', () => {
    panel.append(makeEntry({ id: 'aem1', broker: 'aem', topic: 'topic/aem' }));
    panel.append(makeEntry({ id: 'emis1', broker: 'emis', topic: 'topic/emis' }));

    const aemBtn = panel.element.querySelector('[data-filter="aem"]') as HTMLElement;
    aemBtn.click();

    const listEl = panel.element.querySelector('#stream-list') as HTMLElement;
    expect(listEl.children.length).toBe(1);
    expect(listEl.querySelector('.stream-topic')?.textContent).toBe('topic/aem');
  });

  it('escapes HTML special characters in label and topic', () => {
    panel.append(makeEntry({ label: '<script>alert(1)</script>', topic: 'a/b&c' }));
    const listEl = panel.element.querySelector('#stream-list') as HTMLElement;
    expect(listEl.innerHTML).not.toContain('<script>');
    expect(listEl.querySelector('.stream-topic')?.textContent).toBe('a/b&c');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run:
```bash
npm test 2>&1 | tail -20
```

Expected: assertion failures because the DOM selectors `.stream-topic`, `.stream-row`, `.stream-payload`, `.stream-copy-btn` don't exist in the current `StreamPanel` renderer yet. Vitest uses esbuild (not tsc), so the missing `payload` field in `App.ts` does not surface here — only `npm run build` catches type errors.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/ui/StreamPanel.test.ts
git commit -m "test: add failing StreamPanel rendering tests"
```

---

## Task 3: Implement new StreamPanel renderer

**Files:**
- Modify: `src/ui/StreamPanel.ts`

- [ ] **Step 1: Replace `ui5-list` with `div` in the constructor HTML**

In `src/ui/StreamPanel.ts`, find the constructor innerHTML and change:

```html
<div id="list-container" style="height: 400px; overflow-y: auto; border-top: 1px solid var(--sapList_BorderColor, #e5e5e5);">
  <ui5-list id="stream-list" separators="Inner"></ui5-list>
</div>
```

to:

```html
<div id="list-container" style="height: 400px; overflow-y: auto; border-top: 1px solid var(--sapList_BorderColor, #e5e5e5);">
  <div id="stream-list"></div>
</div>
```

- [ ] **Step 2: Replace `renderItem` and add `escapeHtml`**

Remove the existing `renderItem` method and replace it with the two methods below. Add them right before the closing `}` of the class (after `updateStats`):

```typescript
private renderItem(entry: StreamEntry): void {
  const item = document.createElement('div');
  item.style.cssText = 'border-bottom: 1px solid var(--sapList_BorderColor, #e5e5e5); cursor: pointer;';

  const badge = entry.broker === 'aem'
    ? `<span style="background:#e8f1ff;color:#0a6ed1;border-radius:3px;padding:1px 6px;font-size:0.75rem;font-weight:600;">AEM</span>`
    : `<span style="background:#e8f7ee;color:#107e3e;border-radius:3px;padding:1px 6px;font-size:0.75rem;font-weight:600;">EMIS</span>`;

  let prettyPayload: string;
  try {
    prettyPayload = JSON.stringify(JSON.parse(entry.payload), null, 2);
  } catch {
    prettyPayload = entry.payload;
  }

  item.innerHTML = `
    <div class="stream-row" style="display:flex;align-items:flex-start;padding:0.6rem 1rem;gap:0.75rem;">
      <span style="margin-top:2px;color:var(--sapPositiveColor,#107e3e);font-size:1rem;">✓</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;color:var(--sapTextColor,#32363a);">${this.escapeHtml(entry.label)}</div>
        <div style="color:var(--sapContent_LabelColor,#6a6d70);font-size:0.8rem;margin-top:2px;">${this.escapeHtml(entry.detail)}</div>
        <div class="stream-topic" style="color:var(--sapLinkColor,#0a6ed1);font-size:0.78rem;margin-top:3px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(entry.topic)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:2px;flex-shrink:0;">
        ${badge}
        <span class="stream-chevron" style="color:var(--sapContent_LabelColor,#6a6d70);font-size:0.9rem;">▸</span>
      </div>
    </div>
    <div class="stream-payload" style="display:none;background:#f7f9ff;border-top:1px solid var(--sapList_BorderColor,#e5e5e5);padding:0.75rem 1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <span style="font-size:0.78rem;color:var(--sapContent_LabelColor,#6a6d70);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">CloudEvent Payload</span>
        <button class="stream-copy-btn" style="padding:0.2rem 0.6rem;border-radius:4px;border:1px solid var(--sapLinkColor,#0a6ed1);background:white;color:var(--sapLinkColor,#0a6ed1);font-size:0.78rem;cursor:pointer;">⎘ Copy</button>
      </div>
      <pre style="margin:0;font-size:0.78rem;line-height:1.5;background:#1e1e2e;color:#cdd6f4;padding:0.75rem;border-radius:4px;overflow-x:auto;white-space:pre;">${this.escapeHtml(prettyPayload)}</pre>
    </div>
  `;

  const row = item.querySelector('.stream-row') as HTMLElement;
  const payloadPanel = item.querySelector('.stream-payload') as HTMLElement;
  const chevron = item.querySelector('.stream-chevron') as HTMLElement;

  row.addEventListener('click', () => {
    const expanded = payloadPanel.style.display !== 'none';
    payloadPanel.style.display = expanded ? 'none' : 'block';
    chevron.textContent = expanded ? '▸' : '▾';
    chevron.style.color = expanded
      ? 'var(--sapContent_LabelColor,#6a6d70)'
      : 'var(--sapLinkColor,#0a6ed1)';
  });

  const copyBtn = item.querySelector('.stream-copy-btn') as HTMLButtonElement;
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.payload).then(() => {
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 1500);
    }).catch(() => { /* silent fail in non-secure contexts */ });
  });

  this.listEl.appendChild(item);
}

private escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 3: Run the tests — they will still fail due to missing `payload` in App.ts**

Run:
```bash
npm test 2>&1 | tail -20
```

Expected: TypeScript compilation error about `payload` missing in `App.ts`. That's correct — fix in Task 4.

---

## Task 4: Wire `payload` in `App.ts`

**Files:**
- Modify: `src/ui/App.ts:188-213`

- [ ] **Step 1: Extract `payloadStr` and pass it to `append`**

In `src/ui/App.ts`, find this block inside `tick()`:

```typescript
try {
  broker.publish(topic, JSON.stringify(cloudEvent));
} catch (err) {
  console.error(`${brokerType.toUpperCase()} publish failed:`, err);
  if (brokerType === 'aem') this.stopAem();
  else this.stopEmis();
  return;
}
```

Change to:

```typescript
const payloadStr = JSON.stringify(cloudEvent);
try {
  broker.publish(topic, payloadStr);
} catch (err) {
  console.error(`${brokerType.toUpperCase()} publish failed:`, err);
  if (brokerType === 'aem') this.stopAem();
  else this.stopEmis();
  return;
}
```

Then find:

```typescript
this.streamPanel.append({
  id: cloudEvent.id,
  label: `${fullName}${country}`,
  detail: `BP: ${bpId} · ${timeStr}`,
  topic,
  broker: brokerType,
});
```

Change to:

```typescript
this.streamPanel.append({
  id: cloudEvent.id,
  label: `${fullName}${country}`,
  detail: `BP: ${bpId} · ${timeStr}`,
  topic,
  broker: brokerType,
  payload: payloadStr,
});
```

- [ ] **Step 2: Run all tests — expect all to pass**

Run:
```bash
npm test
```

Expected output:
```
✓ src/ui/StreamPanel.test.ts (9)
✓ src/generator/DataSampler.test.ts (5)
... (all other existing tests pass)

Test Files  X passed
Tests       X passed
```

- [ ] **Step 3: Verify TypeScript build is clean**

Run:
```bash
npm run build
```

Expected: no type errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ui/StreamPanel.ts src/ui/App.ts
git commit -m "feat: show topic and expandable payload in stream panel"
```

---

## Task 5: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open the URL printed to the terminal (default: `http://localhost:5173/business-event-generator/`).

- [ ] **Step 2: Connect to a broker and start publishing**

Connect AEM or EMIS and start publishing. Verify:

1. Each stream item shows three lines: bold label, grey detail, blue monospace topic
2. Topic is truncated with `…` when the topic string is long
3. Clicking an item expands the dark payload panel below it with formatted JSON
4. The chevron rotates from `▸` to `▾` when expanded
5. Clicking an expanded item collapses it again
6. The **⎘ Copy** button briefly shows **✓ Copied!** on click
7. The **All / AEM / EMIS** filter buttons still correctly filter the list
8. The **Clear** button empties the list
