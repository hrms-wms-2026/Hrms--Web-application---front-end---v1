import { TestBed } from '@angular/core/testing';
import { DEFAULT_INBOX_DETAIL_RENDERERS } from './inbox-detail-renderers';
import { MeetingExceptionRendererComponent } from './meeting-exception-renderer.component';

const EXTRA = {
  severity: 'medium',
  incidents: [
    {
      id: 'i1', ruleCode: 'CAL-ATT-LATE', rule: 'Joined late', occurrenceStart: '2026-10-13T09:00:00Z', confidence: 'provider', estimated: false,
      facts: { title: 'Sprint review', start: '2026-10-13T09:00:00Z', end: '2026-10-13T10:00:00Z', joinedAt: '2026-10-13T09:15:00Z', leftAt: '2026-10-13T10:00:00Z', minutesLate: 15 },
      rsvpHistory: [{ from: 'pending', to: 'accepted', at: '2026-10-10T08:00:00Z' }]
    },
    {
      id: 'i2', ruleCode: 'CAL-ATT-NOSHOW', rule: 'Missed meeting', occurrenceStart: '2026-10-14T09:00:00Z', confidence: 'agent', estimated: true,
      facts: { title: 'Planning', start: '2026-10-14T09:00:00Z', end: '2026-10-14T10:00:00Z' }, rsvpHistory: []
    }
  ]
};

describe('MeetingExceptionRendererComponent', () => {
  function render(extra: unknown) {
    TestBed.configureTestingModule({ imports: [MeetingExceptionRendererComponent] });
    const fixture = TestBed.createComponent(MeetingExceptionRendererComponent);
    fixture.componentRef.setInput('extra', extra);
    fixture.componentRef.setInput('detail', null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('is registered as the "meeting-exception-evidence" renderer', () => {
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['meeting-exception-evidence']).toBe(MeetingExceptionRendererComponent);
  });

  it('lists each incident with its meeting, rule, joined/left bar, RSVP history and an estimated badge', () => {
    const el = render(EXTRA);
    const rows = Array.from(el.querySelectorAll('[data-testid="meeting-incident"]')) as HTMLElement[];

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Sprint review');
    expect(rows[0].textContent).toContain('Joined late');
    const bar = rows[0].querySelector('[data-testid="meeting-presence"]') as HTMLElement;
    expect(bar.style.left).toBe('25%');
    expect(bar.style.width).toBe('75%');
    expect(rows[0].querySelector('[data-testid="meeting-rsvp"]')?.textContent).toContain('pending → accepted');
    expect(rows[0].querySelector('[data-testid="meeting-estimated"]')).toBeNull();
    expect(rows[1].querySelector('[data-testid="meeting-estimated"]')?.textContent).toContain('estimated');
    expect(rows[1].querySelector('[data-testid="meeting-presence"]')).toBeNull();
  });

  it('shows nothing broken for an empty payload', () => {
    expect(render(null).querySelectorAll('[data-testid="meeting-incident"]')).toHaveLength(0);
  });
});
