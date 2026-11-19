import { TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { InboxEscalateChoice, InboxEscalateDialogComponent } from './inbox-escalate-dialog.component';
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
    const el = q(id) as HTMLInputElement | HTMLTextAreaElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  // The shared dropdown opens a CDK overlay panel of option buttons, not <option> children.
  const pick = (id: string, label: string) => {
    (q(id)?.querySelector('[data-testid="select-trigger"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const options = Array.from(document.querySelectorAll('[data-testid="select-panel"] [data-testid="select-option"]')) as HTMLButtonElement[];
    options.find((option) => option.textContent?.trim() === label)!.click();
    fixture.detectChanges();
  };
  const person = (name: string) => {
    const rows = Array.from(document.querySelectorAll('[data-testid="inbox-escalate-option"]')) as HTMLButtonElement[];
    rows.find((row) => row.textContent?.includes(name))!.click();
    fixture.detectChanges();
  };
  return { fixture, q, button, click, type, pick, person, instance: fixture.componentInstance };
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
    const { q, button, click, pick, instance } = render(InboxOutcomeDialogComponent, {
      outcomes: ['excused', 'confirmed', 'convert_to_leave'],
      leaveTypes: [{ value: 'lt1', label: 'Annual leave' }, { value: 'lt2', label: 'Sick leave' }]
    });
    const sent: InboxOutcomeChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-outcome-leave-type')).toBeNull();
    click('inbox-outcome-convert_to_leave');
    expect(q('inbox-outcome-leave-type')).not.toBeNull();
    expect(button('inbox-outcome-confirm').disabled).toBe(true);
    pick('inbox-outcome-leave-type', 'Sick leave');
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
    const sent: InboxEscalateChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-escalate-target')?.textContent).toContain('next person up');
    expect(q('inbox-escalate-person')).toBeNull();
    type('inbox-escalate-note', '  No reply in 3 days ');
    click('inbox-escalate-confirm');

    expect(sent).toEqual([{ comment: 'No reply in 3 days', targetEmployeeId: null }]);
  });

  const people = [
    { employeeId: 'm1', name: 'Maya Fernando', position: 'Team Lead', isDefault: true },
    { employeeId: 'h1', name: 'Hana Perera', position: 'HR Manager', isDefault: false }
  ];

  it('preselects the suggested person and sends no target when it is kept', () => {
    const { q, click, instance } = render(InboxEscalateDialogComponent, { escalateTo: 'Maya Fernando', candidates: people });
    const sent: InboxEscalateChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-escalate-person')).not.toBeNull();
    expect(q('inbox-escalate-target')?.textContent).toContain('Maya Fernando');
    click('inbox-escalate-confirm');

    expect(sent).toEqual([{ comment: null, targetEmployeeId: null }]);
  });

  it('with no suggested person someone must be picked before it can be sent', () => {
    const others = people.map((p) => ({ ...p, isDefault: false }));
    const { q, button, person, instance } = render(InboxEscalateDialogComponent, { escalateTo: null, candidates: others });
    const sent: InboxEscalateChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-escalate-target')?.textContent).toContain('Pick who to send it to');
    expect(button('inbox-escalate-confirm').disabled).toBe(true);
    person('Maya Fernando');
    expect(button('inbox-escalate-confirm').disabled).toBe(false);
  });

  it('shows the ticket it escalates and counts the note against its limit', () => {
    const { q, type } = render(InboxEscalateDialogComponent, {
      escalateTo: 'Maya Fernando', candidates: people,
      context: { eyebrow: 'Leave request', title: 'Sick Leave - Tharmi', subtitle: 'Sick Leave · 15 Sep · 8 h' }
    });

    expect(q('inbox-escalate-context')?.textContent).toContain('Sick Leave - Tharmi');
    type('inbox-escalate-note', 'Policy question');
    expect(q('inbox-escalate-dialog')?.textContent).toContain('15/500');
  });

  it('searches people by name or position', () => {
    const { type } = render(InboxEscalateDialogComponent, { escalateTo: 'Maya Fernando', candidates: people });

    type('inbox-escalate-search', 'hr man');
    const rows = Array.from(document.querySelectorAll('[data-testid="inbox-escalate-option"]'));

    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Hana Perera')]);
  });

  it('sends the person picked instead of the suggestion', () => {
    const { q, click, person, instance } = render(InboxEscalateDialogComponent, { escalateTo: 'Maya Fernando', candidates: people });
    const sent: InboxEscalateChoice[] = [];
    instance.confirmed.subscribe((c) => sent.push(c));

    expect(q('inbox-escalate-person')?.textContent).toContain('Team Lead · Suggested');
    expect(q('inbox-escalate-person')?.textContent).toContain('HR Manager');
    person('Hana Perera');
    expect(q('inbox-escalate-target')?.textContent).toContain('Hana Perera');
    click('inbox-escalate-confirm');

    expect(sent).toEqual([{ comment: null, targetEmployeeId: 'h1' }]);
  });
});
