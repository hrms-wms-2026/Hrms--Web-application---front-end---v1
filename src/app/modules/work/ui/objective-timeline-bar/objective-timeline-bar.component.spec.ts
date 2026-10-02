import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObjectiveTimelineBarComponent } from './objective-timeline-bar.component';
import { ProjectCalendarEventLinkDto, ProjectCalendarModuleDto } from '../../models/dto/calendar.dto';

const link = (overrides: Partial<ProjectCalendarEventLinkDto> = {}): ProjectCalendarEventLinkDto => ({
  eventId: 'e1', eventName: 'Release', eventColor: '#123456',
  eventStartDate: '2026-01-01', eventEndDate: '2026-01-31',
  membership: 'whole', tasksInEventCount: 3, taskTotalCount: 3, ...overrides
});

const item = (overrides: Partial<ProjectCalendarModuleDto> = {}): ProjectCalendarModuleDto => ({
  objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
  startDate: '2026-01-10', endDate: '2026-01-12', isActive: true, isAchieved: false,
  canEdit: true, events: [], ...overrides
});

describe('ObjectiveTimelineBarComponent', () => {
  let fixture: ComponentFixture<ObjectiveTimelineBarComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ObjectiveTimelineBarComponent] });
    fixture = TestBed.createComponent(ObjectiveTimelineBarComponent);
    fixture.componentRef.setInput('item', item());
    fixture.componentRef.setInput('timelineStart', '2026-01-01');
    fixture.componentRef.setInput('dayWidth', 10);
    fixture.detectChanges();
  });

  it('paints a module in no event neutral grey', () => {
    expect(fixture.componentInstance.barColor()).toBe('#94A3B8');
  });

  it('paints a whole-member module in its event colour', () => {
    fixture.componentRef.setInput('item', item({ events: [link({ eventColor: '#AA1122', membership: 'whole' })] }));
    expect(fixture.componentInstance.barColor()).toBe('#AA1122');
    expect(fixture.componentInstance.partialBadge()).toBeNull();
  });

  it('paints a partial module in the event colour and shows an N/M badge', () => {
    fixture.componentRef.setInput('item', item({
      events: [link({ eventColor: '#00AA55', membership: 'partial', tasksInEventCount: 2, taskTotalCount: 5 })]
    }));
    expect(fixture.componentInstance.barColor()).toBe('#00AA55');
    expect(fixture.componentInstance.partialBadge()).toBe('2/5');
  });

  it('uses a distinct achieved colour regardless of event links', () => {
    fixture.componentRef.setInput('item', item({ isAchieved: true, events: [link()] }));
    expect(fixture.componentInstance.barColor()).toBe('#64748B');
  });

  it('calculates the initial position and width in day pixels', () => {
    expect(fixture.componentInstance.left()).toBe(90);
    expect(fixture.componentInstance.width()).toBe(30);
  });

  it('does not emit a drag change for inaccessible objectives', () => {
    fixture.componentRef.setInput('item', item({ canEdit: false }));
    fixture.detectChanges();
    let emitted = false;
    fixture.componentInstance.dateChange.subscribe(() => emitted = true);
    fixture.componentInstance.startDrag(new PointerEvent('pointerdown', { clientX: 0 }), 'move');
    expect(emitted).toBe(false);
  });

  it('moves the rendered bar live during a drag, before pointerup commits it', () => {
    const bar = fixture.nativeElement.querySelector('[data-testid="timeline-bar-o1"]') as HTMLElement;
    expect(bar.style.left).toBe('90px');
    expect(bar.style.width).toBe('30px');

    fixture.componentInstance.startDrag(new PointerEvent('pointerdown', { clientX: 10 }), 'move');
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 30 }));
    fixture.detectChanges();

    expect(bar.style.left).toBe('110px');
    expect(bar.style.width).toBe('30px');

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 30 }));
  });

  it('emits a shifted date range for a whole-bar drag', () => {
    let change: unknown;
    fixture.componentInstance.dateChange.subscribe((value) => change = value);
    fixture.componentInstance.startDrag(new PointerEvent('pointerdown', { clientX: 10 }), 'move');
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 30 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 30 }));
    expect(change).toEqual({ objectiveId: 'o1', startDate: '2026-01-12', endDate: '2026-01-14' });
  });

  it('emits an expanded end date for an end-handle drag', () => {
    let change: unknown;
    fixture.componentInstance.dateChange.subscribe((value) => change = value);
    fixture.componentInstance.startDrag(new PointerEvent('pointerdown', { clientX: 10 }), 'end');
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20 }));
    expect(change).toEqual({ objectiveId: 'o1', startDate: '2026-01-10', endDate: '2026-01-13' });
  });
});
