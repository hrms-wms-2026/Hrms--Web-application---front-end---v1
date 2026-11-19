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
    expect(heading.textContent).toContain('Turning Workforce');
    expect(heading.textContent).toContain('Visibility Into Performance');
  });

  it('points the hero primary CTA at the /book-a-demo route', async () => {
    const fixture = await createComponent();
    const primary = fixture.debugElement.query(By.css('.hero__btn--primary')).nativeElement as HTMLAnchorElement;
    expect(primary.getAttribute('routerLink') ?? primary.getAttribute('href')).toContain('/book-a-demo');
  });

  it('points the hero secondary CTA at the pillars section anchor', async () => {
    const fixture = await createComponent();
    const secondary = fixture.debugElement.query(By.css('.hero__btn--secondary')).nativeElement as HTMLAnchorElement;
    expect(secondary.getAttribute('routerLink') ?? secondary.getAttribute('href')).toContain('#pillars');
  });

  it('renders the header primary navigation', async () => {
    const fixture = await createComponent();
    const links = fixture.debugElement.queryAll(By.css('.landing-header__links a')).map((el) => el.nativeElement.textContent.trim());
    expect(links).toEqual(['Features', 'Solution', 'How it Works', 'About']);
  });

  it('renders five unique selling point cards', async () => {
    const fixture = await createComponent();
    const cards = fixture.debugElement.queryAll(By.css('.bento__card-title'));
    expect(cards.length).toBe(5);
  });

  it('renders CROWNUS branding and no legacy OneVo branding', async () => {
    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('CROWNUS');
    expect(text).not.toContain('OneVo');
    expect(text).not.toContain('OneVo Workspace');
  });

  it('does not render the system status indicator', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('All systems operational');
    expect(el.querySelector('.landing-header__status')).toBeNull();
    expect(el.querySelector('.landing-header__status-dot')).toBeNull();
  });
});
