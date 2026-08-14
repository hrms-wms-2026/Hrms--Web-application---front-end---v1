import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { MilestoneSubMenuComponent } from '../../ui/milestone-sub-menu/milestone-sub-menu.component';
import { ObjectiveMembersPopupComponent } from '../../ui/objective-members-popup/objective-members-popup.component';
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
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, RouterOutlet,
    ObjectiveMembersPopupComponent
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

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  targetMilestone = signal<Milestone | null>(null);

  membersPopupOpen = signal(false);

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

  onMembersRequested(): void {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.membersPopupOpen.set(true);
    this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  onMembersPopupClosed(): void {
    this.membersPopupOpen.set(false);
  }

  // Task 7 (people-picker) wires a real employeeId selection into ObjectiveMembersPopupComponent's
  // addRequested output; the signature here already accepts the eventual real payload.
  async onAddMemberRequested(employeeId: string): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    await this.store.addObjectiveMember(milestone.objectiveId, employeeId);
    await this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  async onRemoveMemberRequested(employeeId: string): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    await this.store.removeObjectiveMember(milestone.objectiveId, employeeId);
    await this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  async onTransferRequested(employeeId: string): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    await this.store.transferObjectiveHead(milestone.objectiveId, employeeId);
    await this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
