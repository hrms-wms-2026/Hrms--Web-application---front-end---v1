import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarEventLegendComponent } from './calendar-event-legend.component';
import { ProjectCalendarEventBandDto } from '../../models/dto/calendar.dto';

const baseEvents: ProjectCalendarEventBandDto[] = [
  { eventId: 'e1', name: 'Release 1', color: '#2563EB', startDate: '2026-10-01', endDate: '2026-10-31', canEdit: true }
];

describe('CalendarEventLegendComponent', () => {
  let fixture: ComponentFixture<CalendarEventLegendComponent>;
  let component: CalendarEventLegendComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarEventLegendComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('events', baseEvents);
    fixture.detectChanges();
  });

  it('emits select with the event id when a row body is clicked', () => {
    const emitted: string[] = [];
    component.select.subscribe((id: string) => emitted.push(id));
    fixture.nativeElement.querySelector('.calendar-event').click();
    expect(emitted).toEqual(['e1']);
  });

  it('clicking the edit button emits edit but not select', () => {
    const selected: string[] = [];
    const edited: string[] = [];
    component.select.subscribe((id: string) => selected.push(id));
    component.edit.subscribe((id: string) => edited.push(id));
    fixture.nativeElement.querySelector('.calendar-event__action').click();
    expect(edited).toEqual(['e1']);
    expect(selected).toEqual([]);
  });
});
