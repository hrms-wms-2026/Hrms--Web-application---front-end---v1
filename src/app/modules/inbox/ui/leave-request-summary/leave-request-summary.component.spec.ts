import { TestBed } from '@angular/core/testing';
import { InboxChangeDto } from '../../models/inbox.dto';
import { LeaveRequestSummaryComponent } from './leave-request-summary.component';

function row(field: string, after: string | null, extra: Partial<InboxChangeDto> = {}): InboxChangeDto {
  return { field, label: field, before: null, after, kind: 'text', editable: false, applied: null, ...extra };
}

const START = new Date(2026, 9, 29, 9, 0).toISOString();
const END = new Date(2026, 9, 29, 18, 0).toISOString();
const CHANGES = [
  row('leave_type', 'Sick Leave'),
  row('startAt', START, { kind: 'datetime', editable: true }),
  row('endAt', END, { kind: 'datetime', editable: true }),
  row('total_hours', '8'), row('paid_hours', '8'), row('unpaid_hours', '0'),
  row('reason', 'Fever')
];

describe('LeaveRequestSummaryComponent', () => {
  function render(editable = false) {
    TestBed.configureTestingModule({ imports: [LeaveRequestSummaryComponent] });
    const fixture = TestBed.createComponent(LeaveRequestSummaryComponent);
    fixture.componentRef.setInput('changes', CHANGES);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    return { fixture, el, q };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows one compact card: type, one-day range, hours and reason - no current/requested rows', () => {
    const { el, q } = render();

    expect(el.textContent).toContain('Sick Leave');
    expect(q('leave-request-when')!.textContent).toContain('–');
    expect(q('leave-request-when')!.textContent).toContain('(8 h · Paid)');
    expect(el.textContent).toContain('Fever');
    expect(el.textContent).not.toContain('CURRENT');
    expect(el.textContent).not.toContain('Requested');
    expect(q('leave-request-edit')).toBeNull();
  });

  it('says when the leave is unpaid, or how it is split', () => {
    const unpaid = CHANGES.map((c) => (c.field === 'paid_hours' ? { ...c, after: '0' } : c.field === 'unpaid_hours' ? { ...c, after: '8' } : c));
    TestBed.configureTestingModule({ imports: [LeaveRequestSummaryComponent] });
    const fixture = TestBed.createComponent(LeaveRequestSummaryComponent);
    fixture.componentRef.setInput('changes', unpaid);
    fixture.detectChanges();
    const hours = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="leave-request-hours"]')!.textContent;
    expect(hours()).toContain('(8 h · Unpaid)');

    fixture.componentRef.setInput('changes', unpaid.map((c) => (c.field === 'paid_hours' ? { ...c, after: '6' } : c.field === 'unpaid_hours' ? { ...c, after: '2' } : c)));
    fixture.detectChanges();
    expect(hours()).toContain('(8 h · 6 h paid, 2 h unpaid)');
  });

  it('lets the approver edit the dates and reports the edits', () => {
    const { fixture, q } = render(true);
    const edits: Record<string, string>[] = [];
    fixture.componentInstance.editsChange.subscribe((e) => edits.push(e));

    q('leave-request-edit')!.click();
    fixture.detectChanges();
    const from = q('inbox-edit-startAt') as HTMLInputElement;
    from.value = '2026-10-30T10:00';
    from.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(edits.at(-1)).toEqual({ startAt: new Date('2026-10-30T10:00').toISOString() });
    expect(q('leave-request-when')!.textContent).toContain('Oct 30');

    q('leave-request-edit-reset')!.click();
    expect(edits.at(-1)).toEqual({});
  });
});
