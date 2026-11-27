import { Component, computed, inject, input, output, signal } from '@angular/core';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { Project } from '../../models/project.model';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';
import { getDeadlineStatus } from '../../utils/deadline.util';
import { projectHoursProgress } from '../../utils/project-status.util';

const MENU_ICONS = {
  open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  settings: 'M4 6h16M4 12h16M4 18h16',
  archive: 'M4 5h16v4H4zM5 9v10h14V9M10 13h4',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'
};

/**
 * One project in the Projects list view (2026-11-27 design): logo tile, name with key and category, owner,
 * progress, target date (or how overdue it is) and a "..." menu. The selected row is tinted and its tile turns
 * solid accent.
 */
@Component({
  selector: 'app-project-list-row',
  standalone: true,
  imports: [KeyboardClickDirective, EmployeeAvatarComponent, ProgressBarComponent, EntityIconComponent, DropdownMenuComponent],
  template: `
    <div role="button" tabindex="0" appKeyboardClick
      data-testid="project-list-row"
      class="plr group grid w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all duration-150 cursor-pointer"
      [class]="selected()
        ? 'border-[var(--color-accent)]/25 bg-[color-mix(in_srgb,var(--color-accent)_3.5%,var(--color-surface))]'
        : 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs hover:border-[var(--color-accent)]/40'"
      (click)="selectedChange.emit()"
    >
      <!-- Logo tile -->
      @if (logoUrl(); as url) {
        <img
          data-testid="project-row-logo"
          class="h-12 w-12 shrink-0 rounded-xl object-cover border border-[var(--color-border)]"
          [src]="url"
          alt=""
          (error)="logoBroken.set(true)"
        />
      } @else if (project().icon; as projectIcon) {
        <app-entity-icon data-testid="project-row-icon" class="[--entity-icon-size:3rem]" [icon]="projectIcon" [color]="project().color" [name]="project().name" />
      } @else {
        <div
          data-testid="project-row-placeholder"
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold transition-colors"
          [class]="selected()
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm'
            : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'"
        >
          {{ projectLogoInitial() }}
        </div>
      }

      <!-- Name, key and category -->
      <div class="min-w-0">
        <h3 data-testid="project-row-name" class="truncate text-base font-bold leading-snug text-[var(--color-text-primary)]">
          {{ project().name }}
        </h3>
        <p class="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
          <span class="truncate font-medium uppercase tracking-wide">{{ project().identifier }}</span>
          @if (categoryName()) {
            <span class="h-1 w-1 shrink-0 rounded-full bg-[var(--color-text-secondary)]" aria-hidden="true"></span>
            <span class="truncate" data-testid="project-row-category">{{ categoryName() }}</span>
          }
        </p>
      </div>

      <!-- Owner -->
      <div data-testid="project-row-owner" class="plr__owner min-w-0">
        <app-employee-avatar [employeeId]="project().leadId" [showName]="true" />
      </div>

      <!-- Progress -->
      <div class="plr__progress flex items-center gap-3">
        <div class="flex-1">
          <app-progress-bar [progress]="hoursProgress()" />
        </div>
        <span class="w-9 text-right text-sm font-bold text-[var(--color-text-primary)]">{{ hoursProgress() }}%</span>
      </div>

      <!-- Target date, or how far past it the project is -->
      <div class="plr__date flex items-center gap-2 text-sm text-[var(--color-text-primary)]" data-testid="project-row-date">
        <svg class="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
        @if (overdueLabel(); as label) {
          <span class="whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--color-danger)_15%,var(--color-surface))] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-danger)]" data-testid="project-row-overdue">{{ label }}</span>
        } @else {
          <span class="tabular-nums">{{ project().targetDate }}</span>
        }
      </div>

      <!-- Row actions -->
      <app-dropdown-menu class="plr__menu" [items]="menuItems()" ariaLabel="Project actions" (selected)="onMenu($event)">
        <span menu-trigger class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]" data-testid="project-row-menu" aria-label="Project actions">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </span>
      </app-dropdown-menu>
    </div>
  `,
  styles: `
    /* Logo | name | owner | progress | date | menu. Every column but the name has a fixed width, so the columns
       line up from row to row whatever each row holds (a date or a wider "N days overdue" badge). The owner and
       date columns drop out as the row narrows. */
    :host { display: block; container-type: inline-size; }
    .plr { grid-template-columns: 3rem minmax(0, 1fr) 10.5rem 9.5rem 10.5rem 2rem; min-height: 4.5rem; }
    .plr__owner { overflow: hidden; }
    @container (max-width: 760px) {
      .plr { grid-template-columns: 3rem minmax(0, 1fr) 9.5rem 10.5rem 2rem; }
      .plr__owner { display: none; }
    }
    @container (max-width: 560px) {
      .plr { grid-template-columns: 3rem minmax(0, 1fr) 8rem 2rem; }
      .plr__date { display: none; }
    }
  `
})
export class ProjectListRowComponent {
  private readonly projectApi = inject(ProjectApiService);

  project = input.required<Project>();
  /** The project's category, shown after its key; the list resolves it once for every row. */
  categoryName = input('');
  selected = input(false);
  selectedChange = output<void>();
  viewed = output<void>();
  settingsRequested = output<void>();
  achieveRequested = output<void>();
  deleteRequested = output<void>();

  /** Set when the image fails to load (no access, file gone): the initial shows instead. */
  readonly logoBroken = signal(false);

  /** Same URL as the project grid card, so a logo loaded there comes from the browser cache. */
  readonly logoUrl = computed(() => {
    const { id, logoFileId } = this.project();
    return logoFileId && !this.logoBroken() ? this.projectApi.getLogoUrl(id, logoFileId) : null;
  });

  readonly projectLogoInitial = computed(() => {
    const name = this.project().name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'P';
  });

  readonly hoursProgress = computed(() => projectHoursProgress(this.project()));

  /** "N days overdue" once the target date has passed on a project not yet achieved. */
  readonly overdueLabel = computed(() => {
    if (this.project().isAchieved) return null;
    const status = getDeadlineStatus(this.project().targetDate);
    return status?.overdue ? status.label : null;
  });

  /** Everyone can open the project; only its lead can change, archive or delete it. */
  readonly menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [{ id: 'open', label: 'Open project', iconPath: MENU_ICONS.open }];
    if (this.project().isLead) {
      items.push({ id: 'settings', label: 'Settings', iconPath: MENU_ICONS.settings });
      if (!this.project().isAchieved) items.push({ id: 'archive', label: 'Archive', iconPath: MENU_ICONS.archive });
      items.push({ id: 'delete', label: 'Delete', iconPath: MENU_ICONS.delete, danger: true, dividerBefore: true });
    }
    return items;
  });

  protected onMenu(id: string): void {
    if (id === 'open') this.viewed.emit();
    else if (id === 'settings') this.settingsRequested.emit();
    else if (id === 'archive') this.achieveRequested.emit();
    else if (id === 'delete') this.deleteRequested.emit();
  }
}
