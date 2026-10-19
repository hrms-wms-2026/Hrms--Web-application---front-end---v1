import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { ProjectListItemDto } from '../../../work/models/dto/project.dto';

/** `/work/projects/mine` has no status filter, so one page this size is fetched and filtered here -
 * the count stops at this many projects. */
const PROJECT_PAGE_SIZE = 100;
const PREVIEW_COUNT = 4;
/** Tile colours for projects without their own colour, by list position. */
const FALLBACK_COLORS: readonly string[] = ['#6366f1', '#22c55e', '#8b5cf6', '#f97316', '#0ea5e9'];

/** Small card: how many of my projects are still running, with the first few and how far along
 * they are. Progress is completed / allocated hours - the project list carries no task counts. */
@Component({
  selector: 'app-active-projects-card',
  standalone: true,
  imports: [RouterLink],
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
  private readonly projects = signal<ProjectListItemDto[]>([]);

  protected readonly active = computed(() => this.projects().filter((p) => p.isActive && !p.isAchieved));
  protected readonly preview = computed(() => this.active().slice(0, PREVIEW_COUNT));
  protected readonly moreCount = computed(() => Math.max(0, this.active().length - PREVIEW_COUNT));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .listMine(1, PROJECT_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.projects.set(page.items);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        }
      });
  }

  protected initial(project: ProjectListItemDto): string {
    return (project.name.trim()[0] ?? '?').toUpperCase();
  }

  protected color(project: ProjectListItemDto, index: number): string {
    return project.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  }

  protected hoursLabel(project: ProjectListItemDto): string {
    const hours = (value: number): string => `${Math.round((Number.isFinite(value) ? value : 0) * 10) / 10}h`;
    return `${hours(project.completedHours)} / ${hours(project.allocatedHours)}`;
  }

  protected progress(project: ProjectListItemDto): number {
    if (!(project.allocatedHours > 0) || !Number.isFinite(project.completedHours)) return 0;
    return Math.min(100, Math.round((project.completedHours / project.allocatedHours) * 100));
  }
}
