import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProjectMonitorApiService } from '../data-access/project-monitor-api.service';
import { MonitorAlertDto } from '../models/dto/monitor.dto';
import { ProjectMonitorStore } from './project-monitor.store';

function alert(id: string, targetId: string): MonitorAlertDto {
  return {
    id, targetType: 'module', targetId, targetTitle: 'Payments', ruleCode: 'module_over_capacity',
    subjectEmployeeId: null, message: `message ${id}`, firstDetectedAt: '2026-10-05T09:00:00Z'
  };
}

describe('ProjectMonitorStore', () => {
  let listAlerts: ReturnType<typeof vi.fn>;
  let store: ProjectMonitorStore;

  beforeEach(() => {
    listAlerts = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ProjectMonitorApiService, useValue: { listAlerts } }] });
    store = TestBed.inject(ProjectMonitorStore);
  });

  it('loads alerts and indexes them by target', async () => {
    listAlerts.mockReturnValue(of([alert('a1', 'm1'), alert('a2', 'm1'), alert('a3', 't1')]));

    await store.load('p1');

    expect(listAlerts).toHaveBeenCalledWith('p1');
    expect(store.count()).toBe(3);
    expect(store.alertsFor('m1').map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(store.alertsFor('unknown')).toEqual([]);
  });

  it('shows no alerts when loading fails', async () => {
    listAlerts.mockReturnValue(of([alert('a1', 'm1')]));
    await store.load('p1');
    listAlerts.mockReturnValue(throwError(() => new Error('offline')));

    await store.load('p1');

    expect(store.count()).toBe(0);
  });
});
