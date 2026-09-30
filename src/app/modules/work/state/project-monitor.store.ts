import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectMonitorApiService } from '../data-access/project-monitor-api.service';
import { MonitorAlertDto } from '../models/dto/monitor.dto';

const NO_ALERTS: readonly MonitorAlertDto[] = [];

/** Open project-monitor alerts of the project shown in the Tree tab, indexed by module/sprint/task id. */
@Injectable({ providedIn: 'root' })
export class ProjectMonitorStore {
  private readonly api = inject(ProjectMonitorApiService);
  private loadVersion = 0;

  readonly alerts = signal<readonly MonitorAlertDto[]>([]);
  /** Actionable alerts only - those on achieved modules are shown faded but never counted. */
  readonly count = computed(() => this.alerts().filter((alert) => !alert.inAchievedModule).length);
  private readonly byTarget = computed(() => {
    const map = new Map<string, MonitorAlertDto[]>();
    for (const alert of this.alerts()) {
      const list = map.get(alert.targetId);
      if (list) list.push(alert); else map.set(alert.targetId, [alert]);
    }
    return map;
  });

  alertsFor(targetId: string): readonly MonitorAlertDto[] {
    return this.byTarget().get(targetId) ?? NO_ALERTS;
  }

  /** Re-checks the project and loads its open alerts, so a save shows its red mark straight away
   *  (the hourly monitor is only a fallback). If the re-check fails, falls back to the stored alerts;
   *  if that fails too the tree is just left unmarked - alerts are advisory. */
  async load(projectId: string): Promise<void> {
    const version = ++this.loadVersion;
    if (!projectId) {
      this.alerts.set([]);
      return;
    }
    try {
      const alerts = await firstValueFrom(this.api.refreshAlerts(projectId))
        .catch(() => firstValueFrom(this.api.listAlerts(projectId)));
      if (version === this.loadVersion) this.alerts.set(alerts ?? []);
    } catch {
      if (version === this.loadVersion) this.alerts.set([]);
    }
  }
}
