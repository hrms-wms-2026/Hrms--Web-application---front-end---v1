import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { MilestoneDetailPanelComponent } from '../../ui/milestone-detail-panel/milestone-detail-panel.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-tab',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, MilestoneDetailPanelComponent, LoaderComponent, ErrorStateComponent],
  templateUrl: './milestone-tree-tab.component.html'
})
export class MilestoneTreeTabComponent {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);

  selectedNodeId = signal<string | null>(null);
  private currentMilestoneId = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      const milestoneId = paramMap.get('milestoneId');
      if (!milestoneId) return;
      this.currentMilestoneId = milestoneId;
      this.selectedNodeId.set(null);
      this.store.clearNodeDetail();
      this.store.loadMilestoneSubtree(milestoneId);
    });
  }

  onNodeSelected(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
    this.store.loadNodeDetail(node.id);
  }

  retryTree(): void {
    if (this.currentMilestoneId) this.store.loadMilestoneSubtree(this.currentMilestoneId);
  }

  retryDetail(): void {
    const id = this.selectedNodeId();
    if (id) this.store.loadNodeDetail(id);
  }
}
