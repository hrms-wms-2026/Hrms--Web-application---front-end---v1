import { TestBed } from '@angular/core/testing';
import { InboxChangeDto } from '../../models/inbox.dto';
import { CaseSummaryComponent, summarize } from './case-summary.component';

function change(field: string, label: string, after: string | null, extra: Partial<InboxChangeDto> = {}): InboxChangeDto {
  return { field, label, before: null, after, kind: 'text', editable: false, applied: null, ...extra };
}

describe('summarize', () => {
  it('reads an attendance alert as headline, day and its outcome - not Current/Requested boxes', () => {
    const s = summarize([
      change('alert', 'Alert', 'Late clock-in'),
      change('day', 'Day', '2026-10-12', { kind: 'date' }),
      change('outcome', 'Outcome', 'Confirmed - keep counting it')
    ])!;

    expect(s.headline).toBe('Late clock-in');
    expect(s.when).toContain('Oct');
    expect(s.when).toContain('12');
    expect(s.lines).toEqual([{ label: 'Outcome', before: null, after: 'Confirmed - keep counting it' }]);
  });

  it('a task or module update shows labelled before → after lines, with no unlabelled headline', () => {
    const s = summarize([
      change('priority', 'Priority', 'High', { kind: 'priority', before: 'low' }),
      change('note', 'Note', null),
      change('hours', 'Estimate', '6', { kind: 'hours', before: '8' })
    ])!;

    expect(s.headline).toBeNull();
    expect(s.lines).toEqual([
      { label: 'Priority', before: 'Low', after: 'High' },
      { label: 'Estimate', before: '8h', after: '6h' }
    ]);
  });

  it('a seat increase keeps "Extra seats 3" as a line instead of a bare "3" headline', () => {
    const s = summarize([
      change('seats', 'Extra seats', '3'),
      change('current', 'Seats when requested', '20'),
      change('approvers', 'Approvers', 'Dapi Owner')
    ])!;

    expect(s.headline).toBeNull();
    expect(s.lines.map((l) => `${l.label}: ${l.after}`)).toEqual(['Extra seats: 3', 'Seats when requested: 20', 'Approvers: Dapi Owner']);
  });

  it('a position approval and a new task are headed by who or what they are about', () => {
    const position = summarize([
      change('employee', 'New employee', 'Priya Raj'),
      change('position', 'Position', 'Designer'),
      change('start', 'Start date', '2026-11-02', { kind: 'date' })
    ])!;
    expect(position.headline).toBe('Priya Raj');
    expect(position.when).toContain('Nov');
    expect(position.lines).toEqual([{ label: 'Position', before: null, after: 'Designer' }]);

    expect(summarize([change('title', 'Title', 'Fix login'), change('assignee', 'Assignee', 'Anu')])!.headline).toBe('Fix login');
  });

  it('is nothing when every row is empty', () => {
    expect(summarize([change('a', 'A', null), change('b', 'B', '')])).toBeNull();
  });
});

describe('CaseSummaryComponent', () => {
  it('opens the editable rows from "Edit" when the approver may change the request', async () => {
    TestBed.configureTestingModule({ imports: [CaseSummaryComponent] });
    const fixture = TestBed.createComponent(CaseSummaryComponent);
    fixture.componentRef.setInput('changes', [change('title', 'Title', 'Fix login', { editable: true })]);
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-inbox-change-set')).toBeNull();
    (el.querySelector('[data-testid="case-summary-edit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-inbox-change-set')).not.toBeNull();
  });
});
