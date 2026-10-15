import { TestBed } from '@angular/core/testing';
import { InboxChangeDto } from '../../models/inbox.dto';
import { InboxChangeSetComponent, buildEditedPayload, validateEdits } from './inbox-change-set.component';

const CHANGES: InboxChangeDto[] = [
  { field: 'title', label: 'Title', before: 'Old', after: 'New', kind: 'text', editable: true, applied: null },
  { field: 'estimatedHours', label: 'Estimate', before: '4', after: '8', kind: 'hours', editable: true, applied: null },
  { field: 'dueDate', label: 'Due date', before: '2026-10-01', after: '2026-10-20', kind: 'date', editable: false, applied: '2026-10-22' }
];

describe('InboxChangeSetComponent', () => {
  function render(editable: boolean) {
    TestBed.configureTestingModule({ imports: [InboxChangeSetComponent] });
    const fixture = TestBed.createComponent(InboxChangeSetComponent);
    fixture.componentRef.setInput('changes', CHANGES);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
    return fixture;
  }

  it('shows before and requested values, and the applied value when the approver changed it', () => {
    const el: HTMLElement = render(false).nativeElement;
    const rows = Array.from(el.querySelectorAll('[data-testid="inbox-change"]')) as HTMLElement[];

    expect(rows.map((r) => r.getAttribute('data-field'))).toEqual(['title', 'estimatedHours', 'dueDate']);
    expect(rows[1].textContent).toContain('4h');
    expect(rows[1].textContent).toContain('8h');
    expect(rows[2].querySelector('[data-testid="inbox-change-applied"]')?.textContent).toContain('Requested');
    expect(el.querySelector('input')).toBeNull();
  });

  it('lets the approver edit editable fields and emits the edits', () => {
    const fixture = render(true);
    const edits: Record<string, string>[] = [];
    fixture.componentInstance.editsChange.subscribe((e) => edits.push(e));
    const input = fixture.nativeElement.querySelector('[data-testid="inbox-edit-title"]') as HTMLInputElement;

    input.value = 'Newer';
    input.dispatchEvent(new Event('input'));
    input.value = 'New';
    input.dispatchEvent(new Event('input'));

    expect(edits[0]).toEqual({ title: 'Newer' });
    expect(edits[1]).toEqual({});
    expect(fixture.nativeElement.querySelector('[data-testid="inbox-edit-dueDate"]')).toBeNull();
  });
});

describe('edit-before-approve helpers', () => {
  it('overwrites only the edited keys on the requested payload, typing numbers', () => {
    expect(buildEditedPayload('{"title":"New","estimatedHours":8,"x":1}', CHANGES, { estimatedHours: '6', title: '' }))
      .toBe('{"title":null,"estimatedHours":6,"x":1}');
    expect(buildEditedPayload('{"title":"New"}', CHANGES, {})).toBeUndefined();
  });

  it('validates numeric edits', () => {
    expect(validateEdits(CHANGES, { estimatedHours: 'abc' })).toEqual({ estimatedHours: 'Enter a number.' });
    expect(validateEdits(CHANGES, { estimatedHours: '0' })).toEqual({ estimatedHours: 'Hours must be greater than zero.' });
    expect(validateEdits(CHANGES, { estimatedHours: '2', title: 'x' })).toEqual({});
  });
});

