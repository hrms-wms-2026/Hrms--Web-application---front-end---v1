import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LandingValuePillarsComponent } from './landing-value-pillars.component';

describe('LandingValuePillarsComponent', () => {
  it('renders the four value pillars', async () => {
    await TestBed.configureTestingModule({ imports: [LandingValuePillarsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LandingValuePillarsComponent);
    fixture.detectChanges();

    const labels = fixture.debugElement.queryAll(By.css('.pillars__label')).map((el) => el.nativeElement.textContent.trim());
    expect(labels).toEqual(['Employee management', 'Attendance management', 'Time off management', 'Work management']);
  });
});
