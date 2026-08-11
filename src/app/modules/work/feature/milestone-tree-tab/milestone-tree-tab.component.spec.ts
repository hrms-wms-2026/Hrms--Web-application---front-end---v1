import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneTreeTabComponent } from './milestone-tree-tab.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeTabComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeTabComponent>;
  let storeStub: any;

  const treeNode: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-01', endDate: '2026-03-01', progress: 0,
    allocatedHours: 20, completedHours: 0, isActive: true, children: []
  };

  function setup(milestoneId: string): void {
    storeStub = {
      selectedSubtree: () => null,
      subtreeLoading: () => false,
      subtreeError: () => null,
      nodeDetail: () => null,
      nodeDetailLoading: () => false,
      nodeDetailError: () => null,
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      loadNodeDetail: vi.fn().mockResolvedValue(undefined),
      clearNodeDetail: vi.fn()
    };
    const paramMap$ = of({ get: (key: string) => (key === 'milestoneId' ? milestoneId : null) });

    TestBed.configureTestingModule({
      imports: [MilestoneTreeTabComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } }
      ]
    });
    fixture = TestBed.createComponent(MilestoneTreeTabComponent);
  }

  it('loads the subtree for the routed milestoneId and clears stale node detail', () => {
    setup('o1');
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
    expect(storeStub.clearNodeDetail).toHaveBeenCalled();
  });

  it('renders the tree once selectedSubtree resolves', async () => {
    setup('o1');
    storeStub.selectedSubtree = () => treeNode;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
  });

  it('renders the detail panel showing the select-a-milestone prompt before any node is clicked', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-detail-panel')).not.toBeNull();
  });

  it('loads node detail and tracks selection when a tree node is selected', () => {
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.onNodeSelected(treeNode);

    expect(storeStub.loadNodeDetail).toHaveBeenCalledWith('o1');
    expect(fixture.componentInstance.selectedNodeId()).toBe('o1');
  });

  it('retryTree re-loads the subtree for the current milestone', () => {
    setup('o1');
    storeStub.loadMilestoneSubtree.mockClear();

    fixture.componentInstance.retryTree();

    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('retryDetail re-loads the detail for the currently selected node', () => {
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onNodeSelected(treeNode);
    storeStub.loadNodeDetail.mockClear();

    fixture.componentInstance.retryDetail();

    expect(storeStub.loadNodeDetail).toHaveBeenCalledWith('o1');
  });

  it('does nothing when retryDetail is called before any node is selected', () => {
    setup('o1');

    fixture.componentInstance.retryDetail();

    expect(storeStub.loadNodeDetail).not.toHaveBeenCalled();
  });
});
