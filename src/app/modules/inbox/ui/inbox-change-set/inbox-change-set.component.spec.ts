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
