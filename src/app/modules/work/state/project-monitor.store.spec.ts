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
  let refreshAlerts: ReturnType<typeof vi.fn>;
  let listAlerts: ReturnType<typeof vi.fn>;
  let store: ProjectMonitorStore;

  beforeEach(() => {
    refreshAlerts = vi.fn();
    listAlerts = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ProjectMonitorApiService, useValue: { refreshAlerts, listAlerts } }] });
    store = TestBed.inject(ProjectMonitorStore);
  });

  it('re-checks the project so a just-saved problem is marked at once, and indexes alerts by target', async () => {
    refreshAlerts.mockReturnValue(of([alert('a1', 'm1'), alert('a2', 'm1'), alert('a3', 't1')]));

    await store.load('p1');

    expect(refreshAlerts).toHaveBeenCalledWith('p1');
    expect(listAlerts).not.toHaveBeenCalled();
    expect(store.count()).toBe(3);
    expect(store.alertsFor('m1').map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(store.alertsFor('unknown')).toEqual([]);
  });

  it('does not count alerts on achieved modules, but still indexes them for the faded mark', async () => {
    refreshAlerts.mockReturnValue(of([alert('a1', 'm1'), { ...alert('a2', 'm2'), inAchievedModule: true }]));

    await store.load('p1');

    expect(store.count()).toBe(1);
    expect(store.alertsFor('m2').map((a) => a.id)).toEqual(['a2']);
  });

  it('falls back to the stored alerts when the re-check fails', async () => {
    refreshAlerts.mockReturnValue(throwError(() => new Error('busy')));
    listAlerts.mockReturnValue(of([alert('a1', 'm1')]));

    await store.load('p1');

    expect(listAlerts).toHaveBeenCalledWith('p1');
    expect(store.count()).toBe(1);
  });

  it('shows no alerts when both calls fail', async () => {
    refreshAlerts.mockReturnValue(of([alert('a1', 'm1')]));
    await store.load('p1');
    refreshAlerts.mockReturnValue(throwError(() => new Error('offline')));
    listAlerts.mockReturnValue(throwError(() => new Error('offline')));

    await store.load('p1');

    expect(store.count()).toBe(0);
  });
});
