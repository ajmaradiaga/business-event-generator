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
    const ce = build(filteredData, eventConfig);
    expect(ce.specversion).toBe('1.0');
    expect(ce.type).toBe('sap.s4.custom.BusinessPartner.Created');
    expect(ce.source).toBe('/sap/s4/erp/business-partner');
    expect(ce.datacontenttype).toBe('application/json');
    expect(ce.subject).toBe('1003769');
    expect(ce.data).toEqual(filteredData);
  });

  it('generates a fresh UUID id each call', () => {
    const a = build(filteredData, eventConfig);
    const b = build(filteredData, eventConfig);
    expect(a.id).not.toBe(b.id);
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(10);
  });

  it('sets time to current ISO timestamp', () => {
    const before = Date.now();
    const ce = build(filteredData, eventConfig);
    const after = Date.now();
    const ts = new Date(ce.time as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
