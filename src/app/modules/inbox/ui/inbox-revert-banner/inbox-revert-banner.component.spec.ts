import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { InboxRevertBannerComponent } from './inbox-revert-banner.component';

describe('InboxRevertBannerComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T10:12:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  function render(until: string) {
    TestBed.configureTestingModule({ imports: [InboxRevertBannerComponent] });
    const fixture = TestBed.createComponent(InboxRevertBannerComponent);
    fixture.componentRef.setInput('until', until);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, banner: () => el.querySelector('[data-testid="inbox-revert-banner"]') };
  }

  it('shows the deadline and a live countdown, then hides itself at expiry', () => {
    const { fixture, banner } = render('2026-10-15T10:42:00Z');
    const until = new Date('2026-10-15T10:42:00Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    expect(banner()?.textContent).toContain(`Undo — available until ${until}`);
    expect(banner()?.textContent).toContain('30:00');

    vi.advanceTimersByTime(65_000);
    fixture.detectChanges();
    expect(banner()?.textContent).toContain('28:55');

    vi.advanceTimersByTime(30 * 60_000);
    fixture.detectChanges();
    expect(banner()).toBeNull();
  });

  it('is not shown for a deadline already past', () => {
    expect(render('2026-10-15T10:00:00Z').banner()).toBeNull();
  });

  it('emits undo when clicked', () => {
    const { fixture, el } = render('2026-10-15T10:42:00Z');
    let undone = 0;
    fixture.componentInstance.undo.subscribe(() => undone++);

    (el.querySelector('[data-testid="inbox-revert-undo"]') as HTMLButtonElement).click();

    expect(undone).toBe(1);
  });
});
