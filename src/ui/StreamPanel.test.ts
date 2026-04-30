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
    vi.mocked(navigator.clipboard.writeText).mockClear();
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

  it('escapes HTML special characters in label, detail and topic', () => {
    panel.append(makeEntry({
      label: '<script>alert(1)</script>',
      detail: '<img src=x onerror=alert(1)>',
      topic: 'a/b&c',
    }));
    const listEl = panel.element.querySelector('#stream-list') as HTMLElement;
    expect(listEl.innerHTML).not.toContain('<script>');
    expect(listEl.innerHTML).not.toContain('<img');
    expect(listEl.querySelector('.stream-topic')?.textContent).toBe('a/b&c');
  });
});
