import { Component, input, output } from '@angular/core';
import { ProjectCalendarEventBandDto } from '../../models/dto/calendar.dto';

@Component({
  selector: 'app-calendar-event-legend',
  standalone: true,
  template: `
    <aside class="calendar-events" aria-label="Calendar milestones">
      <div class="calendar-events__header">
        <div class="calendar-events__title-wrap">
          <span class="calendar-events__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg></span>
          <div>
            <h2 class="calendar-events__title">Milestones</h2>
            <p class="calendar-events__subtitle">Project highlights</p>
          </div>
        </div>
        <span class="calendar-events__count">{{ events().length }}</span>
      </div>

      <div class="calendar-events__list">
        @for (event of events(); track event.eventId) {
          <article class="calendar-event" (click)="select.emit(event.eventId)">
            <div class="calendar-event__accent" [style.backgroundColor]="event.color" aria-hidden="true"></div>
            <div class="calendar-event__body">
              <div class="calendar-event__name" [title]="event.name">{{ event.name }}</div>
              <div class="calendar-event__meta"><span class="calendar-event__dot" [style.backgroundColor]="event.color" aria-hidden="true"></span>{{ event.startDate }} → {{ event.endDate }}</div>
            </div>
            @if (event.canEdit) {
              <div class="calendar-event__actions">
                <button type="button" class="calendar-event__action" [attr.aria-label]="'Edit ' + event.name" title="Edit milestone" (click)="$event.stopPropagation(); edit.emit(event.eventId)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1-1-4Z" /></svg></button>
                <button type="button" class="calendar-event__action calendar-event__action--danger" [attr.aria-label]="'Close ' + event.name" title="Close milestone" (click)="$event.stopPropagation(); close.emit(event.eventId)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
              </div>
            }
          </article>
        } @empty {
          <div class="calendar-events__empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4z" /><path d="M8 3v6M16 3v6M4 11h16" /></svg><span>No active milestones yet.</span></div>
        }
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .calendar-events { border: 1px solid var(--color-border); border-radius: 11px; background: var(--color-surface); padding: 15px; box-shadow: 0 1px 2px rgb(15 23 42 / .03); }
    .calendar-events__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 13px; border-bottom: 1px solid var(--color-border); }
    .calendar-events__title-wrap { display: flex; align-items: center; gap: 9px; min-width: 0; }
    .calendar-events__icon { display: inline-flex; width: 30px; height: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 8px; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); }
    .calendar-events__icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .calendar-events__title { margin: 0; color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .calendar-events__subtitle { margin: 2px 0 0; color: var(--color-text-secondary); font-size: 10px; }
    .calendar-events__count { display: inline-flex; min-width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .calendar-events__list { display: flex; flex-direction: column; gap: 8px; padding-top: 11px; }
    .calendar-event { cursor: pointer; position: relative; display: flex; min-width: 0; align-items: center; gap: 9px; border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent); border-radius: 9px; padding: 9px 8px 9px 12px; background: var(--color-surface); transition: border-color 140ms ease, background-color 140ms ease; }
    .calendar-event:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .calendar-event__accent { position: absolute; top: 9px; bottom: 9px; left: 4px; width: 3px; border-radius: 999px; }
    .calendar-event__body { min-width: 0; flex: 1; }
    .calendar-event__name { overflow: hidden; color: var(--color-text-primary); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .calendar-event__meta { display: flex; align-items: center; gap: 5px; margin-top: 3px; color: var(--color-text-secondary); font-size: 10px; }
    .calendar-event__dot { width: 6px; height: 6px; border-radius: 999px; }
    .calendar-event__actions { display: flex; flex: 0 0 auto; gap: 2px; }
    .calendar-event__action { display: inline-flex; width: 27px; height: 27px; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
    .calendar-event__action:hover { background: var(--color-surface-secondary); color: var(--color-accent); }
    .calendar-event__action--danger:hover { color: var(--color-danger); }
    .calendar-event__action:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .calendar-event__action svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .calendar-events__empty { display: flex; min-height: 90px; flex-direction: column; align-items: center; justify-content: center; gap: 7px; color: var(--color-text-secondary); font-size: 11px; text-align: center; }
    .calendar-events__empty svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  `]
})
export class CalendarEventLegendComponent {
  readonly events = input.required<readonly ProjectCalendarEventBandDto[]>();
  readonly select = output<string>();
  readonly edit = output<string>();
  readonly close = output<string>();
}
