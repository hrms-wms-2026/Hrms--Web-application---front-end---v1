import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeComponent } from '../../ui/milestone-tree/milestone-tree.component';
import { MilestoneDetailPanelComponent } from '../../ui/milestone-detail-panel/milestone-detail-panel.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { TabsComponent, TabItem } from '../../../../shared/ui/tabs/tabs.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneTreeComponent, MilestoneDetailPanelComponent, MilestoneSettingsModalComponent, TabsComponent, CardComponent,
    LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private projectId = '';

  readonly tabs: TabItem[] = [
    { id: 'tree', label: 'Tree' },
    { id: 'list', label: 'List', disabled: true },
    { id: 'board', label: 'Board', disabled: true }
  ];
  activeTabId = signal('tree');

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  private targetMilestoneId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.clearSelectedSubtree();
    this.store.loadProject(this.projectId);
    await this.store.loadMyMilestones(this.projectId);
    const milestones = this.store.milestones();
    if (milestones.length > 0) {
      this.onTreeNodeSelected(milestones[0].objectiveId);
    }
  }

  onTreeNodeSelected(id: string): void {
    this.store.loadMilestoneSubtree(id);
  }

  onMilestoneSettingsRequested(): void {
    const id = this.store.selectedMilestoneDetail()?.id;
    if (!id) return;
    this.targetMilestoneId.set(id);
    this.milestoneSettingsOpen.set(true);
    this.loadFullMilestoneDetail(id);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestoneId() === id) {
      this.milestoneSettingsInitialValue.set(detail);
    }
  }

  async onMilestoneSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const id = this.targetMilestoneId();
    if (!id) return;
    this.milestoneSettingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(id);
      if (!unachieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(id, event.fields);
    if (!editResult.success) {
      this.milestoneSettingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(id);
      if (!achieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    this.milestoneSettingsSubmitting.set(false);
    this.milestoneSettingsOpen.set(false);
    await this.store.loadMilestoneSubtree(id);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }

  retrySubtree(): void {
    const id = this.store.selectedMilestoneDetail()?.id;
    if (id) this.store.loadMilestoneSubtree(id);
  }
}
