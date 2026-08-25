import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { ProjectCalendarComponent } from './project-calendar.component';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { ProjectCalendarItemDto } from '../../models/dto/calendar.dto';

const items: ProjectCalendarItemDto[] = [{
  objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
  startDate: '2026-01-01', endDate: '2026-01-05', isActive: true, isAchieved: false,
  canEdit: true, calendarEventId: null, calendarEventColor: null
}];

describe('ProjectCalendarComponent', () => {
  let fixture: ComponentFixture<ProjectCalendarComponent>;
  const store = {
    items: signal(items), events: signal([]), activeEvents: signal([]), loading: signal(false), saving: signal(false),
    error: signal<string | null>(null), pendingSet: signal(new Set<string>()), approvalMessages: signal<Record<string, string>>({}),
    load: vi.fn().mockResolvedValue(undefined), saveDates: vi.fn().mockResolvedValue({ success: true, applied: true, pendingApproval: false }),
    createEvent: vi.fn().mockResolvedValue(true), updateEvent: vi.fn().mockResolvedValue(true), closeEvent: vi.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectCalendarComponent],
      providers: [
        { provide: ProjectCalendarStore, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot: { parent: { paramMap: { get: () => 'p1' } }, paramMap: { get: () => null } } } }
      ]
    });
    fixture = TestBed.createComponent(ProjectCalendarComponent);
    fixture.detectChanges();
  });

  it('loads the routed project and renders every objective bar', () => {
    expect(store.load).toHaveBeenCalledWith('p1');
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o1"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Design');
  });

  it('renders child objectives indented under their parent, all rows visible', () => {
    const treeItems: ProjectCalendarItemDto[] = [
      { ...items[0] },
      { objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Sub design',
        startDate: '2026-01-02', endDate: '2026-01-04', isActive: true, isAchieved: false,
        canEdit: true, calendarEventId: null, calendarEventColor: null }
    ];
    store.items.set(treeItems);
    fixture.detectChanges();

    const rootCell = fixture.nativeElement.querySelector('[data-testid="calendar-row-o1"] .min-w-0') as HTMLElement;
    const childCell = fixture.nativeElement.querySelector('[data-testid="calendar-row-o2"] .min-w-0') as HTMLElement;
    expect(childCell.style.paddingLeft).not.toBe(rootCell.style.paddingLeft);
    // No collapse/expand - both bars stay on screen at once.
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o1"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o2"]')).toBeTruthy();
  });
});
