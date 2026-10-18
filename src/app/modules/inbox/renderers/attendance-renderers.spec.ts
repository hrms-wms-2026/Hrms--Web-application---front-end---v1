import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InboxChangeDto, InboxItemDetailDto } from '../models/inbox.dto';
import {
  AttendanceAlertRendererComponent,
  AttendanceCorrectionRendererComponent,
  DeviceChangeRendererComponent,
  LocationChangeRendererComponent,
  WorkModeChangeRendererComponent
} from './attendance-renderers';
import { DEFAULT_INBOX_DETAIL_RENDERERS } from './inbox-detail-renderers';

function detail(changeSet: InboxChangeDto[], extra: Partial<InboxItemDetailDto['item']> = {}): InboxItemDetailDto {
  return {
    item: {
      source: 'attendance', kind: 'correction', id: 'c1', category: 'request', actionType: 'correction', title: 'Correction - Pat',
      subtitle: null, status: 'pending', direction: 'received', severity: null, contextType: 'legal_entity', contextId: null,
      contextName: null, requestedBy: null, requestedTo: null, createdAt: '', updatedAt: '', availableActions: [], unreadMessages: 0,
      isPending: true, facets: {}, ...extra
    },
    steps: [], summary: null, explanation: null, explanationDetails: null, target: null, editablePayloadJson: null, changeSet
  };
}

const row = (field: string, before: string | null, after: string | null, kind = 'text', extra: Partial<InboxChangeDto> = {}): InboxChangeDto =>
  ({ field, label: field, before, after, kind, editable: false, applied: null, ...extra });

describe('attendance renderers', () => {
  function render<T>(component: Type<T>, d: InboxItemDetailDto, extra: Record<string, unknown> | null = null) {
    TestBed.configureTestingModule({ imports: [component], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(component);
    fixture.componentRef.setInput('detail', d);
    fixture.componentRef.setInput('extra', extra);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { el, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('registers every attendance renderer key', () => {
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['attendance-correction']).toBe(AttendanceCorrectionRendererComponent);
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['work-mode-change']).toBe(WorkModeChangeRendererComponent);
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['location-change']).toBe(LocationChangeRendererComponent);
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['device-change']).toBe(DeviceChangeRendererComponent);
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['attendance-alert']).toBe(AttendanceAlertRendererComponent);
  });

  it('correction: draws the current and requested day as bars with the breaks', () => {
    const { el, q } = render(AttendanceCorrectionRendererComponent, detail([
      row('clockInAt', '2026-10-13T09:30:00Z', '2026-10-13T09:00:00Z', 'datetime'),
      row('clockOutAt', null, '2026-10-13T17:00:00Z', 'datetime'),
      row('breaks', null, '[{"BreakStart":"2026-10-13T12:00:00Z","BreakEnd":"2026-10-13T12:30:00Z","BreakType":"lunch"}]', 'breaks')
    ]), { correctionType: 'full_day', notes: 'Forgot to clock out' });

    expect(q('timeline-before')).not.toBeNull();
    expect(q('timeline-after')!.querySelectorAll('[data-testid="timeline-work"]')).toHaveLength(1);
    expect(q('timeline-after')!.querySelectorAll('[data-testid="timeline-break"]')).toHaveLength(1);
    expect(q('timeline-before')!.textContent).toContain('No clock-out');
    expect(el.textContent).toContain('Forgot to clock out');
  });

  it('work mode: says which day moves from which mode to which', () => {
    const { q } = render(WorkModeChangeRendererComponent, detail([
      row('date', null, '2026-10-20', 'date'),
      row('workModeId', 'Office', 'wm2', 'select', { options: [{ value: 'wm2', label: 'Remote' }] })
    ]));
    expect(q('work-mode-summary')!.textContent).toContain('Office → Remote');
  });

  it('location: links the requested and current places on a map and shows the distance', () => {
    const { q } = render(LocationChangeRendererComponent, detail([]),
      { latitude: 6.9, longitude: 79.86, accuracyMeters: 12, currentLatitude: 6.8, currentLongitude: 79.9, distanceMeters: 11800 });

    const link = q('location-map-requested') as HTMLAnchorElement;
    expect(link.href).toContain('mlat=6.9');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(q('location-map-current')).not.toBeNull();
    expect(q('location-distance')!.textContent).toContain('11.8 km');
  });

  it('device: shows the old and new device', () => {
    const { q } = render(DeviceChangeRendererComponent, detail([row('device', 'Old PC (Windows)', 'New Mac (macOS)')]));
    expect(q('device-summary')!.textContent).toContain('Old PC (Windows) → New Mac (macOS)');
  });

  it('alert: shows the day, severity, the source notification and the converted leave', () => {
    const { q } = render(AttendanceAlertRendererComponent, detail([], { kind: 'alert', category: 'alert', title: 'Late clock-in - Pat', severity: 'warning' }), {
      signalKey: 'late_clock_ins', workDate: '2026-10-13', severity: 'warning', status: 'resolved', outcome: 'convert_to_leave',
      convertedLeaveRequestId: 'l9', details: { title: 'Clocked in 40 minutes late' }
    });

    expect(q('alert-severity')!.textContent).toContain('warning');
    expect(q('alert-source')!.textContent).toContain('Clocked in 40 minutes late');
    expect((q('alert-converted-leave') as HTMLAnchorElement).getAttribute('href')).toBe('/inbox/leave/request/l9');
  });
});
