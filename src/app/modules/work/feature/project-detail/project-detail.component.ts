import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { MilestoneSubMenuComponent } from '../../ui/milestone-sub-menu/milestone-sub-menu.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Milestone, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneCardComponent, MilestoneSettingsModalComponent, MilestoneSubMenuComponent, CardComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, RouterOutlet
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  activeMilestoneId = signal<string | null>(null);
  activeMilestoneTitle = computed(() => {
    const id = this.activeMilestoneId();
    return this.store.milestones().find((m) => m.objectiveId === id)?.title ?? '';
  });
  activeMilestoneIsOwner = computed(() => {
    const id = this.activeMilestoneId();
    if (!id) return false;
    return this.store.milestones().find((m) => m.objectiveId === id)?.isOwner ?? false;
  });

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  private targetMilestone = signal<Milestone | null>(null);

  constructor() {
    this.activeMilestoneId.set(this.route.snapshot.firstChild?.paramMap.get('milestoneId') ?? null);
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.activeMilestoneId.set(this.route.snapshot.firstChild?.paramMap.get('milestoneId') ?? null);
      });
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

  onMilestoneSelected(milestone: Milestone): void {
    this.router.navigate(['milestones', milestone.objectiveId, 'tree'], { relativeTo: this.route });
  }

  onMilestoneSettingsRequested(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.milestoneSettingsOpen.set(true);
    this.loadFullMilestoneDetail(milestone.objectiveId);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestone()?.objectiveId === id) {
      this.milestoneSettingsInitialValue.set(detail);
    }
  }

  async onMilestoneSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.milestoneSettingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(milestone.objectiveId);
      if (!unachieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(milestone.objectiveId, event.fields);
    if (!editResult.success) {
      this.milestoneSettingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(milestone.objectiveId);
      if (!achieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    this.milestoneSettingsSubmitting.set(false);
    this.milestoneSettingsOpen.set(false);
    await this.store.loadMyMilestones(this.projectId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
