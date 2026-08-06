import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { LandingHeaderComponent } from './landing-header.component';

function setScrollY(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function scrollTo(y: number): Promise<void> {
  setScrollY(y);
  window.dispatchEvent(new Event('scroll'));
  await nextFrame();
}

describe('LandingHeaderComponent', () => {
  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingHeaderComponent);
    setScrollY(0);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => {
    setScrollY(0);
  });

  it('renders the primary navigation links', async () => {
    const fixture = await createComponent();
    const links = fixture.debugElement.queryAll(By.css('.landing-header__links a')).map((el) => el.nativeElement.textContent.trim());
    expect(links).toEqual(['Platform', 'Solutions', 'Resources']);
  });

  it('points the sign-in CTA at the existing login route', async () => {
    const fixture = await createComponent();
    const signIn = fixture.debugElement.query(By.css('.landing-header__signin')).nativeElement as HTMLAnchorElement;
    expect(signIn.getAttribute('routerLink') ?? signIn.getAttribute('href')).toContain('/auth/login');
  });

  it('toggles the mobile menu accessibly on button click', async () => {
    const fixture = await createComponent();
    const button = fixture.debugElement.query(By.css('.landing-header__menu-btn')).nativeElement as HTMLButtonElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.menuOpen()).toBe(true);

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the mobile menu after selecting an item', async () => {
    const fixture = await createComponent();
    fixture.componentInstance.toggleMenu();
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.css('#landing-mobile-nav a')).nativeElement as HTMLAnchorElement;
    item.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });

  it('renders the ONEXSO logo with accessible alt text', async () => {
    const fixture = await createComponent();
    const logo = fixture.debugElement.query(By.css('.landing-header__mark')).nativeElement as HTMLImageElement;
    expect(logo.getAttribute('alt')).toBe('ONEXSO');
  });

  it('does not render "OneVo Workspace" branding', async () => {
    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
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

  it('is visible on initial load', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance.headerVisible()).toBe(true);
  });

  it('stays visible while scrolling down below the hide threshold', async () => {
    const fixture = await createComponent();
    await scrollTo(60);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(true);
  });

  it('hides after scrolling down past the threshold', async () => {
    const fixture = await createComponent();
    await scrollTo(150);
    await scrollTo(220);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(false);
    expect(fixture.debugElement.query(By.css('.landing-header')).classes['landing-header--hidden']).toBe(true);
  });

  it('reappears when scrolling up from a lower section', async () => {
    const fixture = await createComponent();
    await scrollTo(150);
    await scrollTo(220);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(false);

    await scrollTo(190);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(true);
  });

  it('is visible again on returning near the top', async () => {
    const fixture = await createComponent();
    await scrollTo(150);
    await scrollTo(220);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(false);

    await scrollTo(40);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(true);
  });

  it('stays visible while the mobile menu is open even when scrolling down', async () => {
    const fixture = await createComponent();
    fixture.componentInstance.toggleMenu();
    fixture.detectChanges();

    await scrollTo(150);
    await scrollTo(300);
    fixture.detectChanges();

    expect(fixture.componentInstance.headerVisible()).toBe(true);
  });

  it('stays visible while keyboard focus is inside the header', async () => {
    const fixture = await createComponent();
    await scrollTo(150);
    await scrollTo(220);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(false);

    const signIn = fixture.debugElement.query(By.css('.landing-header__signin')).nativeElement as HTMLElement;
    signIn.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.headerVisible()).toBe(true);

    await scrollTo(400);
    fixture.detectChanges();
    expect(fixture.componentInstance.headerVisible()).toBe(true);
  });
});