describe('InboxChangeSetComponent field kinds (FS1)', () => {
  const KINDS: InboxChangeDto[] = [
    { field: 'startAt', label: 'From', before: null, after: '2026-10-13T09:00:00.000Z', kind: 'datetime', editable: true, applied: null },
    { field: 'shiftStart', label: 'Shift start', before: '08:00', after: '09:00', kind: 'time', editable: true, applied: null },
    { field: 'workModeId', label: 'Work mode', before: 'Office', after: 'wm2', kind: 'select', editable: true, applied: null,
      options: [{ value: 'wm1', label: 'Office' }, { value: 'wm2', label: 'Remote' }] },
    { field: 'assigneeId', label: 'Assignee', before: null, after: 'e1', kind: 'employee', editable: true, applied: null,
      options: [{ value: 'e1', label: 'Anu' }, { value: 'e2', label: 'Bala' }] },
    { field: 'breaks', label: 'Breaks', before: null, kind: 'breaks', editable: true, applied: null,
      after: '[{"BreakStart":"2026-10-13T12:00:00Z","BreakEnd":"2026-10-13T12:30:00Z","BreakType":"lunch"}]' }
  ];

  function render(changes = KINDS) {
    TestBed.configureTestingModule({ imports: [InboxChangeSetComponent] });
    const fixture = TestBed.createComponent(InboxChangeSetComponent);
    fixture.componentRef.setInput('changes', changes);
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const edits: Record<string, string>[] = [];
    fixture.componentInstance.editsChange.subscribe((e) => edits.push(e));
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(id: string) => el.querySelector(`[data-testid="${id}"]`) as T;
    const set = (target: HTMLInputElement | HTMLSelectElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input'));
      fixture.detectChanges();
    };
    return { fixture, el, q, set, edits };
  }

  it('edits a datetime in local time and sends it as an ISO instant', () => {
    const { q, set, edits } = render();
    const input = q<HTMLInputElement>('inbox-edit-startAt');

    expect(input.type).toBe('datetime-local');
    set(input, '2026-10-14T10:30');

    expect(edits.at(-1)).toEqual({ startAt: new Date('2026-10-14T10:30').toISOString() });
  });

  it('edits a time with a time input', () => {
    const { q, set, edits } = render();
    const input = q<HTMLInputElement>('inbox-edit-shiftStart');

    expect(input.type).toBe('time');
    set(input, '09:30');
    expect(edits.at(-1)).toEqual({ shiftStart: '09:30' });
  });

  it('a select or employee row offers its options and shows the chosen label read-only', () => {
    const { q, set, edits } = render();
    const select = q<HTMLSelectElement>('inbox-edit-workModeId');

    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(['Office', 'Remote']);
    set(select, 'wm1');
    expect(edits.at(-1)).toEqual({ workModeId: 'wm1' });
    expect(Array.from(q<HTMLSelectElement>('inbox-edit-assigneeId').options).map((o) => o.value)).toEqual(['e1', 'e2']);

    TestBed.resetTestingModule();
    const readOnly = render(KINDS.map((c) => ({ ...c, editable: false }))).el;
    expect(readOnly.querySelector('[data-field="workModeId"]')?.textContent).toContain('Remote');
    expect(readOnly.querySelector('[data-field="assigneeId"]')?.textContent).toContain('Anu');
  });

  it('breaks are edited as a list: change, add and remove rows', () => {
    const { q, set, edits, fixture } = render();

    expect(q('inbox-edit-breaks').querySelectorAll('[data-testid="inbox-break-row"]')).toHaveLength(1);
    set(q<HTMLInputElement>('inbox-break-end-0'), '2026-10-13T13:00');
    (q<HTMLButtonElement>('inbox-break-add')).click();
    fixture.detectChanges();
    expect(JSON.parse(edits.at(-1)!['breaks'])).toHaveLength(2);
    (q<HTMLButtonElement>('inbox-break-remove-1')).click();
    fixture.detectChanges();

    const breaks = JSON.parse(edits.at(-1)!['breaks']);
    expect(breaks).toEqual([{ breakStart: '2026-10-13T12:00:00Z', breakEnd: new Date('2026-10-13T13:00').toISOString(), breakType: 'lunch' }]);
  });
});

describe('edit-before-approve helpers (FS1 kinds)', () => {
  const BREAKS: InboxChangeDto = { field: 'breaks', label: 'Breaks', before: null, after: '[]', kind: 'breaks', editable: true, applied: null };
  const FROM: InboxChangeDto = { field: 'startAt', label: 'From', before: null, after: '2026-10-13T09:00:00Z', kind: 'datetime', editable: true, applied: null };

  it('sends breaks as a JSON array, not a string', () => {
    const edited = buildEditedPayload('{"clockInAt":null,"breaks":null}', [BREAKS],
      { breaks: '[{"breakStart":"2026-10-13T12:00:00.000Z","breakEnd":"2026-10-13T12:30:00.000Z","breakType":"lunch"}]' });
    expect(JSON.parse(edited!).breaks).toEqual([{ breakStart: '2026-10-13T12:00:00.000Z', breakEnd: '2026-10-13T12:30:00.000Z', breakType: 'lunch' }]);
  });

  it('rejects a break that ends before it starts, a break without times, and an invalid datetime', () => {
    expect(validateEdits([BREAKS], { breaks: '[{"breakStart":"2026-10-13T13:00:00Z","breakEnd":"2026-10-13T12:00:00Z","breakType":"lunch"}]' }))
      .toEqual({ breaks: 'Each break must end after it starts.' });
    expect(validateEdits([BREAKS], { breaks: '[{"breakStart":"","breakEnd":"","breakType":"lunch"}]' }))
      .toEqual({ breaks: 'Each break needs a start and an end.' });
    expect(validateEdits([FROM], { startAt: 'not a date' })).toEqual({ startAt: 'Enter a valid date and time.' });
  });
});
