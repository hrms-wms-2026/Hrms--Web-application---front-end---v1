import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { Milestone, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneCardComponent, MilestoneSettingsModalComponent, MilestoneTreeNodeComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  private targetMilestone = signal<Milestone | null>(null);

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    this.store.loadMyMilestones(this.projectId);
  }

  onMilestoneViewed(milestone: Milestone): void {
    this.router.navigate(['/work', this.projectId, 'milestones', milestone.objectiveId]);
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
