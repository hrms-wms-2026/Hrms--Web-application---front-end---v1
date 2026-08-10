import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-milestone-detail',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './milestone-detail.component.html'
})
export class MilestoneDetailComponent implements OnInit, OnDestroy {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';
  private objectiveId = '';

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('projectId')!;
    this.objectiveId = paramMap.get('objectiveId')!;
    this.store.loadMilestoneSubtree(this.objectiveId);
  }

  ngOnDestroy(): void {
    this.store.clearSelectedSubtree();
  }

  retry(): void {
    this.store.loadMilestoneSubtree(this.objectiveId);
  }

  backToProject(): void {
    this.router.navigate(['/work', this.projectId]);
  }
}
