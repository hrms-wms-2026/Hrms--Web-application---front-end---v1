import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SprintHistoryComponent } from './sprint-history.component';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('SprintHistoryComponent', () => {
  it('renders newest first with employee names and task counts', async () => {
    const api = { getActivity: vi.fn().mockReturnValue(of([
      { id: '1', employeeId: 'e1', action: 'created', fromStatus: null, toStatus: 'draft', detailsJson: null, occurredAt: '2026-09-23T10:00:00Z' },
      { id: '2', employeeId: 'e2', action: 'tasks_added', fromStatus: null, toStatus: null, detailsJson: '{"taskIds":["a","b"]}', occurredAt: '2026-09-23T11:00:00Z' }
    ])) };
    const directory = { ensureLoaded: vi.fn().mockResolvedValue(undefined), get: (id: string) => ({ id, name: id === 'e1' ? 'Ravi' : 'Priya' }) };
    TestBed.configureTestingModule({ imports: [SprintHistoryComponent], providers: [
      { provide: SprintApiService, useValue: api }, { provide: EmployeeDirectoryStore, useValue: directory }] });
    const fixture = TestBed.createComponent(SprintHistoryComponent);
    fixture.componentRef.setInput('sprintId', 'sp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.componentInstance as any).expanded.set(true);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="sprint-history-row"]');
    expect(rows[0].textContent).toContain('Priya added 2 task(s)');
    expect(rows[1].textContent).toContain('Ravi created the sprint');
  });
});
