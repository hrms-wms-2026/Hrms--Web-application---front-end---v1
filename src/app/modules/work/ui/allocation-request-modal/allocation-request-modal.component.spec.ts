import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { AllocationRequestModalComponent } from './allocation-request-modal.component';

describe('AllocationRequestModalComponent', () => {
  let api: { createAllocationRequest: ReturnType<typeof vi.fn> };

  function render() {
    api = { createAllocationRequest: vi.fn(() => of(null)) };
    TestBed.configureTestingModule({
      imports: [AllocationRequestModalComponent],
      providers: [{ provide: WorkApprovalsApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(AllocationRequestModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('moduleId', 'm1');
    fixture.componentRef.setInput('moduleTitle', 'Payments');
    fixture.detectChanges();
    return fixture;
  }

  it('validates hours and reason before sending', async () => {
    const fixture = render();
    const c = fixture.componentInstance as unknown as { hours: { set(v: string): void }; reason: { set(v: string): void }; submit(): Promise<void>; errors(): Record<string, string> };

    c.hours.set('0');
    await c.submit();

    expect(c.errors()).toEqual({ hours: 'Hours must be greater than zero.', reason: 'Reason is required.' });
    expect(api.createAllocationRequest).not.toHaveBeenCalled();
  });

  it('sends the request for the module and reports it', async () => {
    const fixture = render();
    const c = fixture.componentInstance as unknown as { hours: { set(v: string): void }; reason: { set(v: string): void }; submit(): Promise<void> };
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);

    c.hours.set('12');
    c.reason.set('  scope grew  ');
    await c.submit();

    expect(api.createAllocationRequest).toHaveBeenCalledWith('m1', { requestedAdditionalHours: 12, reason: 'scope grew' });
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('shows the server error', async () => {
    const fixture = render();
    api.createAllocationRequest.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Module is achieved.' } })));
    const c = fixture.componentInstance as unknown as { hours: { set(v: string): void }; reason: { set(v: string): void }; submit(): Promise<void>; error(): string | null };

    c.hours.set('5');
    c.reason.set('more');
    await c.submit();

    expect(c.error()).toBe('Module is achieved.');
  });
});
