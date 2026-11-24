import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { SelfSetupApiService } from '../data-access/self-setup-api.service';
import { SelfSetupStatusDto } from '../models/self-setup-status.model';

/** "Skip for now" is remembered per company in this browser. */
export const SETUP_GUIDE_SKIPPED_KEY_PREFIX = 'crownus.setup-guide.skipped.';

export type SetupStepKey = 'legal-entity' | 'department' | 'position' | 'add-yourself';
export type SetupStepState = 'done' | 'current' | 'locked';

export interface SetupStep {
  readonly key: SetupStepKey;
  readonly label: string;
  readonly state: SetupStepState;
}

const STEP_LABELS: Readonly<Record<SetupStepKey, string>> = {
  'legal-entity': 'Create your legal entity',
  department: 'Add a department',
  position: 'Add a position',
  'add-yourself': 'Add yourself as an employee',
};

/**
 * The owner's step-by-step company setup (legal entity, department, position, then "Add yourself as an employee"),
 * for a signed-in account that can add employees but has no employee profile yet. The floating guide and the
 * My Work panel share this state.
 */
@Injectable({ providedIn: 'root' })
export class OwnerSetupGuideService {
  private readonly api = inject(SelfSetupApiService);
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(PermissionService);

  readonly status = signal<SelfSetupStatusDto | null>(null);
  /** Set after the owner adds themselves: the guide shows "You're all set" until it is closed. */
  readonly finished = signal(false);
  /** This page load's Skip/Resume choice; storage only carries it to the next visit. */
  private readonly skipChoice = signal<boolean | null>(null);

  readonly eligible = computed(
    () =>
      this.auth.authenticated() &&
      this.auth.employeeId() === null &&
      this.permissions.hasPermission('employees:write'),
  );

  readonly skipped = computed(() => this.skipChoice() ?? readFlag(this.skipKey()));

  readonly steps = computed<readonly SetupStep[]>(() => {
    const status = this.status();
    const hasPosition = status?.has_position ?? false;
    const done: Record<SetupStepKey, boolean> = {
      'legal-entity': status?.has_legal_entity ?? false,
      // A position always sits in a department, so one existing proves this step (and covers a server that
      // does not report has_department yet).
      department: (status?.has_department ?? false) || hasPosition,
      position: hasPosition,
      'add-yourself': status?.has_employee_profile ?? false,
    };
    // The server's own check decides when "Add yourself" opens, so the guide never locks what finalize allows.
    const canAddSelf = status?.can_add_self ?? false;
    let currentTaken = false;
    return (Object.keys(STEP_LABELS) as SetupStepKey[]).map((key) => {
      let state: SetupStepState = 'locked';
      if (done[key]) state = 'done';
      else if (key === 'add-yourself' && canAddSelf) {
        state = 'current';
        currentTaken = true;
      } else if (!currentTaken && key !== 'add-yourself') {
        state = 'current';
        currentTaken = true;
      }
      return { key, label: STEP_LABELS[key], state };
    });
  });

  readonly doneCount = computed(() => this.steps().filter((step) => step.state === 'done').length);

  /** Incomplete setup the owner has not skipped, or the one-time "You're all set". */
  readonly visible = computed(() => {
    if (this.finished()) return true;
    const status = this.status();
    return this.eligible() && status !== null && !status.has_employee_profile && !this.skipped();
  });

  /** Re-reads the setup status. Does nothing for accounts the guide is not for. */
  async refresh(): Promise<void> {
    if (!this.eligible()) return;
    try {
      this.status.set(await firstValueFrom(this.api.getStatus()));
    } catch {
      this.status.set(null);
    }
  }

  skip(): void {
    writeFlag(this.skipKey(), true);
    this.skipChoice.set(true);
  }

  resume(): void {
    writeFlag(this.skipKey(), false);
    this.skipChoice.set(false);
  }

  markFinished(): void {
    this.finished.set(true);
  }

  dismissFinished(): void {
    this.finished.set(false);
    this.status.set(null);
  }

  private skipKey(): string {
    return `${SETUP_GUIDE_SKIPPED_KEY_PREFIX}${this.auth.workspaceSlug() ?? 'default'}`;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked: skipping still works for this page load.
  }
}
