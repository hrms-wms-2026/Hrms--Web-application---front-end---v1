import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneExplanationPanelComponent } from './milestone-explanation-panel.component';
import { CalendarEventDto } from '../../models/dto/calendar.dto';

const baseEvent: CalendarEventDto = {
  id: 'e1', projectId: 'p1', name: 'Release 1', color: '#2563EB', status: 'active',
  startDate: '2000-01-01', endDate: '2999-12-31', description: 'Covers the Q3 release scope.',
  createdByName: 'Priya Shankar', objectiveIds: [], taskIds: []
};

describe('MilestoneExplanationPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneExplanationPanelComponent>;
  let component: MilestoneExplanationPanelComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(MilestoneExplanationPanelComponent);
    component = fixture.componentInstance;
  });

  const clickTab = (tab: string) => {
    fixture.nativeElement.querySelector(`[data-testid="panel-tab-${tab}"]`).click();
    fixture.detectChanges();
  };

  it('shows the Overview tab by default with status pill, description and owner', () => {
    fixture.componentRef.setInput('event', baseEvent);
    fixture.componentRef.setInput('hasOpenAlert', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-status"]').textContent).toContain('On Track');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-description"]').textContent).toContain(baseEvent.description);
    expect(fixture.nativeElement.querySelector('[data-testid="panel-owner"]').textContent).toContain(baseEvent.createdByName);
  });

  it('switching to the Tasks tab emits tabActivated("tasks") exactly once per activation', () => {
    fixture.componentRef.setInput('event', baseEvent);
    fixture.detectChanges();
    const emitted: string[] = [];
    component.tabActivated.subscribe((t: string) => emitted.push(t));
    clickTab('tasks');
    clickTab('overview');
    clickTab('tasks');
    expect(emitted).toEqual(['tasks']);
  });

  it('renders Key Metrics from status category, not just the done flag', () => {
    fixture.componentRef.setInput('event', baseEvent);
    fixture.componentRef.setInput('tasks', [
      { id: 't1', shortId: 'T-1', title: 'A', statusId: 's1', marksTaskComplete: true, statusCategory: 'done', progressPercent: 100, objectiveId: 'o1', objectiveTitle: 'M' },
      { id: 't2', shortId: 'T-2', title: 'B', statusId: 's2', marksTaskComplete: false, statusCategory: 'active', progressPercent: 40, objectiveId: 'o1', objectiveTitle: 'M' },
      { id: 't3', shortId: 'T-3', title: 'C', statusId: 's3', marksTaskComplete: false, statusCategory: 'not_started', progressPercent: 0, objectiveId: 'o1', objectiveTitle: 'M' }
    ]);
    fixture.detectChanges();
    clickTab('tasks');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-metric-total"]').textContent).toContain('3');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-metric-completed"]').textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-metric-in-progress"]').textContent).toContain('1');
  });

  it('resolves Modules tab rows to titles, not raw objective ids', () => {
    fixture.componentRef.setInput('event', { ...baseEvent, objectiveIds: ['o1'] });
    fixture.componentRef.setInput('modules', [{ objectiveId: 'o1', title: 'Employee Management' }]);
    fixture.detectChanges();
    clickTab('modules');
    const row = fixture.nativeElement.querySelector('[data-testid="panel-module-row"]');
    expect(row.textContent).toContain('Employee Management');
    expect(row.textContent).not.toContain('o1');
  });

  it('shows an empty state on the Tasks tab when there are no linked tasks', () => {
    fixture.componentRef.setInput('event', baseEvent);
    fixture.componentRef.setInput('tasks', []);
    fixture.detectChanges();
    clickTab('tasks');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-tasks-empty"]')).toBeTruthy();
  });
});
