import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneFormModalComponent } from '../../ui/milestone-form-modal/milestone-form-modal.component';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
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
    MilestoneCardComponent, MilestoneFormModalComponent, MilestoneTreeNodeComponent, ConfirmModalComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  milestoneFormOpen = signal(false);
  milestoneFormInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneFormSubmitting = signal(false);
  achieveConfirmOpen = signal(false);
  achieveConfirmSubmitting = signal(false);
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

  onMilestoneEditRequested(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.milestoneFormOpen.set(true);
    this.loadFullMilestoneDetail(milestone.objectiveId);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestone()?.objectiveId === id) {
      this.milestoneFormInitialValue.set(detail);
    }
  }

  async onMilestoneEditSubmit(payload: EditObjectiveRequestDto): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.milestoneFormSubmitting.set(true);
    const result = await this.store.editMilestone(milestone.objectiveId, payload);
    this.milestoneFormSubmitting.set(false);
    if (result.success) {
      this.milestoneFormOpen.set(false);
      await this.store.loadMyMilestones(this.projectId);
    }
  }

  onMilestoneAchieveToggled(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.achieveConfirmOpen.set(true);
  }

  async onMilestoneAchieveConfirmed(): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.achieveConfirmSubmitting.set(true);
    const result = milestone.isAchieved
      ? await this.store.unachieveMilestone(milestone.objectiveId)
      : await this.store.achieveMilestone(milestone.objectiveId);
    this.achieveConfirmSubmitting.set(false);
    if (result.success) {
      this.achieveConfirmOpen.set(false);
      await this.store.loadMyMilestones(this.projectId);
    }
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
