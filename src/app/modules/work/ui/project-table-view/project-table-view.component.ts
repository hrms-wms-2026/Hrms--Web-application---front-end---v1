import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Project } from '../../models/project.model';
import { ProjectCategory } from '../../models/project-category.model';
import { getDeadlineStatus, DeadlineStatus } from '../../utils/deadline.util';
import { AvatarStackComponent } from '../../../../shared/ui/avatar-stack/avatar-stack.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { FileApiService } from '../../../../shared/data-access/file-api.service';

type SortField = 'name' | 'targetDate' | 'progress' | 'hours';
type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-project-table-view',
  standalone: true,
  imports: [
    AvatarStackComponent,
    ProgressBarComponent,
    PopoverComponent
  ],
  template: `
    <div class="project-table-container rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="project-table w-full text-left border-collapse" data-testid="projects-table">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <!-- Name & Identifier (Sortable) -->
              <th scope="col" class="py-3 px-4 select-none cursor-pointer hover:text-[var(--color-text-primary)]" (click)="toggleSort('name')">
                <div class="inline-flex items-center gap-1.5">
                  <span>Name</span>
                  @if (sortField() === 'name') {
                    <svg class="h-3 w-3 transition-transform" [class.rotate-180]="sortOrder() === 'desc'" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  }
                </div>
              </th>

              <!-- Category -->
              <th scope="col" class="py-3 px-4">Category</th>

              <!-- Timeline / Target Date (Sortable) -->
              <th scope="col" class="py-3 px-4 select-none cursor-pointer hover:text-[var(--color-text-primary)]" (click)="toggleSort('targetDate')">
                <div class="inline-flex items-center gap-1.5">
                  <span>Timeline</span>
                  @if (sortField() === 'targetDate') {
                    <svg class="h-3 w-3 transition-transform" [class.rotate-180]="sortOrder() === 'desc'" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  }
                </div>
              </th>

              <!-- Progress (Sortable) -->
              <th scope="col" class="py-3 px-4 select-none cursor-pointer hover:text-[var(--color-text-primary)] min-w-[150px]" (click)="toggleSort('progress')">
                <div class="inline-flex items-center gap-1.5">
                  <span>Progress</span>
                  @if (sortField() === 'progress') {
                    <svg class="h-3 w-3 transition-transform" [class.rotate-180]="sortOrder() === 'desc'" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  }
                </div>
              </th>

              <!-- Lead / Owner -->
              <th scope="col" class="py-3 px-4">Owner</th>

              <!-- Team -->
              <th scope="col" class="py-3 px-4">Team</th>

              <!-- Status -->
              <th scope="col" class="py-3 px-4">Status</th>

              <!-- Actions -->
              <th scope="col" class="py-3 px-4 text-right w-12"></th>
            </tr>
          </thead>

          <tbody class="divide-y divide-[var(--color-border)] text-sm">
            @for (project of sortedProjects(); track project.id) {
              <tr
                class="project-table-row group transition-colors duration-100 hover:bg-[var(--color-surface-secondary)]/50 cursor-pointer"
                (click)="onRowClick(project)"
                data-testid="project-table-row"
              >
                <!-- Name & Identifier Column -->
                <td class="py-3.5 px-4 min-w-[240px]">
                  <div class="flex items-center gap-3">
                    <!-- Project Color Badge -->
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-white text-xs shadow-xs"
                      [style.background]="project.color || 'linear-gradient(135deg, #2563eb, #4f46e5)'"
                    >
                      {{ projectLogoInitial(project) }}
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
                          {{ project.name }}
                        </span>
                        <span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                          {{ project.identifier }}
                        </span>
                      </div>
                      @if (project.description) {
                        <p class="text-xs text-[var(--color-text-secondary)] truncate max-w-xs mt-0.5">
                          {{ project.description }}
                        </p>
                      }
                    </div>
                  </div>
                </td>

                <!-- Category Column -->
                <td class="py-3.5 px-4 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                  <span class="inline-flex items-center rounded-md px-2 py-0.5 font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                    {{ getCategoryName(project.categoryId) }}
                  </span>
                </td>

                <!-- Timeline / Target Date Column -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-medium text-[var(--color-text-primary)]">
                      {{ project.targetDate || '—' }}
                    </span>
                    @if (getDeadline(project.targetDate); as deadline) {
                      <span
                        class="inline-flex items-center text-[10px] font-semibold w-fit px-1.5 py-0.25 rounded-md"
                        [class]="deadline.overdue
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'text-[var(--color-text-secondary)]'"
                      >
                        {{ deadline.label }}
                      </span>
                    }
                  </div>
                </td>

                <!-- Progress Column -->
                <td class="py-3.5 px-4 min-w-[150px]">
                  <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-semibold text-[var(--color-text-primary)]">{{ calculateProgress(project) }}%</span>
                      <span class="text-[11px] text-[var(--color-text-secondary)] font-mono">
                        {{ project.completedHours }}h / {{ project.allocatedHours }}h
                      </span>
                    </div>
                    <app-progress-bar [progress]="calculateProgress(project)" />
                  </div>
                </td>

                <!-- Lead / Owner Column -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <div class="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      {{ project.isLead ? 'YOU' : 'LD' }}
                    </div>
                    <span class="text-xs font-medium text-[var(--color-text-primary)]">
                      {{ project.isLead ? 'You (Lead)' : 'Assigned Lead' }}
                    </span>
                  </div>
                </td>

                <!-- Team Column -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  @if (project.members.length > 0) {
                    <app-avatar-stack
                      [members]="avatarStackMembersFor(project)"
                      [totalCount]="project.memberCount"
                      [maxVisible]="3"
                      size="sm"
                    />
                  } @else {
                    <span class="text-xs text-[var(--color-text-secondary)]">—</span>
                  }
                </td>

                <!-- Status Column -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    [class]="project.isAchieved
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      [class]="project.isAchieved ? 'bg-purple-500' : 'bg-emerald-500'"
                    ></span>
                    {{ project.isAchieved ? 'Archived' : 'Active' }}
                  </span>
                </td>

                <!-- Actions Column -->
                <td class="py-3.5 px-4 text-right whitespace-nowrap" (click)="$event.stopPropagation()">
                  <app-popover [open]="openMenuProjectId() === project.id" align="right" (closed)="openMenuProjectId.set(null)">
                    <button
                      popover-trigger
                      type="button"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      aria-label="Project actions"
                      (click)="toggleMenu(project.id)"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                    <div popover-panel class="flex flex-col py-1 min-w-[160px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg">
                      <button
                        type="button"
                        class="flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] cursor-pointer"
                        (click)="onOpenView(project)"
                      >
                        <svg class="h-3.5 w-3.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        <span>Open project</span>
                      </button>

                      @if (project.isLead) {
                        <button
                          type="button"
                          class="flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] cursor-pointer"
                          (click)="onOpenSettings(project)"
                        >
                          <svg class="h-3.5 w-3.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          <span>Settings</span>
                        </button>

                        <button
                          type="button"
                          class="flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] cursor-pointer"
                          (click)="onOpenMembers(project)"
                        >
                          <svg class="h-3.5 w-3.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span>Members</span>
                        </button>

                        <button
                          type="button"
                          class="flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] cursor-pointer"
                          (click)="onToggleAchieve(project)"
                        >
                          <svg class="h-3.5 w-3.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                          <span>{{ project.isAchieved ? 'Restore' : 'Archive' }}</span>
                        </button>

                        <div class="my-1 border-t border-[var(--color-border)]"></div>

                        <button
                          type="button"
                          class="flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--color-danger-text)] hover:bg-rose-50 cursor-pointer"
                          (click)="onDelete(project)"
                        >
                          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span>Delete project</span>
                        </button>
                      }
                    </div>
                  </app-popover>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class ProjectTableViewComponent {
  private readonly fileApi = inject(FileApiService);

  projects = input.required<Project[]>();
  categories = input<readonly ProjectCategory[]>([]);

  rowSelected = output<Project>();
  viewRequested = output<Project>();
  settingsRequested = output<Project>();
  achieveRequested = output<Project>();
  membersRequested = output<Project>();
  deleteRequested = output<Project>();

  sortField = signal<SortField>('name');
  sortOrder = signal<SortOrder>('asc');
  openMenuProjectId = signal<string | null>(null);

  readonly sortedProjects = computed(() => {
    const list = [...this.projects()];
    const field = this.sortField();
    const order = this.sortOrder();

    list.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'targetDate':
          comparison = (a.targetDate || '').localeCompare(b.targetDate || '');
          break;
        case 'progress':
          comparison = this.calculateProgress(a) - this.calculateProgress(b);
          break;
        case 'hours':
          comparison = a.allocatedHours - b.allocatedHours;
          break;
      }
      return order === 'asc' ? comparison : -comparison;
    });

    return list;
  });

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortOrder.update((curr) => (curr === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortOrder.set('asc');
    }
  }

  toggleMenu(projectId: string): void {
    this.openMenuProjectId.update((curr) => (curr === projectId ? null : projectId));
  }

  avatarStackMembersFor(project: Project) {
    return project.members.map((member) => ({
      ...member,
      avatarUrl: member.avatarFileId ? this.fileApi.getFileUrl(member.avatarFileId) : null
    }));
  }

  onRowClick(project: Project): void {
    this.rowSelected.emit(project);
  }

  onOpenView(project: Project): void {
    this.openMenuProjectId.set(null);
    this.viewRequested.emit(project);
  }

  onOpenSettings(project: Project): void {
    this.openMenuProjectId.set(null);
    this.settingsRequested.emit(project);
  }

  onOpenMembers(project: Project): void {
    this.openMenuProjectId.set(null);
    this.membersRequested.emit(project);
  }

  onToggleAchieve(project: Project): void {
    this.openMenuProjectId.set(null);
    this.achieveRequested.emit(project);
  }

  onDelete(project: Project): void {
    this.openMenuProjectId.set(null);
    this.deleteRequested.emit(project);
  }

  projectLogoInitial(project: Project): string {
    return (project.identifier || project.name || 'P').substring(0, 2).toUpperCase();
  }

  getCategoryName(categoryId: string): string {
    const found = this.categories().find((c) => c.id === categoryId);
    return found ? found.name : 'General';
  }

  getDeadline(targetDate: string | null | undefined): DeadlineStatus | null {
    return getDeadlineStatus(targetDate);
  }

  calculateProgress(project: Project): number {
    if (!project.allocatedHours || project.allocatedHours <= 0) return 0;
    return Math.min(100, Math.round((project.completedHours / project.allocatedHours) * 100));
  }
}
