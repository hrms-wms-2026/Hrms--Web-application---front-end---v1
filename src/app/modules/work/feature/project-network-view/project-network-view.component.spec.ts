import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { ProjectMonitorStore } from '../../state/project-monitor.store';
import { ProjectApiService } from '../../data-access/project-api.service';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';
import { ProjectWorkGraphDto } from '../../models/dto/project-work-graph.dto';
import { ProjectNetworkViewComponent } from './project-network-view.component';

describe('ProjectNetworkViewComponent', () => {
  const stats = { totalTasks: 2, notStarted: 1, inProgress: 1, completed: 0, overdue: 0, allocatedHours: 10, completedHours: 5 };

  const graph: ProjectWorkGraphDto = {
    nodes: [
      { id: 'module:root', kind: 'module', label: 'Portal', projectId: 'p1', objectiveId: 'root', stats },
      { id: 'module:oa', kind: 'module', label: 'Connectivity', projectId: 'p1', objectiveId: 'oa', stats },
      { id: 'task:t1', kind: 'task', label: 'Fix timeout', sublabel: 'ONX-1', status: 'active', projectId: 'p1', objectiveId: 'oa', taskId: 't1' }
    ],
    links: [
      { source: 'module:root', target: 'module:oa', kind: 'contains' },
      { source: 'module:oa', target: 'task:t1', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  const alert = (targetType: MonitorAlertDto['targetType'], targetId: string): MonitorAlertDto => ({
    id: `al-${targetId}`, targetType, targetId, targetTitle: 't', ruleCode: 'r',
    subjectEmployeeId: null, message: 'm', firstDetectedAt: '2026-10-01T00:00:00Z'
  });

  const directory = { get: vi.fn(() => undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined), seed: vi.fn() };

  function setup(alerts: MonitorAlertDto[] = [], api?: Partial<ProjectApiService>) {
    const apiStub = { getWorkGraph: vi.fn().mockReturnValue(of(graph)), ...api };
    const monitor = { alerts: () => alerts };
    TestBed.configureTestingModule({
      imports: [ProjectNetworkViewComponent],
      providers: [
        { provide: ProjectApiService, useValue: apiStub },
        { provide: ProjectMonitorStore, useValue: monitor },
        { provide: EmployeeDirectoryStore, useValue: directory }
      ]
    });
    const fixture = TestBed.createComponent(ProjectNetworkViewComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('rootObjectiveId', 'root');
    fixture.detectChanges();
    return { fixture, apiStub, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
  }

  it('loads the graph for the project and renders the explorer rooted on rootObjectiveId', () => {
    const { el, apiStub } = setup();

    expect(apiStub.getWorkGraph).toHaveBeenCalledWith('p1');
    expect(el.querySelector('app-work-network-explorer')).not.toBeNull();
    expect(el.querySelector('[data-node-id="module:root"]')).not.toBeNull();
  });

  it('passes the ids of modules that have alerts as alertNodeIds', () => {
    const { cmp } = setup([alert('module', 'oa')]);

    expect([...cmp.alertNodeIds()]).toEqual(['module:oa']);
  });

  it('rolls a task-targeted alert up to its module', () => {
    const { cmp } = setup([alert('task', 't1')]);

    expect([...cmp.alertNodeIds()]).toEqual(['module:oa']);
  });

  it('drops an alert whose target is not in the graph', () => {
    const { cmp } = setup([alert('module', 'gone'), alert('sprint', 's1'), alert('task', 'nope')]);

    expect([...cmp.alertNodeIds()]).toEqual([]);
  });

  it('shows the loader while the request is in flight and an error state on failure', () => {
    const { el } = setup([], { getWorkGraph: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) } as never);

    expect(el.querySelector('app-error-state')).not.toBeNull();
    expect(el.querySelector('app-work-network-explorer')).toBeNull();
  });
});
