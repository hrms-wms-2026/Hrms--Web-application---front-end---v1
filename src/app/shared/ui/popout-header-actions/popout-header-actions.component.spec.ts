import { TestBed } from '@angular/core/testing';
import {
  PopoutHeaderActionsComponent,
  formatRefreshedAgo,
  latestDate,
  replayDashboardMotion,
} from './popout-header-actions.component';

describe('formatRefreshedAgo', () => {
  const now = new Date('2026-10-01T12:00:00Z');

  it('says just now under a minute, then minutes, then hours', () => {
    expect(formatRefreshedAgo(new Date('2026-10-01T11:59:30Z'), now)).toBe('just now');
    expect(formatRefreshedAgo(new Date('2026-10-01T11:55:00Z'), now)).toBe('5 min ago');
    expect(formatRefreshedAgo(new Date('2026-10-01T09:00:00Z'), now)).toBe('3 h ago');
  });

  it('never goes negative for a time just after now', () => {
    expect(formatRefreshedAgo(new Date('2026-10-01T12:00:05Z'), now)).toBe('just now');
  });
});

describe('latestDate', () => {
  it('returns the newest date, or null when none', () => {
    const a = new Date('2026-10-01T10:00:00Z');
    const b = new Date('2026-10-01T11:00:00Z');
    expect(latestDate(a, null, b)).toBe(b);
    expect(latestDate(null, undefined)).toBeNull();
  });
});

describe('PopoutHeaderActionsComponent', () => {
  function setup(refreshedAt: Date | null, refreshing = false) {
    TestBed.configureTestingModule({ imports: [PopoutHeaderActionsComponent] });
    const fixture = TestBed.createComponent(PopoutHeaderActionsComponent);
    fixture.componentRef.setInput('refreshedAt', refreshedAt);
    fixture.componentRef.setInput('refreshing', refreshing);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows when the data was last loaded, a refresh and a close button', () => {
    const { el } = setup(new Date());

    expect(el.querySelector('[data-testid="refreshed-label"]')!.textContent).toContain('Refreshed just now');
    expect(el.querySelector('[data-testid="popout-refresh"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="popout-close"]')).toBeTruthy();
  });

  it('hides the label until data has loaded', () => {
    const { el } = setup(null);

    expect(el.querySelector('[data-testid="refreshed-label"]')).toBeNull();
  });

  it('emits refresh and closed, and disables refresh while one is running', () => {
    const { fixture, el } = setup(new Date());
    const refresh = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.refresh.subscribe(refresh);
    fixture.componentInstance.closed.subscribe(closed);

    (el.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
    (el.querySelector('[data-testid="popout-close"]') as HTMLButtonElement).click();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('refreshing', true);
    fixture.detectChanges();
    expect((el.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('replayDashboardMotion', () => {
  /** Nests each tag in the one before it, inside a root div, and returns the root. */
  function tree(...tags: string[]): HTMLElement {
    const root = document.createElement('div');
    tags.reduce<HTMLElement>((parent, tag) => {
      const [name, cls] = tag.split('.');
      const el = document.createElement(name);
      if (cls) el.className = cls;
      return parent.appendChild(el);
    }, root);
    return root;
  }

  it('alternates the widget between the two replay classes', () => {
    const root = tree('div.dash-motion', 'button');
    const widget = root.querySelector<HTMLElement>('.dash-motion')!;
    const button = root.querySelector<HTMLElement>('button')!;

    replayDashboardMotion(button);
    expect(widget.className).toBe('dash-motion dash-replay-a');
    replayDashboardMotion(button);
    expect(widget.className).toBe('dash-motion dash-replay-b');
    replayDashboardMotion(button);
    expect(widget.className).toBe('dash-motion dash-replay-a');
  });

  it('inside a popup replays only the popup', () => {
    const root = tree('div.dash-motion', 'app-modal', 'button');

    replayDashboardMotion(root.querySelector<HTMLElement>('button')!);

    expect(root.querySelector('app-modal')!.classList).toContain('dash-replay-a');
    expect(root.querySelector('.dash-motion')!.className).toBe('dash-motion');
  });

  it('a card refresh under an open popup replays the popup, never fading the widget that holds it', () => {
    const root = tree('div.dash-motion', 'header', 'button');
    const widget = root.querySelector<HTMLElement>('.dash-motion')!;
    const closed = widget.appendChild(document.createElement('app-modal'));
    const open = widget.appendChild(document.createElement('app-modal'));
    open.appendChild(document.createElement('div')).setAttribute('role', 'dialog');

    replayDashboardMotion(root.querySelector<HTMLElement>('button')!);

    expect(widget.className).toBe('dash-motion');
    expect(closed.className).toBe('');
    expect(open.classList).toContain('dash-replay-a');
  });

  it('does nothing outside the dashboard', () => {
    const root = tree('app-modal', 'button');

    replayDashboardMotion(root.querySelector<HTMLElement>('button')!);

    expect(root.querySelector('app-modal')!.className).toBe('');
  });

  it('a finished refresh replays the widget around the header', () => {
    const widget = document.createElement('div');
    widget.className = 'dash-motion';
    document.body.appendChild(widget);
    const fixture = TestBed.createComponent(PopoutHeaderActionsComponent);
    widget.appendChild(fixture.nativeElement);

    fixture.componentRef.setInput('refreshing', true);
    fixture.detectChanges();
    expect(widget.className).toBe('dash-motion');

    fixture.componentRef.setInput('refreshing', false);
    fixture.detectChanges();
    expect(widget.className).toBe('dash-motion dash-replay-a');

    fixture.destroy();
    widget.remove();
    TestBed.resetTestingModule();
  });
});
