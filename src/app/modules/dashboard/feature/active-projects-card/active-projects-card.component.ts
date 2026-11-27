import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { PagedResultDto, ProjectListItemDto } from '../../../work/models/dto/project.dto';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { widgetInkOn, widgetShadeFor } from '../../../../shared/utils/widget-palette';

/** `/work/projects/mine` has no status filter, so one page this size is fetched and filtered here -
 * the count stops at this many projects. */
const PROJECT_PAGE_SIZE = 100;
const PREVIEW_COUNT = 4;

/** Hours as "12.5h" - one decimal, never NaN. */
function formatHours(value: number | undefined): string {
  const safe = value !== undefined && Number.isFinite(value) ? value : 0;
  return `${Math.round(safe * 10) / 10}h`;
}

/** Where to focus first: the most open task hours assigned to me, then the most allocated to me, then by name.
 * Projects where I have no tasks (e.g. the auto-created Office project) sink to the bottom. */
function byFocus(a: ProjectListItemDto, b: ProjectListItemDto): number {
  return (
    (b.myOpenHours ?? 0) - (a.myOpenHours ?? 0) ||
    (b.myAllocatedHours ?? 0) - (a.myAllocatedHours ?? 0) ||
    a.name.localeCompare(b.name)
  );
}

/** Small card: the projects I'm working on, ordered by how many open task hours I have in each, so the one to
 * focus on is on top. Each row shows my own task hours there and how much of it I've finished. */
@Component({
  selector: 'app-active-projects-card',
  standalone: true,
  imports: [RouterLink, PopoutHeaderActionsComponent],
  // A size container: the progress column widens when the card is Large.
  host: { class: '@container block' },
  templateUrl: './active-projects-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActiveProjectsCardComponent implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  /** A refresh from the header button: the list stays on screen while it reloads. */
  protected readonly refreshing = signal(false);
  private readonly projects = signal<ProjectListItemDto[]>([]);

  protected readonly active = computed(() => this.projects().filter((p) => p.isActive && !p.isAchieved).sort(byFocus));
  /** The top row gets a "Focus" chip, but only when it really has open work for me. */
  protected readonly focusId = computed(() => {
    const top = this.active()[0] as ProjectListItemDto | undefined;
    return top && (top.myOpenHours ?? 0) > 0 ? top.id : null;
  });
  protected readonly preview = computed(() => this.active().slice(0, PREVIEW_COUNT));
  protected readonly moreCount = computed(() => Math.max(0, this.active().length - PREVIEW_COUNT));

  /** Inside a dashboard frame the first page comes from the bootstrap (same `listMine(1, 100)` result);
   * otherwise (or when it isn't available) the card fetches it as before. Retry stays on load(): its
   * error state only appears after the card's own request failed. */
  private readonly feed = injectWidgetDataFeed<PagedResultDto<ProjectListItemDto>>({
    apply: (page) => this.applyPage(page),
    fetch: () => this.load(),
    refreshing: () => this.refreshing.set(true)
  });

  ngOnInit(): void {
    this.feed.start();
  }

  protected refresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.feed.reload();
  }

  private applyPage(page: PagedResultDto<ProjectListItemDto>): void {
    this.projects.set(page.items);
    this.loading.set(false);
    this.refreshing.set(false);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .listMine(1, PROJECT_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.applyPage(page),
        error: () => {
          this.error.set(true);
          this.loading.set(false);
          this.refreshing.set(false);
        }
      });
  }

  protected initial(project: ProjectListItemDto): string {
    return (project.name.trim()[0] ?? '?').toUpperCase();
  }

  /** Monochrome widgets: a theme shade picked from the project id (stable across re-sorts), never the stored colour. */
  protected color(project: ProjectListItemDto): string {
    return widgetShadeFor(project.id);
  }

  protected ink(project: ProjectListItemDto): string {
    return widgetInkOn(this.color(project));
  }

  /** "8h open · 3 tasks", or a plain note when nothing of mine is open here. */
  protected tasksLabel(project: ProjectListItemDto): string {
    const open = project.myOpenTaskCount ?? 0;
    if ((project.myAllocatedHours ?? 0) <= 0 && open === 0) return 'No tasks assigned to you';
    if (open === 0) return 'All your tasks done';
    return `${formatHours(project.myOpenHours)} open · ${open} ${open === 1 ? 'task' : 'tasks'}`;
  }

  /** My allocated task hours in this project - the figure the list is ranked by. */
  protected allocatedLabel(project: ProjectListItemDto): string {
    return formatHours(project.myAllocatedHours);
  }

  /** Share of my allocated task hours already finished (allocated minus open). */
  protected progress(project: ProjectListItemDto): number {
    const allocated = project.myAllocatedHours ?? 0;
    const open = project.myOpenHours ?? 0;
    if (!(allocated > 0) || !Number.isFinite(open)) return 0;
    return Math.max(0, Math.min(100, Math.round(((allocated - open) / allocated) * 100)));
  }
}
