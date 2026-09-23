import { Component, computed, input } from '@angular/core';
import { AvatarComponent, AvatarSize } from '../avatar/avatar.component';

export interface AvatarStackMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

@Component({
  selector: 'app-avatar-stack',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <div class="flex items-center -space-x-2">
      @for (member of visibleMembers(); track member.userId) {
        <span class="rounded-full ring-2 ring-[var(--color-surface)]" style="--color-profile-bg: var(--color-accent); --color-text-primary: white;">
          <app-avatar [avatarUrl]="member.avatarUrl ?? null" [userName]="member.displayName" [size]="size()" />
        </span>
      }
      @if (overflowCount() > 0) {
        <span
          data-testid="avatar-overflow"
          class="flex items-center justify-center rounded-full ring-2 ring-[var(--color-surface)] bg-[var(--color-surface-secondary)] text-[10px] font-semibold text-[var(--color-text-secondary)]"
          [style.width.rem]="avatarRem()"
          [style.height.rem]="avatarRem()"
        >+{{ overflowCount() }}</span>
      }
    </div>
  `
})
export class AvatarStackComponent {
  members = input.required<AvatarStackMember[]>();
  totalCount = input(0);
  maxVisible = input(4);
  size = input<AvatarSize>('sm');

  readonly visibleMembers = computed(() => this.members().slice(0, this.maxVisible()));
  readonly overflowCount = computed(() => Math.max(0, this.totalCount() - this.visibleMembers().length));
  readonly avatarRem = computed(() => (this.size() === 'lg' ? 3.5 : this.size() === 'md' ? 2.25 : 1.75));
}
