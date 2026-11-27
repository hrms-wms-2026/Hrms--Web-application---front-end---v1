import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InboxChangeDto, InboxItemDetailDto } from '../models/inbox.dto';
import { parseBreaks } from '../ui/inbox-change-set/inbox-change-set.component';
import { pick } from './renderer.util';

/** A change-set row of the item. Every renderer takes the `extra` and `detail` inputs (see INBOX_DETAIL_RENDERERS). */
function rowOf(detail: InboxItemDetailDto | null, field: string): InboxChangeDto | null {
  return detail?.changeSet.find((c) => c.field === field) ?? null;
}

interface Segment { left: number; width: number }
interface DayBar { work: Segment | null; breaks: Segment[]; label: string }

const time = (iso: string | null) =>
  (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '?');

/** "attendance-correction": the day as recorded vs as requested, as two bars on one time axis. */
@Component({
  selector: 'app-attendance-correction-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      <div class="rnd__label">The day</div>
      <div class="tl">
        @for (bar of bars(); track bar.key) {
          <div class="tl__row">
            <span class="tl__name">{{ bar.name }}</span>
            <div class="tl__track" [attr.data-testid]="'timeline-' + bar.key" [attr.aria-label]="bar.name + ': ' + bar.day.label">
              @if (bar.day.work; as w) {
                <span class="tl__work" data-testid="timeline-work" [style.left.%]="w.left" [style.width.%]="w.width"></span>
              }
              @for (b of bar.day.breaks; track $index) {
                <span class="tl__break" data-testid="timeline-break" [style.left.%]="b.left" [style.width.%]="b.width"></span>
              }
              <span class="tl__label">{{ bar.day.label }}</span>
            </div>
          </div>
        }
      </div>
      @if (notes()) { <p class="rnd__note">{{ notes() }}</p> }
    </div>
  `,
  styleUrl: './renderers.css'
})
export class AttendanceCorrectionRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);
  private readonly row = (field: string) => rowOf(this.detail(), field);

  protected readonly notes = computed(() => pick<string>(this.extra(), 'notes'));

  protected readonly bars = computed(() => {
    const clockIn = this.row('clockInAt');
    const clockOut = this.row('clockOutAt');
    const breaks = this.row('breaks');
    const before = { in: clockIn?.before ?? null, out: clockOut?.before ?? null, breaks: parseBreaks(breaks?.before) };
    const after = {
      in: clockIn?.applied ?? clockIn?.after ?? null, out: clockOut?.applied ?? clockOut?.after ?? null,
      breaks: parseBreaks(breaks?.applied ?? breaks?.after)
    };
    const times = [before.in, before.out, after.in, after.out, ...[...before.breaks, ...after.breaks].flatMap((b) => [b.breakStart, b.breakEnd])]
      .filter((t): t is string => !!t).map((t) => new Date(t).getTime()).filter((t) => !isNaN(t));
    const start = times.length ? Math.min(...times) : 0;
    const span = Math.max(1, (times.length ? Math.max(...times) : 1) - start);
    const pos = (iso: string) => ((new Date(iso).getTime() - start) / span) * 100;
    const seg = (from: string, to: string): Segment => ({ left: pos(from), width: Math.max(1, pos(to) - pos(from)) });
    const day = (d: typeof before): DayBar => ({
      work: d.in && d.out ? seg(d.in, d.out) : null,
      breaks: d.breaks.filter((b) => b.breakStart && b.breakEnd).map((b) => seg(b.breakStart, b.breakEnd)),
      label: !d.in && !d.out ? 'Nothing recorded' : `${time(d.in)} – ${d.out ? time(d.out) : 'No clock-out'}`
    });
    return [{ key: 'before', name: 'Recorded', day: day(before) }, { key: 'after', name: 'Requested', day: day(after) }];
  });
}

/** "work-mode-change": the day and the mode it moves from and to. */
@Component({
  selector: 'app-work-mode-change-renderer',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      <p class="rnd__note" data-testid="work-mode-summary">
        {{ day() ? (day() | date: 'EEE, MMM d') : 'The day' }}: {{ current() }} → {{ requested() }}
      </p>
    </div>
  `,
  styleUrl: './renderers.css'
})
export class WorkModeChangeRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);
  private readonly row = (field: string) => rowOf(this.detail(), field);

  protected readonly day = computed(() => this.row('date')?.after ?? null);
  protected readonly current = computed(() => this.row('workModeId')?.before ?? 'No work mode');
  protected readonly requested = computed(() => {
    const r = this.row('workModeId');
    const value = r?.applied ?? r?.after ?? null;
    return r?.options?.find((o) => o.value === value)?.label ?? value ?? '—';
  });
}

