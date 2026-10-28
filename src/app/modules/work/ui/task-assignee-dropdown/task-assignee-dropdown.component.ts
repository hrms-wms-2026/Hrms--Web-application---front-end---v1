import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

export interface TaskAssigneeOption {
  employeeId: string;
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
}

@Component({
  selector: 'app-task-assignee-dropdown',
  standalone: true,
  imports: [StopClickPropagationDirective, AvatarComponent],
  template: `
    <div
      class="task-assignee-dropdown task-card__assignee-popover tfm-popover"
      role="dialog"
      aria-label="Change assignee"
      appStopClickPropagation
    >
      <div class="task-assignee-dropdown__search">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="task-assignee-dropdown__search-icon">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          data-testid="assignee-dropdown-search"
          [placeholder]="placeholder()"
          [value]="searchQuery()"
          (input)="searchQuery.set($any($event.target).value)"
          (keydown.escape)="onEscape()"
        />
      </div>

      <div class="task-assignee-dropdown__list task-card__assignee-list scroll-fade">
        @if (allowUnassigned()) {
          <button
            type="button"
            data-testid="assignee-option-unassigned"
            class="task-assignee-dropdown__option task-card__assignee-option tfm-popover__item"
            [class.task-assignee-dropdown__option--selected]="isUnassignedSelected()"
            (click)="selectUnassigned()"
          >
            <app-avatar size="xs" shape="circle" [unassigned]="true" />
            <span class="task-assignee-dropdown__name task-card__assignee-option-name tfm-popover__name">Unassigned</span>
            @if (isUnassignedSelected()) {
              <svg class="task-assignee-dropdown__check task-card__assignee-check" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 7" />
              </svg>
            }
          </button>
        }

        @for (member of filteredMembers(); track member.employeeId) {
          <button
            type="button"
            [attr.data-testid]="'assignee-option-' + member.employeeId"
            class="task-assignee-dropdown__option task-card__assignee-option tfm-popover__item"
            [class.task-assignee-dropdown__option--selected]="isSelected(member.employeeId)"
            (click)="selectMember(member.employeeId)"
          >
            <app-avatar
              size="xs"
              shape="circle"
              [avatarUrl]="member.avatarUrl"
              [userName]="member.name"
            />
            <span class="task-assignee-dropdown__name task-card__assignee-option-name tfm-popover__name">{{ member.name }}</span>
            @if (isSelected(member.employeeId)) {
              <svg class="task-assignee-dropdown__check task-card__assignee-check" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 7" />
              </svg>
            }
          </button>
        } @empty {
          <p class="task-assignee-dropdown__empty task-card__assignee-empty">{{ emptyText() }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-assignee-dropdown {
      display: flex;
      flex-direction: column;
      min-width: 195px;
      max-width: 270px;
      border-radius: 8px;
      border: 1px solid var(--color-border, #e2e8f0);
      background: var(--color-surface, #ffffff);
      padding: 6px;
      box-shadow: 0 10px 25px rgb(15 23 42 / 0.16);
      box-sizing: border-box;
      user-select: none;
    }

    .task-assignee-dropdown__search {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--color-border, #e2e8f0);
    }

    .task-assignee-dropdown__search-icon {
      width: 13px;
      height: 13px;
      stroke: var(--color-text-secondary, #64748b);
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
    }

    .task-assignee-dropdown__search input {
      width: 100%;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 11.5px;
      color: var(--color-text-primary, #0f172a);
    }

    .task-assignee-dropdown__list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 240px;
      overflow-y: auto;
    }

    .task-assignee-dropdown__option {
      display: flex;
      align-items: center;
      gap: 7px;
      width: 100%;
      padding: 5px 7px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--color-text-primary, #0f172a);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: background-color 100ms ease;
    }

    .task-assignee-dropdown__option:hover {
      background: var(--color-surface-secondary, #f1f5f9);
    }

    .task-assignee-dropdown__option--selected {
      background: color-mix(in srgb, var(--color-accent, #3b82f6) 12%, var(--color-surface, #ffffff));
      color: var(--color-accent, #2563eb);
      font-weight: 600;
    }

    .task-assignee-dropdown__name {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-assignee-dropdown__check {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      margin-left: auto;
      flex-shrink: 0;
    }

    .task-assignee-dropdown__empty {
      margin: 8px 0 4px;
      color: var(--color-text-secondary, #64748b);
      font-size: 12px;
      text-align: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskAssigneeDropdownComponent {
  members = input<readonly TaskAssigneeOption[]>([]);
  selectedId = input<string | null | undefined>(undefined);
  allowUnassigned = input<boolean>(true);
  placeholder = input<string>('Search people...');
  emptyText = input<string>('No matching people');

  selected = output<string | null>();
  closed = output<void>();

  protected readonly searchQuery = signal('');

  protected readonly filteredMembers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.members();
    if (!q) return list;
    return list.filter((m) =>
      m.name.toLowerCase().includes(q) || (m.email ? m.email.toLowerCase().includes(q) : false)
    );
  });

  protected readonly isUnassignedSelected = computed(() => {
    const s = this.selectedId();
    return s === null || s === undefined || s === '';
  });

  isSelected(employeeId: string): boolean {
    return this.selectedId() === employeeId;
  }

  selectMember(employeeId: string): void {
    this.selected.emit(employeeId);
  }

  selectUnassigned(): void {
    this.selected.emit(null);
  }

  onEscape(): void {
    this.closed.emit();
  }
}
