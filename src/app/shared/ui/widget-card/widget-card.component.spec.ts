import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WidgetCardComponent, WidgetState } from './widget-card.component';

@Component({
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work Network"
      [state]="state()"
      errorMessage="Could not load."
      emptyMessage="Nothing here yet."
      (retry)="retries = retries + 1"
    >
      <p data-testid="projected">content</p>
    </app-widget-card>
  `
})
class HostComponent {
  readonly state = signal<WidgetState>('ready');
  retries = 0;
}

describe('WidgetCardComponent', () => {
  function setup(state: WidgetState) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.state.set(state);
    fixture.detectChanges();
    return fixture;
  }

  const q = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`);

  it('always renders the title', () => {
    expect(setup('ready').nativeElement.textContent).toContain('Work Network');
  });

  it('does not leave the title as a native hover tooltip on the host', () => {
    const host = setup('ready').nativeElement.querySelector('app-widget-card') as HTMLElement;
    expect(host.hasAttribute('title')).toBe(false);
  });

  it('projects content when ready', () => {
    const f = setup('ready');
    expect(q(f, 'projected')).toBeTruthy();
    expect(q(f, 'widget-loading')).toBeFalsy();
  });

  it('shows a busy skeleton and hides content while loading', () => {
    const f = setup('loading');
    expect(q(f, 'widget-loading')).toBeTruthy();
    expect(q(f, 'projected')).toBeFalsy();
    expect(f.nativeElement.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows the empty message', () => {
    const f = setup('empty');
    expect(q(f, 'widget-empty')?.textContent).toContain('Nothing here yet.');
    expect(q(f, 'projected')).toBeFalsy();
  });

  it('shows the no-access message when forbidden', () => {
    const f = setup('forbidden');
    expect(q(f, 'widget-forbidden')?.textContent).toContain('do not have access');
  });

  it('shows the error state and emits retry', () => {
    const f = setup('error');
    expect(f.nativeElement.textContent).toContain('Could not load.');

    const retryButton = f.nativeElement.querySelector('app-error-state button') as HTMLButtonElement;
    retryButton.click();

    expect(f.componentInstance.retries).toBe(1);
  });
});
