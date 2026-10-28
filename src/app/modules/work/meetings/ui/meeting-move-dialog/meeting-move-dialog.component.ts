import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { ProjectApiService } from '../../../data-access/project-api.service';

export interface MeetingMoveChoice { scope: 'this' | 'following'; projectId: string; objectiveId: string; }

/** Move a meeting to another module (D9, D20: forward-only). The destination's create rule applies server-side. */
@Component({
  selector: 'app-meeting-move-dialog',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="true" title="Move meeting" size="md" (closed)="cancelled.emit()">
      <div class="flex flex-col gap-3 text-sm">
        <label class="flex flex-col gap-1">Project
          <select data-testid="meeting-move-project" (change)="selectProject($any($event.target).value)">
            <option value="">Choose a project</option>
            @for (p of projects(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
          </select>
        </label>
        @if (projectId()) {
          <label class="flex flex-col gap-1">Module
            <select data-testid="meeting-move-module" (change)="objectiveId.set($any($event.target).value || null)">
              <option value="">Choose a module</option>
              @for (m of modules(); track m.id) { <option [value]="m.id">{{ m.title }}</option> }
            </select>
          </label>
        }
        @if (scopes().length > 1) {
          <label class="flex flex-col gap-1">Which occurrences
            <select (change)="scope.set($any($event.target).value)">
              <option value="this">This occurrence</option>
              <option value="following">This and following</option>
            </select>
          </label>
        }
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1" (click)="cancelled.emit()">Cancel</button>
          <button type="button" data-testid="meeting-move-confirm" class="rounded-md bg-[var(--color-accent)] px-3 py-1 text-[var(--color-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
            [disabled]="!projectId() || !objectiveId()" (click)="confirm()">Move</button>
        </div>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingMoveDialogComponent implements OnInit {
  private readonly projectApi = inject(ProjectApiService);

  readonly recurring = input(false);
  readonly currentObjectiveId = input<string | null>(null);
  readonly chosen = output<MeetingMoveChoice>();
  readonly cancelled = output<void>();

  readonly projects = signal<readonly { id: string; name: string }[]>([]);
  readonly modules = signal<readonly { id: string; title: string }[]>([]);
  readonly projectId = signal<string | null>(null);
  readonly objectiveId = signal<string | null>(null);
  readonly scope = signal<'this' | 'following'>('this');
  readonly scopes = computed<readonly ('this' | 'following')[]>(() => (this.recurring() ? ['this', 'following'] : ['this']));

  ngOnInit(): void {
    void firstValueFrom(this.projectApi.listMine(1, 100))
      .then((page) => this.projects.set(page.items.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => this.projects.set([]));
  }

  async selectProject(projectId: string): Promise<void> {
    this.projectId.set(projectId || null);
    this.objectiveId.set(null);
    this.modules.set([]);
    if (!projectId) return;
    try {
      const tree = await firstValueFrom(this.projectApi.getProjectTree(projectId));
      this.modules.set(tree.filter((o) => o.id !== this.currentObjectiveId()).map((o) => ({ id: o.id, title: o.title })));
    } catch {
      this.modules.set([]);
    }
  }

  confirm(): void {
    const projectId = this.projectId();
    const objectiveId = this.objectiveId();
    if (projectId && objectiveId) this.chosen.emit({ scope: this.scope(), projectId, objectiveId });
  }
}
