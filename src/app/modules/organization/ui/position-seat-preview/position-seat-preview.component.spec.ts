import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PositionSeatPreviewComponent } from './position-seat-preview.component';
import { OccupantPreviewItem } from '../../models/position.model';
import { environment } from '../../../../../environments/environment';

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

describe('PositionSeatPreviewComponent', () => {
  async function createComponent(
    inputs: {
      assignedCount?: number;
      maxOccupancy?: number;
      occupantPreview?: OccupantPreviewItem[];
      remainingAssignedCount?: number;
      maxVisible?: number;
    } = {}
  ) {
    await TestBed.configureTestingModule({
      imports: [PositionSeatPreviewComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(PositionSeatPreviewComponent);
    const comp = fixture.componentInstance;

    comp.assignedCount = inputs.assignedCount ?? 0;
    comp.maxOccupancy = inputs.maxOccupancy ?? 1;
    comp.occupantPreview = inputs.occupantPreview ?? [];
    comp.remainingAssignedCount = inputs.remainingAssignedCount ?? 0;
    if (inputs.maxVisible !== undefined) comp.maxVisible = inputs.maxVisible;

    fixture.detectChanges();
    return fixture;
  }

  function circleCount(fixture: ReturnType<typeof TestBed.createComponent>): number {
    return fixture.debugElement.queryAll(By.css('.psp-circle')).length;
  }

  function circleKinds(fixture: ReturnType<typeof TestBed.createComponent>): string[] {
    return fixture.debugElement.queryAll(By.css('.psp-circle')).map((de) => {
      const el = de.nativeElement as HTMLElement;
      if (el.classList.contains('psp-circle--employee')) return 'employee';
      if (el.classList.contains('psp-circle--empty')) return 'empty';
      if (el.classList.contains('psp-circle--overflow')) return 'overflow';
      return 'unknown';
    });
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Model / data flow ───────────────────────────────────────

  it('capacity 1 assigned 0 renders one empty circle', async () => {
    const fixture = await createComponent({ maxOccupancy: 1, assignedCount: 0 });
    expect(circleKinds(fixture)).toEqual(['empty']);
  });

  it('capacity 1 assigned 1 with initials renders one employee circle (no image)', async () => {
    const emp = makeEmployee({ initials: 'JS', avatarUrl: null });
    const fixture = await createComponent({
      maxOccupancy: 1,
      assignedCount: 1,
      occupantPreview: [emp]
    });
    const kinds = circleKinds(fixture);
    expect(kinds).toEqual(['employee']);

    const circle = fixture.debugElement.query(By.css('.psp-circle--employee'));
    expect(circle.nativeElement.querySelector('.psp-initials')).not.toBeNull();
    expect(circle.nativeElement.querySelector('.psp-initials').textContent.trim()).toBe('JS');
    expect(circle.nativeElement.querySelector('img')).toBeNull();
  });

  it('assigned employee with avatarUrl renders <img> not initials', async () => {
    const emp = makeEmployee({ avatarUrl: 'https://cdn.example.com/avatar.jpg' });
    const fixture = await createComponent({
      maxOccupancy: 1,
      assignedCount: 1,
      occupantPreview: [emp]
    });
    const circle = fixture.debugElement.query(By.css('.psp-circle--employee'));
    const img = circle.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('cdn.example.com');
    expect(circle.nativeElement.querySelector('.psp-initials')).toBeNull();
  });

  it('resolves avatarFileId through the canonical authenticated file endpoint', async () => {
    const emp = makeEmployee({ avatarFileId: 'file-uuid-abc', avatarUrl: null });
    const fixture = await createComponent({
      maxOccupancy: 1,
      assignedCount: 1,
      occupantPreview: [emp]
    });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain(`${environment.apiUrl}/files/file-uuid-abc`);
  });

  it('capacity 3 assigned 0 renders three empty circles', async () => {
    const fixture = await createComponent({ maxOccupancy: 3, assignedCount: 0 });
    expect(circleKinds(fixture)).toEqual(['empty', 'empty', 'empty']);
  });

  it('capacity 5 assigned 0 renders three empty circles + overflow +2', async () => {
    const fixture = await createComponent({ maxOccupancy: 5, assignedCount: 0 });
    const kinds = circleKinds(fixture);
    expect(kinds).toEqual(['empty', 'empty', 'empty', 'overflow']);

    const overflowEl: HTMLElement = fixture.debugElement.query(
      By.css('.psp-circle--overflow')
    ).nativeElement;
    expect(overflowEl.textContent).toContain('+2');
  });

  it('capacity 5 assigned 2 renders 2 employee circles + 1 empty + overflow +2', async () => {
    const emps = [makeEmployee({ initials: 'JS' }), makeEmployee({ employeeId: 'emp-2', initials: 'MK', displayName: 'Mike K', avatarFileId: null, avatarUrl: null })];
    const fixture = await createComponent({
      maxOccupancy: 5,
      assignedCount: 2,
      occupantPreview: emps
    });
    expect(circleKinds(fixture)).toEqual(['employee', 'employee', 'empty', 'overflow']);

    const overflowEl: HTMLElement = fixture.debugElement.query(
      By.css('.psp-circle--overflow')
    ).nativeElement;
    expect(overflowEl.textContent).toContain('+2');
  });

  it('capacity 5 assigned 4 renders 3 employee circles + overflow +2 (4th employee hidden)', async () => {
    const emps = [
      makeEmployee({ employeeId: 'e1', initials: 'JS', displayName: 'Jane S' }),
      makeEmployee({ employeeId: 'e2', initials: 'MK', displayName: 'Mike K' }),
      makeEmployee({ employeeId: 'e3', initials: 'AR', displayName: 'Alex R' }),
      makeEmployee({ employeeId: 'e4', initials: 'BT', displayName: 'Bob T' })
    ];
    const fixture = await createComponent({
      maxOccupancy: 5,
      assignedCount: 4,
      occupantPreview: emps
    });
    expect(circleKinds(fixture)).toEqual(['employee', 'employee', 'employee', 'overflow']);
    const overflowEl: HTMLElement = fixture.debugElement.query(
      By.css('.psp-circle--overflow')
    ).nativeElement;
    expect(overflowEl.textContent).toContain('+2');
  });

  it('capacity 10 assigned 4 renders 3 employee circles + overflow +7', async () => {
    const emps = [
      makeEmployee({ employeeId: 'e1', initials: 'JS' }),
      makeEmployee({ employeeId: 'e2', initials: 'MK' }),
      makeEmployee({ employeeId: 'e3', initials: 'AR' }),
      makeEmployee({ employeeId: 'e4', initials: 'BT' })
    ];
    const fixture = await createComponent({
      maxOccupancy: 10,
      assignedCount: 4,
      occupantPreview: emps
    });
    expect(circleKinds(fixture)).toEqual(['employee', 'employee', 'employee', 'overflow']);
    const overflowEl: HTMLElement = fixture.debugElement.query(
      By.css('.psp-circle--overflow')
    ).nativeElement;
    expect(overflowEl.textContent).toContain('+7');
  });

  it('maxVisible limit is enforced — never more than maxVisible circles', async () => {
    const emps = Array.from({ length: 10 }, (_, i) =>
      makeEmployee({ employeeId: `e${i}`, initials: `E${i}`, displayName: `Employee ${i}` })
    );
    const fixture = await createComponent({
      maxOccupancy: 20,
      assignedCount: 10,
      occupantPreview: emps
    });
    expect(circleCount(fixture)).toBe(4); // default maxVisible = 4
  });

  it('capacity 4 assigned 0 renders four empty circles with no overflow', async () => {
    const fixture = await createComponent({ maxOccupancy: 4, assignedCount: 0 });
    expect(circleKinds(fixture)).toEqual(['empty', 'empty', 'empty', 'empty']);
    expect(fixture.nativeElement.querySelector('.psp-circle--overflow')).toBeNull();
  });

  it('aria-label and title for assigned employee include displayName', async () => {
    const emp = makeEmployee({ displayName: 'Jane Smith', initials: 'JS' });
    const fixture = await createComponent({
      maxOccupancy: 1,
      assignedCount: 1,
      occupantPreview: [emp]
    });
    const circle: HTMLElement = fixture.debugElement.query(
      By.css('.psp-circle--employee')
    ).nativeElement;
    expect(circle.title).toContain('Jane Smith');
    expect(circle.getAttribute('aria-label')).toContain('Jane Smith');
  });

  it('empty seat has aria-label "Empty seat"', async () => {
    const fixture = await createComponent({ maxOccupancy: 1, assignedCount: 0 });
    const circle: HTMLElement = fixture.debugElement.query(
      By.css('.psp-circle--empty')
    ).nativeElement;
    expect(circle.getAttribute('aria-label')).toBe('Empty seat');
  });

  it('does not crash when all inputs are absent (stale backend fallback)', async () => {
    await TestBed.configureTestingModule({
      imports: [PositionSeatPreviewComponent]
    }).compileComponents();
    const fixture = TestBed.createComponent(PositionSeatPreviewComponent);
    // Use defaults — no inputs set at all
    expect(() => fixture.detectChanges()).not.toThrow();
    // Default: maxOccupancy=1 assigned=0 → one empty circle
    expect(circleKinds(fixture)).toEqual(['empty']);
  });
});
