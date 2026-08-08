import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private projectId = '';

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    this.store.loadMyMilestones(this.projectId);
  }

  onMilestoneClicked(milestone: Milestone): void {
    this.store.loadMilestoneSubtree(milestone.objectiveId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
