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
