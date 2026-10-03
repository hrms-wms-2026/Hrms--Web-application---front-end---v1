import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnsavedChangesService, UnsavedPrompt } from '../../services/unsaved-changes.service';
import { UnsavedChangesDialogComponent } from './unsaved-changes-dialog.component';

describe('UnsavedChangesDialogComponent', () => {
  let fixture: ComponentFixture<UnsavedChangesDialogComponent>;
  const prompt = signal<UnsavedPrompt | null>(null);
  const choose = vi.fn();

  const el = () => fixture.nativeElement as HTMLElement;
  const click = (testId: string) =>
    (el().querySelector(`[data-testid="${testId}"] button`) as HTMLButtonElement).click();

  beforeEach(() => {
    choose.mockClear();
    prompt.set(null);
    TestBed.configureTestingModule({
      imports: [UnsavedChangesDialogComponent],
      providers: [{ provide: UnsavedChangesService, useValue: { prompt, choose } }]
    });
    fixture = TestBed.createComponent(UnsavedChangesDialogComponent);
    fixture.detectChanges();
  });

  it('renders nothing when there is no prompt', () => {
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('offers Save draft / Discard / Keep editing when a draft can be saved', () => {
    prompt.set({ canSaveDraft: true, saving: false, error: null });
    fixture.detectChanges();
    expect(el().textContent).toContain('Save draft?');
    expect(el().textContent).toContain('Would you like to save a draft? You can reopen it from the drafts bar at the bottom of the screen.');
    expect(el().querySelector('[data-testid="unsaved-discard"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="unsaved-keep"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="unsaved-save"]')).not.toBeNull();
  });

  it('shows a plain discard confirmation without Save draft when drafts are not supported', () => {
    prompt.set({ canSaveDraft: false, saving: false, error: null });
    fixture.detectChanges();
    expect(el().textContent).toContain('Discard changes?');
    expect(el().querySelector('[data-testid="unsaved-save"]')).toBeNull();
  });

  it('forwards each button to service.choose', () => {
    prompt.set({ canSaveDraft: true, saving: false, error: null });
    fixture.detectChanges();
    click('unsaved-discard');
    click('unsaved-keep');
    click('unsaved-save');
    expect(choose.mock.calls.map((c) => c[0])).toEqual(['discard', 'keep', 'save']);
  });

  it('shows the save error in an alert', () => {
    prompt.set({ canSaveDraft: true, saving: false, error: 'Could not save the draft. Try again or discard your changes.' });
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Could not save the draft.');
  });
});
