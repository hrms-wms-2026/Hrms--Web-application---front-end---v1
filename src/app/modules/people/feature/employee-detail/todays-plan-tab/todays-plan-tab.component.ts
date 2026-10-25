import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toZonedParts } from '../../../../work/meetings/utils/meeting-time';
import { PlannerApiService } from '../../../../work/planner/data-access/planner-api.service';
import { PlannerDayResponse } from '../../../../work/planner/models/planner.models';

/**
 * An employee's day plan, read-only (day planner, backend docs/api/planner-v1.md): the employee's own or a manager in
 * their reporting line. Anyone else gets 404 (or 503 while the planner is off) and the tab reports itself unavailable.
 * It reloads, and hides until the new answer, whenever the profile switches to another employee.
 */
@Component({
  selector: 'app-todays-plan-tab',
  standalone: true,
  template: `
    @if (day(); as d) {
      <section class="flex flex-col gap-3 text-sm">
        <div class="flex flex-wrap items-center gap-6 rounded-md border p-3">
          <span>{{ d.date }}</span>
          <button type="button" data-testid="plan-previous-day" class="rounded-md border px-2 py-0.5 text-xs" (click)="shiftDay(d.date, -1)">Previous day</button>
          @if (date()) {
            <button type="button" data-testid="plan-today" class="rounded-md border px-2 py-0.5 text-xs" (click)="goToday()">Today</button>
          }
          <span>Planned <strong>{{ duration(d.totals.plannedMinutes) }}</strong></span>
          <span>Actual <strong>{{ duration(d.totals.actualMinutes) }}</strong></span>
        </div>
        @for (row of rows(d); track $index) {
          <div class="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs">
            <span class="w-24 shrink-0 text-[var(--color-text-secondary)]">{{ row.time }}</span>
            <span class="font-medium">{{ row.title }}</span>
            <span>{{ duration(row.planned) }} planned · {{ duration(row.actual) }} actual</span>
          </div>
        } @empty {
          <p class="text-xs text-[var(--color-text-secondary)]">Nothing planned for this day.</p>
        }
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodaysPlanTabComponent {
  private readonly api = inject(PlannerApiService);

  readonly employeeId = input.required<string>();
  /** True once the API answered for this caller, false on 404/503 and while another employee's answer is pending. */
  readonly availability = output<boolean>();

  readonly day = signal<PlannerDayResponse | null>(null);
  /** Null means today; a manager may go back to earlier days (read-only). */
  readonly date = signal<string | null>(null);

  constructor() {
    effect(() => {
      const employeeId = this.employeeId();
      untracked(() => {
        this.date.set(null);
        void this.load(employeeId);
      });
    });
  }

  shiftDay(current: string, days: number): void {
    const next = new Date(`${current}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    this.date.set(next.toISOString().slice(0, 10));
    void this.load(this.employeeId(), false);
  }

  goToday(): void {
    this.date.set(null);
    void this.load(this.employeeId(), false);
  }

  protected rows(d: PlannerDayResponse): { time: string; title: string; planned: number; actual: number; start: number }[] {
    const range = (s: string, e: string) => `${toZonedParts(s, d.timezone).time}–${toZonedParts(e, d.timezone).time}`;
    return [
      ...d.meetings.map((m) => ({ time: range(m.startAt, m.endAt), title: m.title, planned: m.plannedMinutes, actual: m.actualMinutes, start: Date.parse(m.startAt) })),
      ...d.blocks.map((b) => ({ time: range(b.startAt, b.endAt), title: b.taskTitle, planned: b.plannedMinutes, actual: b.actualMinutes, start: Date.parse(b.startAt) })),
    ].sort((a, b) => a.start - b.start);
  }

  protected duration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private async load(employeeId: string, newEmployee = true): Promise<void> {
    const date = this.date();
    if (newEmployee && this.day()) {
      this.day.set(null);
      this.availability.emit(false);
    }
    try {
      const day = await firstValueFrom(this.api.getEmployeeDay(employeeId, date));
      if (employeeId !== this.employeeId() || date !== this.date()) return;   // a newer employee or day is already loading
      this.day.set(day);
      this.availability.emit(true);
    } catch (e) {
      if (employeeId !== this.employeeId()) return;
      if (e instanceof HttpErrorResponse) this.availability.emit(false);
    }
  }
}
