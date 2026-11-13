import { TestBed } from '@angular/core/testing';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';
import { TreeAlertMarkComponent } from './tree-alert-mark.component';

describe('TreeAlertMarkComponent', () => {
  function render(alerts: MonitorAlertDto[]): HTMLElement {
    TestBed.configureTestingModule({ imports: [TreeAlertMarkComponent] });
    const fixture = TestBed.createComponent(TreeAlertMarkComponent);
    fixture.componentRef.setInput('alerts', alerts);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const alert = (message: string): MonitorAlertDto => ({
    id: message, targetType: 'task', targetId: 't1', targetTitle: 'Task', ruleCode: 'task_overdue',
    subjectEmployeeId: null, message, firstDetectedAt: '2026-10-05T09:00:00Z'
  });

  it('renders nothing without alerts', () => {
    expect(render([]).querySelector('[data-testid="tree-row-alert"]')).toBeNull();
  });

  it('shows a red mark whose tooltip lists every problem', () => {
    const mark = render([alert('Past due'), alert('Clocked over estimate')]).querySelector('[data-testid="tree-row-alert"]')!;

    expect(mark.getAttribute('title')).toBe('• Past due\n• Clocked over estimate');
    expect(mark.getAttribute('aria-label')).toBe('2 project alerts');
    expect(mark.classList).not.toContain('tree-alert-mark--muted');
  });

  it('fades the mark when every alert is on an achieved module', () => {
    const mark = render([{ ...alert('Over capacity'), inAchievedModule: true }]).querySelector('[data-testid="tree-row-alert"]')!;

    expect(mark.classList).toContain('tree-alert-mark--muted');
    expect(mark.getAttribute('title')).toBe('Achieved milestone - no action needed\n• Over capacity');
  });
});
