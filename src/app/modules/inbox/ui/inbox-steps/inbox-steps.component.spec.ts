import { TestBed } from '@angular/core/testing';
import { InboxStepsComponent } from './inbox-steps.component';

describe('InboxStepsComponent', () => {
  it('renders each step with its state, actor (except on the current step), time and note', () => {
    TestBed.configureTestingModule({ imports: [InboxStepsComponent] });
    const fixture = TestBed.createComponent(InboxStepsComponent);
    fixture.componentRef.setInput('steps', [
      { key: 'requested', label: 'Requested', actor: { id: 'e1', name: 'Bala' }, at: '2026-10-13T08:00:00Z', state: 'done', note: null },
      { key: 'decision', label: 'Waiting for Anu', actor: { id: 'e2', name: 'Anu' }, at: null, state: 'current', note: null },
      { key: 'resolved', label: 'Resolved', actor: null, at: null, state: 'upcoming', note: 'Not notified: the Milestone is achieved.' }
    ]);
    fixture.detectChanges();

    const steps = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="inbox-step"]')) as HTMLElement[];
    expect(steps.map((s) => s.getAttribute('data-state'))).toEqual(['done', 'current', 'upcoming']);
    expect(steps[0].textContent).toContain('Bala');
    expect(steps[0].querySelector('time')).not.toBeNull();
    expect(steps[1].textContent).not.toContain('· Anu');
    expect(steps[2].textContent).toContain('Not notified');
  });
});
