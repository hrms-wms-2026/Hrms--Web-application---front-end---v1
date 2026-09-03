import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TopNavbarComponent } from './top-navbar.component';

describe('TopNavbarComponent', () => {
  it('renders the avatar trigger button and does not render raw email outside the popover', async () => {
    await TestBed.configureTestingModule({
      imports: [TopNavbarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    const fixture = TestBed.createComponent(TopNavbarComponent);
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    const avatarButton = fixture.nativeElement.querySelector('.profile-menu-trigger');
    expect(avatarButton).toBeTruthy();
    expect(avatarButton.getAttribute('aria-label')).toBe('Profile and settings');

    // Topbar content outside the popover should NOT render the raw email directly as text
    const topbarTextContent = fixture.nativeElement.textContent || '';
    expect(topbarTextContent).not.toContain('asha@onevo.test');
  });

  it('renders avatar button without raw email text when no inputs are bound', async () => {
    await TestBed.configureTestingModule({
      imports: [TopNavbarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    const fixture = TestBed.createComponent(TopNavbarComponent);
    fixture.detectChanges();

    const avatarButton = fixture.nativeElement.querySelector('.profile-menu-trigger');
    expect(avatarButton).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('@');
  });
});