/** "location-change": the requested and current places on a map, and how far apart they are. */
@Component({
  selector: 'app-location-change-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      <div class="rnd__box">
        @if (requested(); as r) {
          <div class="rnd__row"><span class="rnd__key">Requested place</span>
            <a class="rnd__value" data-testid="location-map-requested" [href]="r" target="_blank" rel="noopener noreferrer">Open map</a></div>
        }
        @if (current(); as c) {
          <div class="rnd__row"><span class="rnd__key">Current place</span>
            <a class="rnd__value" data-testid="location-map-current" [href]="c" target="_blank" rel="noopener noreferrer">Open map</a></div>
        }
        @if (distance(); as d) {
          <div class="rnd__row" data-testid="location-distance"><span class="rnd__key">Distance</span><span class="rnd__value">{{ d }}</span></div>
        }
        @if (accuracy() != null) {
          <div class="rnd__row"><span class="rnd__key">GPS accuracy</span><span class="rnd__value">± {{ accuracy() }} m</span></div>
        }
      </div>
    </div>
  `,
  styleUrl: './renderers.css'
})
export class LocationChangeRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);
  private readonly row = (field: string) => rowOf(this.detail(), field);

  private map(lat: number | null, lon: number | null): string | null {
    return lat == null || lon == null ? null : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }

  protected readonly requested = computed(() => this.map(pick<number>(this.extra(), 'latitude'), pick<number>(this.extra(), 'longitude')));
  protected readonly current = computed(() =>
    this.map(pick<number>(this.extra(), 'currentLatitude'), pick<number>(this.extra(), 'currentLongitude')));
  protected readonly accuracy = computed(() => pick<number>(this.extra(), 'accuracyMeters'));
  protected readonly distance = computed(() => {
    const m = pick<number>(this.extra(), 'distanceMeters');
    return m == null ? null : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  });
}

/** "device-change": the device being replaced and the new one. */
@Component({
  selector: 'app-device-change-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      <p class="rnd__note" data-testid="device-summary">{{ oldDevice() }} → {{ newDevice() }}</p>
      <p class="rnd__muted">Approving makes the new device the one this person clocks in from.</p>
    </div>
  `,
  styleUrl: './renderers.css'
})
export class DeviceChangeRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);
  private readonly row = (field: string) => rowOf(this.detail(), field);

  protected readonly oldDevice = computed(() => this.row('device')?.before ?? 'No registered device');
  protected readonly newDevice = computed(() => this.row('device')?.after ?? '—');
}

/** "attendance-alert": the day, severity, the notification that raised it and, once converted, the leave. */
@Component({
  selector: 'app-attendance-alert-renderer',
  standalone: true,
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      <div class="rnd__box">
        @if (workDate()) {
          <div class="rnd__row"><span class="rnd__key">Day</span><span class="rnd__value">{{ workDate() | date: 'EEE, MMM d, y' }}</span></div>
        }
        <div class="rnd__row"><span class="rnd__key">Severity</span><span class="rnd__badge" data-testid="alert-severity">{{ severity() }}</span></div>
        @if (sourceTitle()) {
          <div class="rnd__row" data-testid="alert-source"><span class="rnd__key">Raised by</span><span class="rnd__value">{{ sourceTitle() }}</span></div>
        }
        @if (convertedLeaveId(); as leaveId) {
          <div class="rnd__row"><span class="rnd__key">Converted to</span>
            <a class="rnd__value" data-testid="alert-converted-leave" [routerLink]="['/inbox', 'leave', 'request', leaveId]">Leave request</a></div>
        }
      </div>
    </div>
  `,
  styleUrl: './renderers.css'
})
export class AttendanceAlertRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);
  private readonly row = (field: string) => rowOf(this.detail(), field);

  protected readonly workDate = computed(() => pick<string>(this.extra(), 'workDate'));
  protected readonly severity = computed(() => pick<string>(this.extra(), 'severity') ?? this.detail()?.item.severity ?? 'warning');
  protected readonly sourceTitle = computed(() => pick<string>(pick(this.extra(), 'details'), 'title'));
  protected readonly convertedLeaveId = computed(() => pick<string>(this.extra(), 'convertedLeaveRequestId'));
}
