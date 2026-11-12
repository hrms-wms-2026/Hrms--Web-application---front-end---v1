import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

export type HeroModuleId = 'home' | 'org' | 'work' | 'settings';
export type HeroOrgViewMode = 'tree' | 'list';

export interface HeroApprovalItem {
  key: string;
  initials: string;
  avatarBg: string;
  badgeType: 'leave' | 'attendance' | 'overdue';
  title: string;
  subject: string;
  age: string;
}

export interface HeroDeptNode {
  id: string;
  name: string;
  code: string;
  parentName: string;
  headPosition: string;
  positions: number;
  employees: number;
  level: number;
  expandable?: boolean;
  parentId?: string;
}

export interface HeroMonitoringFlags {
  workLocationVerification: boolean;
  activityMonitoring: boolean;
  applicationTracking: boolean;
  screenshotCapture: boolean;
}

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-hero.component.html',
  styleUrl: './landing-hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingHeroComponent {
  /** Active module in the interactive ClickUp-style CROWNUS system preview. */
  readonly activeModule = signal<HeroModuleId>('home');

  /** Dashboard interactive states. */
  readonly isCustomizing = signal(false);
  readonly onBreak = signal(false);
  readonly actionFilter = signal<'all' | 'leave' | 'attendance'>('all');
  readonly approvals = signal<HeroApprovalItem[]>([
    {
      key: 'lv-1',
      initials: 'SM',
      avatarBg: '#2563eb',
      badgeType: 'leave',
      title: 'Annual leave · 3 days (Nov 18 – Nov 20)',
      subject: 'Sarah Miller · Product Design',
      age: '18m ago'
    },
    {
      key: 'at-1',
      initials: 'DK',
      avatarBg: '#059669',
      badgeType: 'attendance',
      title: 'Clock-in adjustment · 08:55 AM',
      subject: 'David Kim · Platform Reliability',
      age: '1h ago'
    },
    {
      key: 'lv-2',
      initials: 'ER',
      avatarBg: '#7c3aed',
      badgeType: 'leave',
      title: 'Remote work request · Friday shift',
      subject: 'Elena Rostova · Operations & Delivery',
      age: '3h ago'
    }
  ]);

  readonly filteredApprovals = computed(() => {
    const f = this.actionFilter();
    const list = this.approvals();
    if (f === 'all') return list;
    return list.filter((item) => item.badgeType === f);
  });

  /** Organization > Departments interactive states. */
  readonly orgViewMode = signal<HeroOrgViewMode>('tree');
  readonly expandedDepts = signal<Record<string, boolean>>({
    ops: true,
    hr: true
  });

  readonly departments: readonly HeroDeptNode[] = [
    {
      id: 'ops',
      name: 'Operations & Delivery',
      code: 'OPS',
      parentName: '—',
      headPosition: 'VP of Operations',
      positions: 7,
      employees: 34,
      level: 0,
      expandable: true
    },
    {
      id: 'ops-sre',
      name: 'Platform Reliability & Cloud',
      code: 'OPS-SRE',
      parentName: 'Operations & Delivery',
      headPosition: 'Principal Reliability Lead',
      positions: 4,
      employees: 16,
      level: 1,
      parentId: 'ops'
    },
    {
      id: 'hr',
      name: 'Human Resources',
      code: 'HR',
      parentName: '—',
      headPosition: 'People & Culture Director',
      positions: 4,
      employees: 12,
      level: 0,
      expandable: true
    },
    {
      id: 'hr-ta',
      name: 'Talent Acquisition & Onboarding',
      code: 'HR-TA',
      parentName: 'Human Resources',
      headPosition: 'Talent Lead',
      positions: 2,
      employees: 6,
      level: 1,
      parentId: 'hr'
    },
    {
      id: 'fin',
      name: 'Finance & Legal',
      code: 'FIN',
      parentName: '—',
      headPosition: 'Group Financial Controller',
      positions: 5,
      employees: 18,
      level: 0
    },
    {
      id: 'cs',
      name: 'Customer Support',
      code: 'CS',
      parentName: '—',
      headPosition: 'Head of Enterprise CS',
      positions: 3,
      employees: 16,
      level: 0
    }
  ];

  readonly visibleDepartments = computed(() => {
    const expanded = this.expandedDepts();
    return this.departments.filter((d) => !d.parentId || expanded[d.parentId]);
  });

  /** Settings > Monitoring interactive states. */
  readonly monitoringFlags = signal<HeroMonitoringFlags>({
    workLocationVerification: true,
    activityMonitoring: true,
    applicationTracking: true,
    screenshotCapture: false
  });

  selectModule(mod: HeroModuleId): void {
    this.activeModule.set(mod);
    if (mod !== 'home') {
      this.isCustomizing.set(false);
    }
  }

  toggleCustomize(): void {
    this.isCustomizing.update((v) => !v);
  }

  toggleBreak(): void {
    this.onBreak.update((v) => !v);
  }

  setActionFilter(filter: 'all' | 'leave' | 'attendance'): void {
    this.actionFilter.set(filter);
  }

  resolveApproval(key: string): void {
    this.approvals.update((items) => items.filter((i) => i.key !== key));
  }

  setOrgViewMode(mode: HeroOrgViewMode): void {
    this.orgViewMode.set(mode);
  }

  toggleDeptExpand(id: string): void {
    this.expandedDepts.update((curr) => ({ ...curr, [id]: !curr[id] }));
  }

  toggleMonitoringFlag(key: keyof HeroMonitoringFlags): void {
    this.monitoringFlags.update((curr) => ({ ...curr, [key]: !curr[key] }));
  }
}
