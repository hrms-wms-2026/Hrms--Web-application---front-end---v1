import { TestBed } from '@angular/core/testing';
import { TopNavbarComponent } from './top-navbar.component';

describe('TopNavbarComponent', () => {
  it('renders the profile capsule with the provided email', async () => {
    await TestBed.configureTestingModule({ imports: [TopNavbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TopNavbarComponent);
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-home-page-profile-capsule')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('asha@onevo.test');
  });

  it('renders the profile capsule with "User" when no inputs are bound', async () => {
    await TestBed.configureTestingModule({ imports: [TopNavbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TopNavbarComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('User');
  });
});
