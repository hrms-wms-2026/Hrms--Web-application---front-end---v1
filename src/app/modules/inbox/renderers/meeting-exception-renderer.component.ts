import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InboxItemDetailDto } from '../models/inbox.dto';
import { pick } from './renderer.util';

interface MeetingIncidentView {
  id: string;
  rule: string;
  title: string;
  start: string | null;
  estimated: boolean;
  /** The part of the meeting the person was in, as a share of the meeting (null without join/leave facts). */
  presence: { left: number; width: number } | null;
  rsvp: string[];
}

const pct = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

/** "meeting-exception-evidence": a calendar meeting case - per incident the meeting, its time, the rule, the joined/left
 *  bar, the RSVP history and an "estimated" badge for desktop-agent detections. Meeting facts only, never monitoring data. */
@Component({
  selector: 'app-meeting-exception-renderer',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      @if (incidents().length > 0) {
        <div class="rnd__label">Incidents</div>
        @for (incident of incidents(); track incident.id) {
          <div class="rnd__box" data-testid="meeting-incident">
            <div class="rnd__row">
              <span class="rnd__key">{{ incident.title }}</span>
              <span class="rnd__value">{{ incident.start | date: 'MMM d, h:mm a' }}</span>
            </div>
            <div class="rnd__row">
              <span>{{ incident.rule }}</span>
              @if (incident.estimated) {
                <span class="rnd__badge" data-testid="meeting-estimated" title="Detected from the desktop agent, not the meeting report">estimated</span>
              }
            </div>
            @if (incident.presence; as p) {
              <div class="tl__track" aria-label="Time in the meeting">
                <span class="tl__work" data-testid="meeting-presence" [style.left]="p.left + '%'" [style.width]="p.width + '%'"></span>
              </div>
            }
            @if (incident.rsvp.length > 0) {
              <div class="rnd__row" data-testid="meeting-rsvp"><span class="rnd__key">RSVP</span><span class="rnd__value">{{ incident.rsvp.join(', ') }}</span></div>
            }
          </div>
        }
      }
    </div>
  `,
  styleUrl: './renderers.css'
})
export class MeetingExceptionRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);

  protected readonly incidents = computed<MeetingIncidentView[]>(() =>
    (pick<Record<string, unknown>[]>(this.extra(), 'incidents') ?? []).map((row, index) => {
      const facts = pick<Record<string, unknown>>(row, 'facts');
      const start = pick<string>(facts, 'start');
      const end = pick<string>(facts, 'end');
      const joined = pick<string>(facts, 'joinedAt');
      const left = pick<string>(facts, 'leftAt');
      let presence: MeetingIncidentView['presence'] = null;
      if (start && end && joined) {
        const from = new Date(start).getTime();
        const span = Math.max(1, new Date(end).getTime() - from);
        const a = (new Date(joined).getTime() - from) / span * 100;
        const b = ((left ? new Date(left).getTime() : new Date(end).getTime()) - from) / span * 100;
        presence = { left: pct(a), width: pct(Math.max(1, b - a)) };
      }
      return {
        id: String(pick(row, 'id') ?? index),
        rule: String(pick(row, 'rule') ?? pick(row, 'ruleCode') ?? 'Incident'),
        title: String(pick(facts, 'title') ?? 'Meeting'),
        start: pick<string>(row, 'occurrenceStart'),
        estimated: !!pick<boolean>(row, 'estimated'),
        presence,
        rsvp: (pick<Record<string, unknown>[]>(row, 'rsvpHistory') ?? []).map((h) => `${pick(h, 'from') ?? '?'} → ${pick(h, 'to') ?? '?'}`)
      };
    }));
}
