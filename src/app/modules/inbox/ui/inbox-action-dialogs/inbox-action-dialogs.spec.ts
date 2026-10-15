import { TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { InboxEscalateDialogComponent } from './inbox-escalate-dialog.component';
import { InboxForwardDialogComponent } from './inbox-forward-dialog.component';
import { InboxOutcomeDialogComponent, InboxOutcomeChoice } from './inbox-outcome-dialog.component';

function render<T>(component: Type<T>, inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({ imports: [component] });
  const fixture = TestBed.createComponent(component);
  for (const [k, v] of Object.entries({ open: true, ...inputs })) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const button = (id: string) => (q(id)?.querySelector('button') ?? q(id)) as HTMLButtonElement;
  const click = (id: string) => { button(id).click(); fixture.detectChanges(); };
  const type = (id: string, value: string) => {
    const el = q(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    el.value = value;
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  };
  return { fixture, q, button, click, type, instance: fixture.componentInstance };
}

afterEach(() => TestBed.resetTestingModule());

describe('InboxOutcomeDialogComponent', () => {
  it('offers exactly the outcomes of the action and sends the chosen one with the note', () => {
    const { q, click, type, instance } = render(InboxOutcomeDialogComponent, { outcomes: ['excused', 'confirmed'] });
    const sent: InboxOutcomeChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-outcome-excused')).not.toBeNull();
    expect(q('inbox-outcome-convert_to_leave')).toBeNull();
    click('inbox-outcome-excused');
    type('inbox-outcome-note', ' Doctor visit ');
    click('inbox-outcome-confirm');

    expect(sent).toEqual([{ outcome: 'excused', comment: 'Doctor visit', leaveTypeId: null }]);
  });

  it('needs an outcome before it can be confirmed', () => {
    const { button } = render(InboxOutcomeDialogComponent, { outcomes: ['excused', 'confirmed'] });
    expect(button('inbox-outcome-confirm').disabled).toBe(true);
  });

  it('convert to leave needs a leave type from the given options', () => {
    const { q, button, click, type, instance } = render(InboxOutcomeDialogComponent, {
      outcomes: ['excused', 'confirmed', 'convert_to_leave'],
      leaveTypes: [{ value: 'lt1', label: 'Annual leave' }, { value: 'lt2', label: 'Sick leave' }]
    });
    const sent: InboxOutcomeChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-outcome-leave-type')).toBeNull();
    click('inbox-outcome-convert_to_leave');
    expect(q('inbox-outcome-leave-type')).not.toBeNull();
    expect(button('inbox-outcome-confirm').disabled).toBe(true);
    type('inbox-outcome-leave-type', 'lt2');
    click('inbox-outcome-confirm');

    expect(sent).toEqual([{ outcome: 'convert_to_leave', comment: null, leaveTypeId: 'lt2' }]);
  });
});

describe('InboxEscalateDialogComponent', () => {
  it('previews who it goes to when the action names them', () => {
    const { q } = render(InboxEscalateDialogComponent, { escalateTo: 'Maya Fernando' });
    expect(q('inbox-escalate-target')?.textContent).toContain('Maya Fernando');
  });

  it('says it will only be logged when there is no one above', () => {
    const { q } = render(InboxEscalateDialogComponent, { escalateTo: '' });
    expect(q('inbox-escalate-target')?.textContent).toContain('No one above – this will be logged');
  });

  it('without a preview it explains the chain, and sends the trimmed note', () => {
    const { q, click, type, instance } = render(InboxEscalateDialogComponent, { escalateTo: null });
    const sent: (string | null)[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-escalate-target')?.textContent).toContain('next person up');
    type('inbox-escalate-note', '  No reply in 3 days ');
    click('inbox-escalate-confirm');

    expect(sent).toEqual(['No reply in 3 days']);
  });
});

describe('InboxForwardDialogComponent', () => {
  it('names the recipient and sends an optional note', () => {
    const { q, click, instance } = render(InboxForwardDialogComponent, { recipient: 'Anu Perera' });
    const sent: (string | null)[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-forward-dialog')?.textContent).toContain('Send to Anu Perera');
    click('inbox-forward-confirm');

    expect(sent).toEqual([null]);
  });
});
