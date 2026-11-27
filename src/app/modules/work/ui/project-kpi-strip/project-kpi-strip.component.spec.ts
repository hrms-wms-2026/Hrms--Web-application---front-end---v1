import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Project } from '../../models/project.model';
import { ProjectKpiFilter, ProjectKpiStripComponent } from './project-kpi-strip.component';

/** Fixed far-past / far-future dates, so the counts never depend on today. */
function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id, name: id, identifier: id.toUpperCase(), categoryId: 'c1', description: null, leadId: 'l1',
    startDate: '2020-01-01', targetDate: '2099-12-31', color: null, isActive: true,
    allocatedHours: 0, completedHours: 0, isLead: false, isAchieved: false, achievedAt: null, updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0, ...overrides
  };
}

describe('ProjectKpiStripComponent', () => {
  let fixture: ComponentFixture<ProjectKpiStripComponent>;
  const count = (key: string) =>
    (fixture.nativeElement.querySelector(`[data-testid="project-kpi-${key}-count"]`) as HTMLElement).textContent?.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProjectKpiStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProjectKpiStripComponent);
    fixture.componentRef.setInput('projects', [
      project('a'),
      project('b', { targetDate: '2020-06-01' }),
      project('c', { targetDate: '2020-06-01' }),
      project('d', { isAchieved: true, targetDate: '2020-06-01' })
    ]);
    fixture.detectChanges();
  });

  it('counts every project and each status', () => {
    expect(count('all')).toBe('4');
    expect(count('in_progress')).toBe('1');
    expect(count('completed')).toBe('1');
    expect(count('overdue')).toBe('2');
  });

  it('marks the active tile and toggles a status back to all', () => {
    const emitted: ProjectKpiFilter[] = [];
    fixture.componentInstance.filterChange.subscribe((f) => emitted.push(f));
    const tile = (key: string) => fixture.nativeElement.querySelector(`[data-testid="project-kpi-${key}"]`) as HTMLButtonElement;

    expect(tile('all').getAttribute('aria-pressed')).toBe('true');
    tile('overdue').click();
    fixture.componentRef.setInput('filter', 'overdue');
    fixture.detectChanges();
    expect(tile('overdue').getAttribute('aria-pressed')).toBe('true');
    tile('overdue').click();
    expect(emitted).toEqual(['overdue', 'all']);
  });
});
