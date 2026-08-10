import { resolvePositionOccupancy } from './position-occupancy';

describe('resolvePositionOccupancy', () => {
  it('treats null currentOccupancy on a unique position as unknown, not Occupied', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: null,
      isActive: true
    });

    expect(result.statusType).not.toBe('occupied');
    expect(result.capacityText).not.toBe('1/1');
    expect(result.capacityText).toBe('—/1');
    expect(result.statusLabel).toMatch(/unassigned/i);
    expect(result.occupancyKnown).toBe(false);
  });

  it('treats missing currentOccupancy (undefined) on a unique position as unknown', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: undefined,
      isActive: true
    });

    expect(result.occupancyKnown).toBe(false);
    expect(result.statusType).toBe('unassigned');
    expect(result.capacityText).toBe('—/1');
  });

  it('renders 0/1 Vacant for a unique position with known zero occupancy', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: 0,
      isActive: true
    });

    expect(result.capacityText).toBe('0/1');
    expect(result.statusLabel).toBe('Vacant');
    expect(result.statusType).toBe('vacant');
    expect(result.occupancyKnown).toBe(true);
  });

  it('renders 1/1 Occupied for a unique position with known occupancy at capacity', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: 1,
      isActive: true
    });

    expect(result.capacityText).toBe('1/1');
    expect(result.statusLabel).toBe('Occupied');
    expect(result.statusType).toBe('occupied');
    expect(result.occupancyKnown).toBe(true);
  });

  it('treats null currentOccupancy on a pooled position as tracking-unavailable, not "Available capacity"', () => {
    const result = resolvePositionOccupancy({
      positionType: 'pooled',
      maxOccupancy: 5,
      currentOccupancy: null,
      isActive: true
    });

    expect(result.statusLabel).not.toBe('Available capacity');
    expect(result.capacityText).not.toBe('0/5');
    expect(result.capacityText).not.toBe('1/5');
    expect(result.capacityText).toBe('—/5');
    expect(result.statusType).toBe('unknown');
    expect(result.occupancyKnown).toBe(false);
  });

  it('renders current/max Available capacity for a pooled position below capacity', () => {
    const result = resolvePositionOccupancy({
      positionType: 'pooled',
      maxOccupancy: 5,
      currentOccupancy: 3,
      isActive: true
    });

    expect(result.capacityText).toBe('3/5');
    expect(result.statusLabel).toBe('Available capacity');
    expect(result.statusType).toBe('available');
    expect(result.occupancyKnown).toBe(true);
  });

  it('renders current/max Full for a pooled position at capacity', () => {
    const result = resolvePositionOccupancy({
      positionType: 'pooled',
      maxOccupancy: 5,
      currentOccupancy: 5,
      isActive: true
    });

    expect(result.capacityText).toBe('5/5');
    expect(result.statusLabel).toBe('Full');
    expect(result.statusType).toBe('full');
    expect(result.occupancyKnown).toBe(true);
  });

  it('gives Archived precedence over any occupancy status', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: 1,
      isActive: false
    });

    expect(result.statusType).toBe('archived');
    expect(result.statusLabel).toBe('Archived');
  });

  it('treats currentOccupancyCheckSupported = false as unknown even with a malformed numeric count present', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: 1,
      currentOccupancyCheckSupported: false,
      isActive: true
    });

    expect(result.occupancyKnown).toBe(false);
    expect(result.capacityText).toBe('—/1');
    expect(result.statusType).toBe('unassigned');
  });

  it('defaults currentOccupancyCheckSupported to true when the field is absent (tree responses)', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: 1,
      isActive: true
    });

    expect(result.occupancyKnown).toBe(true);
    expect(result.statusType).toBe('occupied');
  });

  it('does not leak backend field names into statusLabel or capacityAriaLabel', () => {
    const result = resolvePositionOccupancy({
      positionType: 'pooled',
      maxOccupancy: 5,
      currentOccupancy: null,
      isActive: true
    });

    expect(result.statusLabel.toLowerCase()).not.toContain('currentoccupancy');
    expect(result.statusLabel.toLowerCase()).not.toContain('checksupported');
    expect(result.capacityAriaLabel.toLowerCase()).not.toContain('currentoccupancy');
    expect(result.capacityAriaLabel.toLowerCase()).not.toContain('null');
  });

  it('provides a human-readable capacityAriaLabel for known occupancy', () => {
    const result = resolvePositionOccupancy({
      positionType: 'pooled',
      maxOccupancy: 5,
      currentOccupancy: 3,
      isActive: true
    });

    expect(result.capacityAriaLabel).toContain('3');
    expect(result.capacityAriaLabel).toContain('5');
  });

  it('provides a human-readable capacityAriaLabel for unknown occupancy', () => {
    const result = resolvePositionOccupancy({
      positionType: 'unique',
      maxOccupancy: 1,
      currentOccupancy: null,
      isActive: true
    });

    expect(result.capacityAriaLabel.length).toBeGreaterThan(0);
    expect(result.capacityAriaLabel).not.toBe('—/1');
  });
});
