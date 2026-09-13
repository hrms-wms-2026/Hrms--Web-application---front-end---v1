import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { ProjectCalendarComponent } from './project-calendar.component';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { ProjectCalendarModuleDto } from '../../models/dto/calendar.dto';

const items: ProjectCalendarModuleDto[] = [{
  objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
  startDate: '2026-01-01', endDate: '2026-01-05', isActive: true, isAchieved: false,
  canEdit: true, events: []
}];

describe('ProjectCalendarComponent', () => {
  let fixture: ComponentFixture<ProjectCalendarComponent>;
  const store = {
    modules: signal(items), bands: signal([]), events: signal([]), activeEvents: signal([]), loading: signal(false), saving: signal(false),
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
    const treeItems: ProjectCalendarModuleDto[] = [
      { ...items[0] },
      { objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Sub design',
        startDate: '2026-01-02', endDate: '2026-01-04', isActive: true, isAchieved: false,
        canEdit: true, events: [] }
    ];
    store.modules.set(treeItems);
    fixture.detectChanges();

    const rootCell = fixture.nativeElement.querySelector('[data-testid="calendar-row-o1"] .project-calendar__objective') as HTMLElement;
    const childCell = fixture.nativeElement.querySelector('[data-testid="calendar-row-o2"] .project-calendar__objective') as HTMLElement;
    expect(childCell.style.paddingLeft).not.toBe(rootCell.style.paddingLeft);
    // No collapse/expand - both bars stay on screen at once.
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o1"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o2"]')).toBeTruthy();
  });

  describe('zoom - one continuous chart, no view-switching tabs', () => {
    beforeEach(() => {
      store.modules.set(items); // '2026-01-01' -> '2026-01-05', 5 days
      fixture.detectChanges();
    });

    it('always shows the full project range - zoom never hides part of the chart', () => {
      expect(fixture.componentInstance.timelineStart()).toBe('2026-01-01');
      expect(fixture.componentInstance.timelineEnd()).toBe('2026-01-05');

      fixture.componentInstance.zoomIn();
      fixture.componentInstance.zoomIn();
      fixture.detectChanges();
      // Zooming changes dayWidth (and so timelineWidth, scrolled via the container),
      // never the underlying date range itself.
      expect(fixture.componentInstance.timelineStart()).toBe('2026-01-01');
      expect(fixture.componentInstance.timelineEnd()).toBe('2026-01-05');
      expect(fixture.nativeElement.querySelectorAll('[data-testid^="calendar-row-"]').length).toBe(1);
    });

    it('zoom in/out multiply and divide day width, clamped between the fit floor and the max', () => {
      const before = fixture.componentInstance.dayWidth();
      fixture.componentInstance.zoomIn();
      fixture.detectChanges();
      expect(fixture.componentInstance.dayWidth()).toBeGreaterThan(before);

      fixture.componentInstance.zoomOut();
      fixture.componentInstance.zoomOut();
      fixture.detectChanges();
      expect(fixture.componentInstance.dayWidth()).toBeLessThan(before);

      // Zooming out past the fit-to-screen floor clamps there, doesn't go smaller.
      for (let i = 0; i < 20; i++) fixture.componentInstance.zoomOut();
      fixture.detectChanges();
      expect(fixture.componentInstance.dayWidth()).toBeCloseTo(fixture.componentInstance.fitDayWidth(), 5);
      expect(fixture.componentInstance.isAtMinZoom()).toBe(true);

      for (let i = 0; i < 40; i++) fixture.componentInstance.zoomIn();
      fixture.detectChanges();
      expect(fixture.componentInstance.isAtMaxZoom()).toBe(true);
    });

    it('the Fit button jumps straight to the fit-to-screen day width', () => {
      fixture.componentInstance.containerWidth.set(940); // 700px available after the 240px label column
      fixture.detectChanges();
      fixture.nativeElement.querySelector('[data-testid="fit-to-screen"]').click();
      fixture.detectChanges();

      // 5-day project, 700px / 5 = 140px/day
      expect(fixture.componentInstance.dayWidth()).toBe(140);
    });

    it('scales the fit floor down with a sane minimum for a very long project', () => {
      fixture.componentInstance.containerWidth.set(250); // 10px available - below the 3px/day floor's need
      fixture.componentInstance.fitToScreen();
      fixture.detectChanges();
      expect(fixture.componentInstance.dayWidth()).toBe(3);
    });
  });

  describe('ruler tick spacing', () => {
    beforeEach(() => {
      store.modules.set(items); // '2026-01-01' -> '2026-01-05', 5 days
      fixture.detectChanges();
    });

    it('keeps ticks a consistent on-screen gap apart, regardless of zoom', () => {
      // Default zoom (32px/day): 60/32 rounds to a 2-day step.
      expect(fixture.componentInstance.dateMarkers()).toEqual(['2026-01-01', '2026-01-03', '2026-01-05']);

      // Zoomed in enough that 60px covers less than a day - ticks every day.
      fixture.componentInstance.zoomIn();
      fixture.componentInstance.zoomIn();
      fixture.componentInstance.zoomIn();
      fixture.componentInstance.zoomIn();
      fixture.detectChanges();
      expect(fixture.componentInstance.dayWidth()).toBeGreaterThan(60);
      expect(fixture.componentInstance.dateMarkers()).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']);
    });
  });

  describe('today marker', () => {
    afterEach(() => vi.useRealTimers());

    it('shows the line only when today falls within the range, unaffected by zoom', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ProjectCalendarComponent],
        providers: [
          { provide: ProjectCalendarStore, useValue: store },
          { provide: ActivatedRoute, useValue: { snapshot: { parent: { paramMap: { get: () => 'p1' } }, paramMap: { get: () => null } } } }
        ]
      });
      store.modules.set(items); // '2026-01-01' -> '2026-01-05' - today (Jan 3) falls inside
      const todayFixture = TestBed.createComponent(ProjectCalendarComponent);
      todayFixture.detectChanges();

      expect(todayFixture.componentInstance.todayVisible()).toBe(true);
      expect(todayFixture.componentInstance.todayOffset()).toBe(2 * todayFixture.componentInstance.dayWidth());
      expect(todayFixture.nativeElement.querySelector('[data-testid="today-marker"]')).toBeTruthy();

      todayFixture.componentInstance.zoomIn();
      todayFixture.detectChanges();
      expect(todayFixture.componentInstance.todayVisible()).toBe(true);
    });

    it('hides the line when today falls outside the project range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T00:00:00Z'));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ProjectCalendarComponent],
        providers: [
          { provide: ProjectCalendarStore, useValue: store },
          { provide: ActivatedRoute, useValue: { snapshot: { parent: { paramMap: { get: () => 'p1' } }, paramMap: { get: () => null } } } }
        ]
      });
      store.modules.set(items); // '2026-01-01' -> '2026-01-05' - well after "today"
      const todayFixture = TestBed.createComponent(ProjectCalendarComponent);
      todayFixture.detectChanges();

      expect(todayFixture.componentInstance.todayVisible()).toBe(false);
      expect(todayFixture.nativeElement.querySelector('[data-testid="today-marker"]')).toBeNull();
    });
  });
});
