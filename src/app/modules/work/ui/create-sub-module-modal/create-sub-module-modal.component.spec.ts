import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateSubModuleModalComponent } from './create-sub-module-modal.component';

describe('CreateSubModuleModalComponent', () => {
  let fixture: ComponentFixture<CreateSubModuleModalComponent>;

  function setup(overrides: Partial<{ open: boolean; parentObjectiveId: string; submitting: boolean; errorMessage: string }> = {}): void {
    fixture = TestBed.createComponent(CreateSubModuleModalComponent);
    fixture.componentRef.setInput('open', overrides.open ?? true);
    fixture.componentRef.setInput('parentObjectiveId', overrides.parentObjectiveId ?? 'o1');
    fixture.componentRef.setInput('submitting', overrides.submitting ?? false);
    fixture.componentRef.setInput('errorMessage', overrides.errorMessage ?? '');
    fixture.detectChanges();
  }

  function setFieldValue(testId: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"] input`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('requires title, start date, and end date before submitting', () => {
    setup();
    let emitted = false;
    fixture.componentInstance.created.subscribe(() => (emitted = true));

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });

  it('rejects an end date before the start date', () => {
    setup();
    setFieldValue('title-field', 'Design Phase');
    setFieldValue('start-date-field', '2026-03-01');
    setFieldValue('end-date-field', '2026-01-01');

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('End date cannot be before the start date.');
  });

  it('emits created with the entered fields and the parentObjectiveId input on valid submit', () => {
    setup({ parentObjectiveId: 'o1' });
    let payload: any;
    fixture.componentInstance.created.subscribe((p) => (payload = p));

    setFieldValue('title-field', 'Design Phase');
    setFieldValue('start-date-field', '2026-01-15');
    setFieldValue('end-date-field', '2026-03-01');
    setFieldValue('allocated-hours-field', '20');

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(payload).toEqual({
      parentObjectiveId: 'o1', title: 'Design Phase', description: null,
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    });
  });

  it('emits closed when cancel is clicked', () => {
    setup();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));

    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();

    expect(closed).toBe(true);
  });

  it('renders the server error message when present', () => {
    setup({ errorMessage: 'date range exceeds parent' });
    expect(fixture.nativeElement.textContent).toContain('date range exceeds parent');
  });
});
