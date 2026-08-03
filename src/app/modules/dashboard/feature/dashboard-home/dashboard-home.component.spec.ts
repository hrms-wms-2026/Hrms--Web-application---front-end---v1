import { TestBed } from '@angular/core/testing';
import { DashboardHomeComponent } from './dashboard-home.component';

describe('DashboardHomeComponent', () => {
  it('renders an empty skeleton content area without the removed placeholder UI', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).trim();
    expect(text).not.toContain('Welcome');
    expect(text).not.toContain('Sign out');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
