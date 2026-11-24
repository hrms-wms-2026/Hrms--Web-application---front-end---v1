import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkspaceSelectorComponent } from './workspace-selector.component';

describe('WorkspaceSelectorComponent', () => {
  const workspaces = [
    { slug: 'acme', displayName: 'Acme Corp' },
    { slug: 'beta', displayName: 'Beta Ltd' },
  ];

  function setup(
    inputs: { busy?: boolean; error?: string | null } = {},
  ): ComponentFixture<WorkspaceSelectorComponent> {
    TestBed.configureTestingModule({ imports: [WorkspaceSelectorComponent] });
    const fixture = TestBed.createComponent(WorkspaceSelectorComponent);
    fixture.componentRef.setInput('workspaces', workspaces);
    if (inputs.busy !== undefined) fixture.componentRef.setInput('busy', inputs.busy);
    if (inputs.error !== undefined) fixture.componentRef.setInput('error', inputs.error);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<WorkspaceSelectorComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;
  const continueButton = (
    fixture: ComponentFixture<WorkspaceSelectorComponent>,
  ): HTMLButtonElement =>
    el(fixture).querySelector('.workspace-selector__continue') as HTMLButtonElement;
  const radios = (fixture: ComponentFixture<WorkspaceSelectorComponent>): HTMLInputElement[] =>
    Array.from(el(fixture).querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  it('renders only the server-provided workspace names', () => {
    const fixture = setup();
    const labels = Array.from(el(fixture).querySelectorAll('.workspace-selector__option')).map(
      (o) => o.textContent?.trim(),
    );
    expect(labels).toEqual(['Acme Corp', 'Beta Ltd']);
  });

  it('is a labelled radio group usable by keyboard and screen readers', () => {
    const fixture = setup();
    expect(el(fixture).querySelector('fieldset legend')?.textContent?.trim()).toBe(
      'Choose a workspace',
    );
    const inputs = radios(fixture);
    expect(inputs.length).toBe(2);
    inputs.forEach((input) => {
      expect(input.closest('label')).not.toBeNull();
      expect(input.name).toBe('workspace');
    });
  });

  it('keeps Continue disabled until a workspace is selected', () => {
    const fixture = setup();
    expect(continueButton(fixture).disabled).toBe(true);

    radios(fixture)[1].click();
    fixture.detectChanges();

    expect(continueButton(fixture).disabled).toBe(false);
  });

  it('emits the chosen slug on Continue', () => {
    const fixture = setup();
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);

    radios(fixture)[1].click();
    fixture.detectChanges();
    continueButton(fixture).click();

    expect(selected).toHaveBeenCalledExactlyOnceWith('beta');
  });

  it('does not emit while busy', () => {
    const fixture = setup({ busy: true });
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);

    fixture.componentInstance.chosen.set('acme');
    fixture.componentInstance.submit();

    expect(selected).not.toHaveBeenCalled();
    expect(continueButton(fixture).disabled).toBe(true);
  });

  it('emits cancelled from "Use another account"', () => {
    const fixture = setup();
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    (el(fixture).querySelector('.workspace-selector__cancel') as HTMLButtonElement).click();

    expect(cancelled).toHaveBeenCalled();
  });

  it('announces an error', () => {
    const fixture = setup({ error: 'That sign-in has expired. Please sign in again.' });
    expect(el(fixture).querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'That sign-in has expired. Please sign in again.',
    );
  });
});
