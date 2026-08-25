import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObjectiveTimelineBarComponent } from './objective-timeline-bar.component';
import { ProjectCalendarItemDto } from '../../models/dto/calendar.dto';

const item = (overrides: Partial<ProjectCalendarItemDto> = {}): ProjectCalendarItemDto => ({
  objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
  startDate: '2026-01-10', endDate: '2026-01-12', isActive: true, isAchieved: false,
  canEdit: true, calendarEventId: null, calendarEventColor: null, ...overrides
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

  it('uses event color, accent color, and distinct achieved color by precedence', () => {
    expect(fixture.componentInstance.barColor()).toBe('var(--color-accent)');
    fixture.componentRef.setInput('item', item({ calendarEventColor: '#123456' }));
    expect(fixture.componentInstance.barColor()).toBe('#123456');
    fixture.componentRef.setInput('item', item({ canEdit: false, calendarEventColor: '#123456' }));
    expect(fixture.componentInstance.barColor()).toBe('#94A3B8');
    fixture.componentRef.setInput('item', item({ canEdit: true, isAchieved: true }));
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
