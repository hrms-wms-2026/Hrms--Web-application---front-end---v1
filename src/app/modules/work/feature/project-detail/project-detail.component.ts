import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneSubMenuComponent } from '../../ui/milestone-sub-menu/milestone-sub-menu.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneSubMenuComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent,
    BreadcrumbHeaderComponent, RouterLink, RouterOutlet
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  private static readonly PROJECT_LEVEL_PATHS = new Set(['settings', 'board', 'backlog']);

  activeMilestoneId = signal<string | null>(null);
  isProjectSettings = signal(false);
  isProjectLevelRoute = signal(false);
  activeMilestoneTitle = computed(() => {
    const id = this.activeMilestoneId();
    return this.store.milestones().find((m) => m.objectiveId === id)?.title ?? '';
  });
  activeMilestoneIsOwner = computed(() => {
    const id = this.activeMilestoneId();
    if (!id) return false;
    return this.store.milestones().find((m) => m.objectiveId === id)?.isOwner ?? false;
  });

  constructor() {
    this.syncChildRouteState();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.syncChildRouteState();
      });
  }

  private syncChildRouteState(): void {
    const child = this.route.snapshot.firstChild;
    const path = child?.routeConfig?.path ?? '';
    this.isProjectSettings.set(path === 'settings');
    this.isProjectLevelRoute.set(ProjectDetailComponent.PROJECT_LEVEL_PATHS.has(path));
    this.activeMilestoneId.set(child?.paramMap.get('milestoneId') ?? null);
  }

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    await this.store.loadMyMilestones(this.projectId);

    if (!this.route.snapshot.firstChild) {
      const milestones = this.store.milestones();
      if (milestones.length > 0) {
        this.router.navigate(['milestones', milestones[0].objectiveId, 'tree'], { relativeTo: this.route, replaceUrl: true });
      }
    }
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
