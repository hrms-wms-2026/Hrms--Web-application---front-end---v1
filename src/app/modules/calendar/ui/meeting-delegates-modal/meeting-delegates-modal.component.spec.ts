import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ConversationsApiService } from '../../../inbox/data-access/conversations-api.service';
import { MeetingApiService } from '../../../work/meetings/data-access/meeting-api.service';
import { MeetingDelegatesModalComponent } from './meeting-delegates-modal.component';

describe('MeetingDelegatesModalComponent', () => {
  let meetings: Record<string, ReturnType<typeof vi.fn>>;
  let people: { searchPeople: ReturnType<typeof vi.fn> };

  async function render() {
    meetings = {
      listDelegates: vi.fn(() => of([
        { id: 'd1', employeeId: 'e7', name: 'Sara Fernando', createdAt: '2026-11-01T00:00:00Z', expiresAt: null, state: 'active', canPlanTasks: true },
        { id: 'd2', employeeId: 'e9', name: 'Kavin Raj', createdAt: '2026-10-01T00:00:00Z', expiresAt: '2026-11-01T00:00:00Z', state: 'expired' },
      ])),
      addDelegate: vi.fn(() => of({ id: 'd3', employeeId: 'e8', name: 'Anu', createdAt: '2026-11-10T00:00:00Z', expiresAt: null, state: 'active' })),
      revokeDelegate: vi.fn(() => of(undefined)),
      updateDelegate: vi.fn((id: string, canPlanTasks: boolean) => of({
        id, employeeId: 'e7', name: 'Sara Fernando', createdAt: '2026-11-01T00:00:00Z', expiresAt: null, state: 'active', canPlanTasks,
      })),
    };
    people = { searchPeople: vi.fn(() => of([{ employeeId: 'e8', name: 'Anu', avatarFileId: null }])) };
    TestBed.configureTestingModule({
      imports: [MeetingDelegatesModalComponent],
      providers: [
        { provide: MeetingApiService, useValue: meetings },
        { provide: ConversationsApiService, useValue: people },
      ],
    });
    const fixture = TestBed.createComponent(MeetingDelegatesModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const rows = () => Array.from(document.querySelectorAll('[data-testid="meeting-delegate-row"]')).map((r) => r.textContent ?? '');
    const component = fixture.componentInstance as unknown as {
      onSearch(text: string): Promise<void>; pick(id: string, name: string): void; until: { set(v: string): void };
    };
    return { fixture, q, rows, component };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lists my delegates with Active or Expired', async () => {
    const { rows } = await render();

    expect(rows()).toEqual([expect.stringContaining('Sara Fernando'), expect.stringContaining('Kavin Raj')]);
    expect(rows()[0]).toContain('Active');
    expect(rows()[1]).toContain('Expired');
  });

  it('adds the picked person without an Until date', async () => {
    const { fixture, q, rows, component } = await render();

    await component.onSearch('an');
    expect(people.searchPeople).toHaveBeenCalledWith('an');
    component.pick('e8', 'Anu');
    fixture.detectChanges();
    (q('save-meeting-delegate') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(meetings['addDelegate']).toHaveBeenCalledWith('e8', undefined, false);
    expect(rows()).toEqual(expect.arrayContaining([expect.stringContaining('Anu')]));
  });

  it('adds the picked person with an Until date, ending that day', async () => {
    const { fixture, q, component } = await render();

    component.pick('e8', 'Anu');
    component.until.set('2026-12-01');
    fixture.detectChanges();
    (q('save-meeting-delegate') as HTMLButtonElement).click();
    await fixture.whenStable();

    const [, expiresAt] = meetings['addDelegate'].mock.calls[0] as [string, string];
    expect(new Date(expiresAt).getTime()).toBe(new Date('2026-12-01T23:59:59').getTime());
  });

  it('removes one', async () => {
    const { fixture, q, rows } = await render();

    (q('meeting-delegate-remove-d1') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(meetings['revokeDelegate']).toHaveBeenCalledWith('d1');
    expect(rows()).toEqual([expect.stringContaining('Kavin Raj')]);
  });

  it('shows the server error for self, duplicate and a past date', async () => {
    const { fixture, q, component } = await render();
    meetings['addDelegate'].mockReturnValue(throwError(() => ({ error: { detail: 'Anu is already your meeting delegate.' } })));

    component.pick('e8', 'Anu');
    fixture.detectChanges();
    (q('save-meeting-delegate') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('meeting-delegate-error')?.textContent).toContain('already your meeting delegate');
  });

  // Delegate task planning (2026-11-11): "Can also plan my tasks", per delegate.

  it('adds with Can also plan my tasks ticked', async () => {
    const { fixture, q, component } = await render();

    component.pick('e8', 'Anu');
    fixture.detectChanges();
    (q('meeting-delegate-plan-tasks') as HTMLInputElement).click();
    fixture.detectChanges();
    (q('save-meeting-delegate') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(meetings['addDelegate']).toHaveBeenCalledWith('e8', undefined, true);
  });

  it('a row shows Meetings or Meetings · Tasks', async () => {
    const { rows } = await render();

    expect(rows()[0]).toContain('Meetings · Tasks');
    expect(rows()[1]).toContain('Meetings');
    expect(rows()[1]).not.toContain('Tasks');
  });

  it('the row switch updates it', async () => {
    const { fixture, q, rows } = await render();

    (q('meeting-delegate-tasks-d1') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(meetings['updateDelegate']).toHaveBeenCalledWith('d1', false);
    expect(rows()[0]).not.toContain('Tasks');
    expect(q('meeting-delegate-tasks-d1')?.getAttribute('aria-checked')).toBe('false');
  });

  it('a failed switch shows the server error and keeps the old value', async () => {
    const { fixture, q, rows } = await render();
    meetings['updateDelegate'].mockReturnValue(throwError(() => ({ error: { detail: 'That delegate was not found.' } })));

    (q('meeting-delegate-tasks-d1') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('meeting-delegate-error')?.textContent).toContain('That delegate was not found.');
    expect(rows()[0]).toContain('Meetings · Tasks');
  });
});
