import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApprovalDelegatesApiService } from '../../data-access/approval-delegates-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { ApprovalDelegateModalComponent } from './approval-delegate-modal.component';

describe('ApprovalDelegateModalComponent', () => {
  let delegates: Record<string, ReturnType<typeof vi.fn>>;
  let people: { searchPeople: ReturnType<typeof vi.fn> };

  async function render() {
    delegates = {
      list: vi.fn(() => of([{ id: 'd1', delegateEmployeeId: 'e7', delegateName: 'Maya', startDate: '2026-10-20', endDate: '2026-10-24' }])),
      create: vi.fn(() => of({ id: 'd2', delegateEmployeeId: 'e8', delegateName: 'Anu', startDate: '2026-11-01', endDate: '2026-11-05' })),
      remove: vi.fn(() => of(undefined))
    };
    people = { searchPeople: vi.fn(() => of([{ employeeId: 'e8', name: 'Anu', avatarFileId: null }])) };
    TestBed.configureTestingModule({
      imports: [ApprovalDelegateModalComponent],
      providers: [
        { provide: ApprovalDelegatesApiService, useValue: delegates },
        { provide: ConversationsApiService, useValue: people }
      ]
    });
    const fixture = TestBed.createComponent(ApprovalDelegateModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    return { fixture, q };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lists the current covers when opened and removes one', async () => {
    const { fixture, q } = await render();

    expect(q('delegate-row')?.textContent).toContain('Maya');
    (q('delegate-remove-d1') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(delegates['remove']).toHaveBeenCalledWith('d1');
    expect(q('delegate-row')).toBeNull();
  });

  it('saves a cover for the chosen person and dates', async () => {
    const { fixture, q } = await render();
    const component = fixture.componentInstance as unknown as {
      onSearch(text: string): void; pick(id: string, name: string): void; startDate: { set(v: string): void }; endDate: { set(v: string): void };
    };

    component.onSearch('an');
    await fixture.whenStable();
    expect(people.searchPeople).toHaveBeenCalledWith('an');
    component.pick('e8', 'Anu');
    component.startDate.set('2026-11-01');
    component.endDate.set('2026-11-05');
    fixture.detectChanges();
    (q('save-delegate') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(delegates['create']).toHaveBeenCalledWith({ delegateEmployeeId: 'e8', startDate: '2026-11-01', endDate: '2026-11-05' });
    expect(Array.from(document.querySelectorAll('[data-testid="delegate-row"]')).map((r) => r.textContent)).toEqual(
      [expect.stringContaining('Maya'), expect.stringContaining('Anu')]);
  });

  it('cannot save without a person and both dates, and shows a save error', async () => {
    const { fixture, q } = await render();
    expect((q('save-delegate') as HTMLButtonElement).disabled).toBe(true);

    delegates['create'].mockReturnValueOnce(throwError(() => ({ error: { detail: 'Dates overlap another cover.' } })));
    const component = fixture.componentInstance as unknown as { pick(id: string, name: string): void; startDate: { set(v: string): void }; endDate: { set(v: string): void } };
    component.pick('e8', 'Anu');
    component.startDate.set('2026-11-01');
    component.endDate.set('2026-11-05');
    fixture.detectChanges();
    (q('save-delegate') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('delegate-error')?.textContent).toContain('Dates overlap another cover.');
  });
});
