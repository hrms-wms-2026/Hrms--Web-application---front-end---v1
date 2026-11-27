import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Project } from '../../models/project.model';
import { ProjectStatus, projectStatus } from '../../utils/project-status.util';

/** The strip's filter: every project, or one status. */
export type ProjectKpiFilter = 'all' | ProjectStatus;

interface KpiTileView {
  key: ProjectKpiFilter;
  label: string;
  count: number;
}

/** SVG path data on 24x24 stroked icons. */
const ICONS: Record<ProjectKpiFilter, string> = {
  all: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 10h18',
  in_progress: 'M8 5.5v13l10-6.5-10-6.5z',
  completed: 'M5 12.5l4.5 4.5L19 7.5',
  overdue: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 3v5M16 3v5M4 11h16'
};

/**
 * Projects KPI strip: Total, In progress, Completed and Overdue counts. Each tile is also a filter toggle -
 * pick one to show only those projects, pick it again (or Total) to show all.
 */
@Component({
  selector: 'app-project-kpi-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="pks" role="group" aria-label="Project status">
      @for (tile of tiles(); track tile.key) {
        <button
          type="button"
          [class]="'pks__tile pks__tile--' + tile.key"
          [class.pks__tile--active]="filter() === tile.key"
          [attr.aria-pressed]="filter() === tile.key"
          [attr.data-testid]="'project-kpi-' + tile.key"
          (click)="toggle(tile.key)"
        >
          <span class="pks__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path [attr.d]="iconFor(tile.key)" />
            </svg>
          </span>
          <span class="pks__text">
            <span class="pks__count" [attr.data-testid]="'project-kpi-' + tile.key + '-count'">{{ tile.count }}</span>
            <span class="pks__label">{{ tile.label }}</span>
          </span>
        </button>
      }
    </div>
  `,
  styles: `
    /* 2026-11-27 mockup: soft light tiles with no outline, a round tinted icon, a large count and its label;
       the active tile is outlined and tinted in the theme colour. Two columns once the strip gets narrow. */
    :host { container-type: inline-size; }
    .pks {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.875rem;
    }
    @container (max-width: 640px) {
      .pks { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .pks__tile {
      --tone: var(--color-accent);
      display: flex;
      align-items: center;
      gap: 0.875rem;
      min-width: 0;
      padding: 0.875rem 1rem;
      border: 1.5px solid transparent;
      border-radius: 1rem;
      background: color-mix(in srgb, var(--color-text-primary) 3%, var(--color-surface));
      box-shadow: 0 1px 2px rgb(16 24 40 / 0.03);
      text-align: left;
      cursor: pointer;
      transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
    }
    .pks__tile:hover { border-color: color-mix(in srgb, var(--tone) 30%, transparent); }
    .pks__tile:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .pks__tile--active {
      border-color: color-mix(in srgb, var(--color-accent) 28%, transparent);
      background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface));
    }
    .pks__tile--completed { --tone: var(--color-success); }
    .pks__tile--overdue { --tone: var(--color-danger); }
    .pks__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--tone) 15%, var(--color-surface));
      color: var(--tone);
    }
    .pks__icon svg { width: 1.375rem; height: 1.375rem; }
    .pks__text { display: flex; min-width: 0; flex-direction: column; }
    .pks__count { font-size: 1.625rem; font-weight: 700; line-height: 1.1; color: var(--color-text-primary); }
    .pks__label {
      overflow: hidden;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `
})
export class ProjectKpiStripComponent {
  readonly projects = input.required<readonly Project[]>();
  readonly filter = input<ProjectKpiFilter>('all');
  readonly filterChange = output<ProjectKpiFilter>();

  protected readonly tiles = computed<KpiTileView[]>(() => {
    const counts: Record<ProjectStatus, number> = { in_progress: 0, completed: 0, overdue: 0 };
    const today = new Date();
    for (const project of this.projects()) counts[projectStatus(project, today)]++;
    return [
      { key: 'all', label: 'Total Projects', count: this.projects().length },
      { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
      { key: 'completed', label: 'Completed', count: counts.completed },
      { key: 'overdue', label: 'Overdue', count: counts.overdue }
    ];
  });

  protected iconFor(key: ProjectKpiFilter): string {
    return ICONS[key];
  }

  protected toggle(key: ProjectKpiFilter): void {
    this.filterChange.emit(this.filter() === key ? 'all' : key);
  }
}
