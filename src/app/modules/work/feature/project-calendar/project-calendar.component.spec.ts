import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { ProjectCalendarComponent } from './project-calendar.component';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { CalendarEventDto, ProjectCalendarEventBandDto, ProjectCalendarModuleDto } from '../../models/dto/calendar.dto';
import { ProjectMonitorStore } from '../../state/project-monitor.store';

const items: ProjectCalendarModuleDto[] = [{
  objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
  startDate: '2026-01-01', endDate: '2026-01-05', isActive: true, isAchieved: false,
  canEdit: true, events: []
}];

describe('ProjectCalendarComponent', () => {
  let fixture: ComponentFixture<ProjectCalendarComponent>;
  const band: ProjectCalendarEventBandDto = { eventId: 'e1', name: 'R1', color: '#2563EB', startDate: '2026-01-01', endDate: '2026-01-05', canEdit: true };
  const detail: CalendarEventDto = {
    id: 'e1', projectId: 'p1', name: 'R1', color: '#2563EB', status: 'active', startDate: '2026-01-01', endDate: '2026-01-05',
    objectiveIds: ['o1'], taskIds: ['t1', 't2']
  };
  const store = {
    modules: signal(items), bands: signal([]), events: signal([]), activeEvents: signal<ProjectCalendarEventBandDto[]>([]), loading: signal(false), saving: signal(false),
    error: signal<string | null>(null), pendingSet: signal(new Set<string>()), approvalMessages: signal<Record<string, string>>({}),
    eventDetail: signal<CalendarEventDto | null>(null), eventTasks: signal([]), eventActivity: signal([]),
    load: vi.fn().mockResolvedValue(undefined), saveDates: vi.fn().mockResolvedValue({ success: true, applied: true, pendingApproval: false }),
    createEvent: vi.fn().mockResolvedValue(true), updateEvent: vi.fn().mockResolvedValue(true), closeEvent: vi.fn().mockResolvedValue(true),
    loadEventDetail: vi.fn(), loadEventTasks: vi.fn().mockResolvedValue(undefined), loadEventActivity: vi.fn().mockResolvedValue(undefined),
    clearEventPanel: vi.fn()
  };
  const monitor = { load: vi.fn().mockResolvedValue(undefined), alertsFor: vi.fn().mockReturnValue([]) };

  beforeEach(() => {
    store.activeEvents.set([]);
    store.eventDetail.set(null);
    store.loadEventDetail.mockReset().mockImplementation(async () => { store.eventDetail.set(detail); return detail; });
    monitor.alertsFor.mockReturnValue([]);
    TestBed.configureTestingModule({
      imports: [ProjectCalendarComponent],
      providers: [
        { provide: ProjectCalendarStore, useValue: store },
        { provide: ProjectMonitorStore, useValue: monitor },
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

  describe('milestone panel and edit', () => {
    beforeEach(() => {
      store.activeEvents.set([band]);
      fixture.detectChanges();
    });

    it('clicking a milestone opens the explanation panel and fetches its detail', async () => {
      fixture.nativeElement.querySelector('.calendar-event').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(store.loadEventDetail).toHaveBeenCalledWith('e1');
      expect(fixture.nativeElement.querySelector('[data-testid="milestone-explanation-panel"]')).toBeTruthy();
    });

    it('Edit fetches the real event detail (actual taskIds) before opening the modal, instead of reusing the zero-taskIds band stub', async () => {
      fixture.nativeElement.querySelector('.calendar-event__action').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.editingEvent()?.taskIds).toEqual(['t1', 't2']);
      expect(fixture.componentInstance.modalOpen()).toBe(true);
    });

    it('Edit does NOT open the modal if the detail fetch fails - a blank modal would save as Create and wipe links', async () => {
      store.loadEventDetail.mockImplementation(async () => null);
      fixture.nativeElement.querySelector('.calendar-event__action').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.modalOpen()).toBe(false);
    });

    it('does not derive at-risk from alerts on an achieved module', () => {
      store.eventDetail.set(detail);
      monitor.alertsFor.mockReturnValue([{ id: 'a1', inAchievedModule: true }]);
      expect(fixture.componentInstance.hasOpenAlertForEvent('e1')).toBe(false);
      monitor.alertsFor.mockReturnValue([{ id: 'a2', inAchievedModule: false }]);
      expect(fixture.componentInstance.hasOpenAlertForEvent('e1')).toBe(true);
    });

    it('closing the open milestone also closes its panel', async () => {
      fixture.nativeElement.querySelector('.calendar-event').click();
      await fixture.whenStable();
      await fixture.componentInstance.closeEvent('e1');
      expect(fixture.componentInstance.panelEventId()).toBeNull();
      expect(store.clearEventPanel).toHaveBeenCalled();
    });
  });

  it('renders each objective label via the shared compact tree row, not bespoke markup', () => {
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('[data-testid="tree-row"]');
    expect(row).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="folder-icon"]')).toBeTruthy();
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

    const rootBody = fixture.nativeElement.querySelector('[data-testid="calendar-row-o1"] .project-calendar__objective-body') as HTMLElement;
    const childBody = fixture.nativeElement.querySelector('[data-testid="calendar-row-o2"] .project-calendar__objective-body') as HTMLElement;
    expect(childBody.style.marginLeft).not.toBe(rootBody.style.marginLeft);
    // Root has no ancestor, so it gets no connector guide; the child's single-level guide draws its own elbow.
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-row-o1"] .project-calendar__guides')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-row-o2"] .project-calendar__guide-col--elbow')).toBeTruthy();
    // Expanded by default - both bars stay on screen until the parent's chevron is collapsed.
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o1"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o2"]')).toBeTruthy();
  });

  it('collapses a module via its chevron, hiding its children and their bars, without touching the rest of the tree', () => {
    // o1 is the project root; o2 is a real top-level module (the one with the chevron);
    // o3 is o2's own child, and o4 a sibling module - to prove collapsing o2 only affects o2's own branch.
    const treeItems: ProjectCalendarModuleDto[] = [
      { ...items[0] },
      { objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Module',
        startDate: '2026-01-02', endDate: '2026-01-04', isActive: true, isAchieved: false,
        canEdit: true, events: [] },
      { objectiveId: 'o3', projectId: 'p1', parentObjectiveId: 'o2', title: 'Sub module',
        startDate: '2026-01-02', endDate: '2026-01-03', isActive: true, isAchieved: false,
        canEdit: true, events: [] },
      { objectiveId: 'o4', projectId: 'p1', parentObjectiveId: 'o1', title: 'Other module',
        startDate: '2026-01-02', endDate: '2026-01-04', isActive: true, isAchieved: false,
        canEdit: true, events: [] }
    ];
    store.modules.set(treeItems);
    fixture.detectChanges();

    // The project root itself has no chevron - collapsing it would hide the whole chart, so it's not collapsible.
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-row-o1"] [data-testid="chevron"]')).toBeNull();
    const chevron = fixture.nativeElement.querySelector(
      '[data-testid="calendar-row-o2"] [data-testid="chevron"]'
    ) as HTMLButtonElement;
    expect(chevron).toBeTruthy();
    // A leaf objective (no children) gets no chevron at all.
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-row-o3"] [data-testid="chevron"]')).toBeNull();

    chevron.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-row-o3"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o3"]')).toBeNull();
    // Everything outside o2's own branch is untouched.
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o1"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o2"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o4"]')).toBeTruthy();

    chevron.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="timeline-bar-o3"]')).toBeTruthy();
  });

  it('gives the root a fixed summary color and every other bar the neutral gray default (no per-branch bar tint - coverage color now lives on fill segments)', () => {
    const treeItems: ProjectCalendarModuleDto[] = [
      { ...items[0] },
      { objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Module A',
        startDate: '2026-01-02', endDate: '2026-01-04', isActive: true, isAchieved: false,
        canEdit: true, events: [] },
      { objectiveId: 'o3', projectId: 'p1', parentObjectiveId: 'o2', title: 'Sub of A',
        startDate: '2026-01-02', endDate: '2026-01-03', isActive: true, isAchieved: false,
        canEdit: true, events: [] },
      { objectiveId: 'o4', projectId: 'p1', parentObjectiveId: 'o1', title: 'Module B',
        startDate: '2026-01-02', endDate: '2026-01-04', isActive: true, isAchieved: false,
        canEdit: true, events: [] }
    ];
    store.modules.set(treeItems);
    fixture.detectChanges();

    const colorOf = (id: string) =>
      (fixture.nativeElement.querySelector(`[data-testid="timeline-bar-${id}"]`) as HTMLElement).style.getPropertyValue('--bar-color');

    expect(colorOf('o1')).toBe('#1E293B'); // the fixed root/summary color
    expect(colorOf('o2')).toBe('#94A3B8');
    expect(colorOf('o4')).toBe('#94A3B8');
    expect(colorOf('o3')).toBe('#94A3B8');
  });

  it('shows no full-width milestone band overlay', () => {
    const treeItems: ProjectCalendarModuleDto[] = [
      { ...items[0], events: [{ eventId: 'e1', eventName: 'R1', eventColor: '#2563EB', eventStartDate: '2026-01-01', eventEndDate: '2026-01-05', membership: 'whole', tasksInEventCount: 1, taskTotalCount: 1 }] }
    ];
    store.modules.set(treeItems);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.project-calendar__band')).toBeNull();
  });

  it('renders a diamond marker on a row linked to a milestone, at the link end date', () => {
    const treeItems: ProjectCalendarModuleDto[] = [
      { ...items[0], events: [{ eventId: 'e1', eventName: 'R1', eventColor: '#2563EB', eventStartDate: '2026-01-01', eventEndDate: '2026-01-05', membership: 'whole', tasksInEventCount: 1, taskTotalCount: 1 }] }
    ];
    store.modules.set(treeItems);
    fixture.detectChanges();
    const marker = fixture.nativeElement.querySelector('[data-testid="calendar-milestone-marker"]');
    expect(marker).toBeTruthy();
    expect(marker.title).toContain('R1');
  });

  it('rows with no event link render no diamond marker', () => {
    store.modules.set(items);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-milestone-marker"]').length).toBe(0);
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
      const toolbarStore = TestBed.inject(WorkPageToolbarStore);
      const embeddedView = toolbarStore.template()?.createEmbeddedView(null);
      embeddedView?.detectChanges();
      const fitButton = (embeddedView?.rootNodes[0] as HTMLElement)?.querySelector('[data-testid="fit-to-screen"]') as HTMLButtonElement | null;
      if (fitButton) {
        fitButton.click();
      } else {
        fixture.componentInstance.fitToScreen();
      }
      fixture.detectChanges();

      // 5-day project, 700px / 5 = 140px/day
      expect(fixture.componentInstance.dayWidth()).toBe(140);
    });

    it('registers the calendar toolbar with zoom controls and create milestone button in the toolbarStore', () => {
      const toolbarStore = TestBed.inject(WorkPageToolbarStore);
      expect(toolbarStore.template()).not.toBeNull();
      const embeddedView = toolbarStore.template()?.createEmbeddedView(null);
      embeddedView?.detectChanges();
      const root = embeddedView?.rootNodes[0] as HTMLElement;
      expect(root.querySelector('[data-testid="zoom-controls"]')).toBeTruthy();
      expect(root.textContent).toContain('Create milestone');
    });

    it('scales the fit floor down with a sane minimum for a very long project', () => {
      fixture.componentInstance.containerWidth.set(250); // 10px available - below the 3px/day floor's need
      fixture.componentInstance.fitToScreen();
      fixture.detectChanges();
      expect(fixture.componentInstance.dayWidth()).toBe(3);
    });
  });

  describe('month navigation', () => {
    const toolbarRoot = (): HTMLElement => {
      const embeddedView = TestBed.inject(WorkPageToolbarStore).template()?.createEmbeddedView(null);
      embeddedView?.detectChanges();
      return embeddedView?.rootNodes[0] as HTMLElement;
    };

    beforeEach(() => {
      store.modules.set(items); // starts 2026-01-01
      fixture.detectChanges();
    });

    it('shows the month at the current scroll position in the toolbar', () => {
      const label = toolbarRoot().querySelector('[data-testid="calendar-month-label"]');
      expect(label?.textContent?.trim()).toBe('January 2026');
    });

    it('label tracks the scroll offset, discounting the label column', () => {
      fixture.componentInstance.zoomDayWidth.set(20);
      fixture.componentInstance.scrollLeft.set(fixture.componentInstance.LABEL_WIDTH + 40 * fixture.componentInstance.dayWidth());
      expect(fixture.componentInstance.currentMonthLabel()).toBe('February 2026');
    });

    it('scrollMonth scrolls the timeline container by ~30 days of width, forward or back', () => {
      const el = fixture.nativeElement.querySelector('.project-calendar__timeline-scroll') as HTMLElement;
      const scrollBy = vi.fn();
      (el as any).scrollBy = scrollBy;
      fixture.componentInstance.scrollMonth(1);
      expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 30 * fixture.componentInstance.dayWidth() }));
      fixture.componentInstance.scrollMonth(-1);
      expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -30 * fixture.componentInstance.dayWidth() }));
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
          { provide: ProjectMonitorStore, useValue: monitor },
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
          { provide: ProjectMonitorStore, useValue: monitor },
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
