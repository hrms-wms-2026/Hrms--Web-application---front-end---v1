import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PositionListTableComponent } from './position-list-table.component';
import { PositionListItemResponse } from '../../models/position.model';

describe('PositionListTableComponent', () => {
  function makePosition(overrides: Partial<PositionListItemResponse>): PositionListItemResponse {
    return {
      id: 'pos-1',
      legalEntityId: 'le-1',
      departmentId: null,
      name: 'Chief Executive Officer',
      code: 'CEO',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
      ...overrides
    };
  }

  async function createComponent(positions: readonly PositionListItemResponse[]) {
    await TestBed.configureTestingModule({ imports: [PositionListTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionListTableComponent);
    fixture.componentRef.setInput('positions', positions);
    fixture.detectChanges();
    return fixture;
  }

  function rowText(fixture: ReturnType<typeof TestBed.createComponent>): string {
    return fixture.debugElement.query(By.css('tbody tr')).nativeElement.textContent as string;
  }

  it('shows an unassigned/unknown state, not 1/1 Occupied, when currentOccupancy is null on a unique position', async () => {
    const fixture = await createComponent([makePosition({ currentOccupancy: null })]);
    const text = rowText(fixture);

    expect(text).not.toContain('1/1');
    expect(text).not.toContain('Occupied');
    expect(text).toContain('—/1');
    expect(text).toMatch(/Unassigned/i);
  });

  it('shows 0/1 Vacant for a unique position with known zero occupancy', async () => {
    const fixture = await createComponent([makePosition({ currentOccupancy: 0, currentOccupancyCheckSupported: true })]);
    const text = rowText(fixture);

    expect(text).toContain('0/1');
    expect(text).toContain('Vacant');
  });

  it('shows 1/1 Occupied for a unique position with known occupancy at capacity', async () => {
    const fixture = await createComponent([makePosition({ currentOccupancy: 1, currentOccupancyCheckSupported: true })]);
    const text = rowText(fixture);

    expect(text).toContain('1/1');
    expect(text).toContain('Occupied');
  });

  it('does not claim "Available capacity" for a pooled position with unknown occupancy', async () => {
    const fixture = await createComponent([
      makePosition({ positionType: 'pooled', maxOccupancy: 5, currentOccupancy: null })
    ]);
    const text = rowText(fixture);

    expect(text).not.toContain('Available capacity');
    expect(text).not.toContain('0/5');
    expect(text).not.toContain('1/5');
    expect(text).toContain('—/5');
    expect(text).toMatch(/tracking unavailable/i);
  });

  it('shows current/max Available capacity for a pooled position below known capacity', async () => {
    const fixture = await createComponent([
      makePosition({ positionType: 'pooled', maxOccupancy: 5, currentOccupancy: 3, currentOccupancyCheckSupported: true })
    ]);
    const text = rowText(fixture);

    expect(text).toContain('3/5');
    expect(text).toContain('Available capacity');
  });

  it('shows current/max Full for a pooled position at known capacity', async () => {
    const fixture = await createComponent([
      makePosition({ positionType: 'pooled', maxOccupancy: 5, currentOccupancy: 5, currentOccupancyCheckSupported: true })
    ]);
    const text = rowText(fixture);

    expect(text).toContain('5/5');
    expect(text).toContain('Full');
  });

  it('gives Archived precedence over any occupancy status for an inactive position', async () => {
    const fixture = await createComponent([
      makePosition({ isActive: false, currentOccupancy: 1, currentOccupancyCheckSupported: true })
    ]);
    const text = rowText(fixture);

    expect(text).toContain('Archived');
    expect(text).not.toContain('Occupied');
    expect(text).not.toContain('Unassigned');
  });

  it('treats currentOccupancyCheckSupported = false as unknown even with a malformed count present', async () => {
    const fixture = await createComponent([
      makePosition({ currentOccupancy: 1, currentOccupancyCheckSupported: false })
    ]);
    const text = rowText(fixture);

    expect(text).not.toContain('1/1');
    expect(text).not.toContain('Occupied');
    expect(text).toContain('—/1');
  });

  it('does not render backend field names in the rendered row', async () => {
    const fixture = await createComponent([makePosition({ currentOccupancy: null })]);
    const text = rowText(fixture);

    expect(text.toLowerCase()).not.toContain('currentoccupancy');
    expect(text.toLowerCase()).not.toContain('checksupported');
  });
});
