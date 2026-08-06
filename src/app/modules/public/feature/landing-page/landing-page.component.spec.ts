import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the main heading', async () => {
    const fixture = await createComponent();
    const heading = fixture.debugElement.query(By.css('h1')).nativeElement as HTMLElement;
    expect(heading.textContent).toContain('Everything your people need');
  });

  it('points the hero sign-in CTA at the existing login route', async () => {
    const fixture = await createComponent();
    const signIn = fixture.debugElement.query(By.css('.hero__btn--primary')).nativeElement as HTMLAnchorElement;
    expect(signIn.getAttribute('routerLink') ?? signIn.getAttribute('href')).toContain('/auth/login');
  });

  it('points the book-a-demo CTA at the /book-a-demo route', async () => {
    const fixture = await createComponent();
    const demo = fixture.debugElement.query(By.css('.hero__btn--secondary')).nativeElement as HTMLAnchorElement;
    expect(demo.getAttribute('routerLink') ?? demo.getAttribute('href')).toContain('/book-a-demo');
  });

  it('renders the header primary navigation', async () => {
    const fixture = await createComponent();
    const links = fixture.debugElement.queryAll(By.css('.landing-header__links a')).map((el) => el.nativeElement.textContent.trim());
    expect(links).toEqual(['Platform', 'Solutions', 'Resources']);
  });

  it('renders four value pillars', async () => {
    const fixture = await createComponent();
    const labels = fixture.debugElement.queryAll(By.css('.pillars__label'));
    expect(labels.length).toBe(4);
  });

  it('renders ONEXSO branding and no legacy OneVo Workspace branding', async () => {
    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ONEXSO');
    expect(text).not.toContain('OneVo');
    expect(text).not.toContain('Workspace');
  });

  it('does not render the system status indicator', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('All systems operational');
    expect(el.querySelector('.landing-header__status')).toBeNull();
    expect(el.querySelector('.landing-header__status-dot')).toBeNull();
  });
});
