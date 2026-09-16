import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectListStore } from '../../state/project-list.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
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
    BreadcrumbHeaderComponent, RouterOutlet, NgTemplateOutlet
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css']
})
export class ProjectDetailComponent {
  readonly store = inject(ProjectDetailStore);
  protected readonly toolbarStore = inject(WorkPageToolbarStore);
  protected readonly projectListStore = inject(ProjectListStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  protected readonly projectSwitcherItems = computed(() =>
    this.projectListStore.projects().map((p) => ({ id: p.id, label: p.name }))
  );

  activeMilestoneId = signal<string | null>(null);
  isProjectSettings = signal(false);

  // Board/Backlog/Settings are project-level routes with no milestoneId of their own, but the
  // sub-menu bar (and its Tree/Approvals/Calendar links, which are still
  // milestone-scoped) must stay visible on every tab - falls back to the first module so those
  // links have somewhere valid to point when the user isn't currently inside a specific module.
  subMenuMilestoneId = computed(() => this.activeMilestoneId() ?? this.store.milestones()[0]?.objectiveId ?? '');
  subMenuMilestoneTitle = computed(() => {
    const id = this.subMenuMilestoneId();
    return this.store.milestones().find((m) => m.objectiveId === id)?.title ?? '';
  });
  subMenuIsOwner = computed(() => {
    const id = this.subMenuMilestoneId();
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

    // Reactive to the :id param itself (not just a one-time read) - switching projects via the
    // breadcrumb switcher navigates to a sibling route matching the same path shape
    // (/work/:id/board), which Angular's router reuses the existing component instance for
    // rather than re-instantiating it, so ngOnInit alone would never see the new id.
    this.route.paramMap
      .pipe(
        map((paramMap) => paramMap.get('id') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((id) => {
        this.projectId = id;
        void this.loadProject(id);
      });

    void this.projectListStore.loadProjects();
  }

  private syncChildRouteState(): void {
    const child = this.route.snapshot.firstChild;
    this.isProjectSettings.set(child?.routeConfig?.path === 'settings');
    this.activeMilestoneId.set(child?.paramMap.get('milestoneId') ?? null);
  }

  private async loadProject(id: string): Promise<void> {
    if (!id) return;
    this.store.loadProject(id);
    await this.store.loadMyMilestones(id);

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

  protected switchProject(id: string): void {
    // Board is the one landing tab every project-level route can reach directly regardless of
    // which milestone-scoped tab (Tree/Approvals) the user was on, since milestone ids don't
    // carry over between projects.
    this.router.navigate(['/work', id, 'board']);
  }
}
