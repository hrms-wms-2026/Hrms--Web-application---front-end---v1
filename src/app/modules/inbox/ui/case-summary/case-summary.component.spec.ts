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

  it('shows a change as before → after and leaves out empty rows', () => {
    const s = summarize([
      change('work_mode', 'Work mode', 'Remote', { before: 'Office' }),
      change('note', 'Note', null),
      change('hours', 'Hours', '6', { kind: 'hours', before: '8' })
    ])!;

    expect(s.headline).toBe('Office → Remote');
    expect(s.when).toBeNull();
    expect(s.lines).toEqual([{ label: 'Hours', before: '8h', after: '6h' }]);
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
