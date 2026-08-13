import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PositionListTableComponent } from './position-list-table.component';
import { OccupantPreviewItem, PositionListItemResponse } from '../../models/position.model';

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

  function makeEmployee(overrides: Partial<OccupantPreviewItem> = {}): OccupantPreviewItem {
    return {
      employeeId: 'emp-1',
      displayName: 'Jane Smith',
      initials: 'JS',
      avatarFileId: null,
      avatarUrl: null,
      ...overrides
    };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

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

  // ── Seat-preview rendering ──────────────────────────────────

  it('renders app-position-seat-preview in the capacity cell (not old text)', async () => {
    const fixture = await createComponent([makePosition({})]);
    expect(fixture.nativeElement.querySelector('app-position-seat-preview')).not.toBeNull();
    // Old raw capacity text must not be present
    expect(rowText(fixture)).not.toContain('—/1');
    expect(rowText(fixture)).not.toContain('1/1');
    expect(rowText(fixture)).not.toContain('0/1');
  });

  it('renders one empty circle when no assignedCount / occupantPreview supplied (stale backend)', async () => {
    const fixture = await createComponent([makePosition({ maxOccupancy: 1 })]);
    const emptyCircles = fixture.nativeElement.querySelectorAll('.psp-circle--empty');
    expect(emptyCircles.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.psp-circle--employee')).toBeNull();
  });

  it('renders employee initials circle when occupantPreview provided', async () => {
    const emp = makeEmployee({ initials: 'JS', avatarUrl: null });
    const fixture = await createComponent([
      makePosition({ maxOccupancy: 1, assignedCount: 1, occupantPreview: [emp], remainingAssignedCount: 0 })
    ]);
    expect(fixture.nativeElement.querySelector('.psp-circle--employee')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.psp-initials')?.textContent?.trim()).toBe('JS');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('does NOT render old —/1 text for any occupancy scenario', async () => {
    for (const occ of [null, 0, 1]) {
      const pos = makePosition({ currentOccupancy: occ as number | null });
      const fixture = await createComponent([pos]);
      expect(rowText(fixture)).not.toContain('—/1');
      expect(rowText(fixture)).not.toContain('0/1');
      expect(rowText(fixture)).not.toContain('1/1');
      await TestBed.resetTestingModule();
    }
  });

  it('renders overflow +n circle for large capacity positions', async () => {
    const fixture = await createComponent([makePosition({ maxOccupancy: 10, assignedCount: 0 })]);
    const overflowEl = fixture.nativeElement.querySelector('.psp-circle--overflow') as HTMLElement;
    expect(overflowEl).not.toBeNull();
    expect(overflowEl.textContent).toContain('+7');
  });

  // ── Status badge still present ──────────────────────────────

  it('still shows the Archived status badge for inactive positions', async () => {
    const fixture = await createComponent([makePosition({ isActive: false })]);
    const text = rowText(fixture);
    expect(text).toContain('Archived');
    expect(text).not.toContain('Unassigned');
  });

  it('still shows status badge for active positions (Unassigned when no occupant data)', async () => {
    const fixture = await createComponent([makePosition({ isActive: true })]);
    const text = rowText(fixture);
    expect(text).toMatch(/Unassigned/i);
  });

  it('does not render backend field names in the rendered row', async () => {
    const fixture = await createComponent([makePosition({ currentOccupancy: null })]);
    const text = rowText(fixture);
    expect(text.toLowerCase()).not.toContain('currentoccupancy');
    expect(text.toLowerCase()).not.toContain('checksupported');
    expect(text.toLowerCase()).not.toContain('avatarfileid');
    expect(text.toLowerCase()).not.toContain('remainingassignedcount');
  });

  // ── List/tree toggle regression ─────────────────────────────

  it('renders all positions when given multiple rows', async () => {
    const positions = [
      makePosition({ id: 'pos-1', name: 'CEO' }),
      makePosition({ id: 'pos-2', name: 'CFO', maxOccupancy: 2 })
    ];
    const fixture = await createComponent(positions);
    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2);
    // Each row has its own seat-preview
    const previews = fixture.nativeElement.querySelectorAll('app-position-seat-preview');
    expect(previews.length).toBe(2);
  });
});
