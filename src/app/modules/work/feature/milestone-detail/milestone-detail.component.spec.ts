import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneDetailComponent } from './milestone-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';

describe('MilestoneDetailComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailComponent>;
  let storeStub: any;

  beforeEach(async () => {
    storeStub = {
      selectedSubtree: () => null,
      subtreeLoading: () => false,
      subtreeError: () => null,
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      clearSelectedSubtree: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [MilestoneDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: (key: string) => (key === 'projectId' ? 'p1' : key === 'objectiveId' ? 'o1' : null) }) }
        },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MilestoneDetailComponent);
  });

  it('loads the subtree for the routed objectiveId', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('shows the loading state', () => {
    storeStub.subtreeLoading = () => true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state with retry wired to reload the subtree', async () => {
    storeStub.subtreeError = () => 'Failed to load milestone.';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load milestone.');
    fixture.componentInstance.retry();
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('renders the tree when a subtree is loaded', async () => {
    storeStub.selectedSubtree = () => ({
      id: 'o1', title: 'Design Phase', startDate: '2026-01-01', endDate: '2026-03-01',
      progress: 0, allocatedHours: 20, completedHours: 5, isActive: true, children: []
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Design Phase');
  });

  it('clears the selected subtree on destroy', () => {
    fixture.detectChanges();
    fixture.destroy();
    expect(storeStub.clearSelectedSubtree).toHaveBeenCalled();
  });
});
