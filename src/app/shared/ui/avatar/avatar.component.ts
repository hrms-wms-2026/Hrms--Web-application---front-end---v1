import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { getInitials } from '../../utils/avatar.utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded';

@Component({
  selector: 'app-avatar',
  standalone: true,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <div
      class="avatar avatar--{{ size() }} avatar--{{ shape() }}"
      [class.avatar--unassigned]="unassigned()"
      [attr.aria-label]="altText()"
    >
      @if (unassigned()) {
        <div class="avatar__fallback avatar__fallback--unassigned" role="img" aria-label="Unassigned">
          <svg class="avatar__icon avatar__icon--unassigned" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      } @else if (showImage()) {
        <img
          [src]="avatarUrl()"
          [alt]="altText()"
          [class]="'avatar__image ' + (imageClass() || '')"
          (error)="onImageError()"
        />
      } @else {
        <div class="avatar__fallback" role="img" [attr.aria-label]="altText()">
          @if (initials()) {
            <span class="avatar__initials">{{ initials() }}</span>
          } @else {
            <svg
              class="avatar__icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './avatar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarComponent {
  readonly avatarUrl = input<string | null | undefined>(undefined);
  readonly userName = input<string | null | undefined>(undefined);
  readonly email = input<string | null | undefined>(undefined);
  readonly size = input<AvatarSize>('md');
  readonly shape = input<AvatarShape>('circle');
  readonly unassigned = input<boolean>(false);
  readonly imageClass = input<string>('');

  readonly imageError = signal(false);

  constructor() {
    effect(() => {
      // Reset error state when avatarUrl changes
      this.avatarUrl();
      this.imageError.set(false);
    });
  }

  readonly showImage = computed(() => {
    const url = this.avatarUrl();
    return !!url && url.trim().length > 0 && !this.imageError();
  });

  readonly altText = computed(() => {
    if (this.unassigned()) return 'Unassigned';
    const name = this.userName()?.trim();
    if (name) return `${name}'s avatar`;
    const mail = this.email()?.trim();
    if (mail) return `${mail}'s avatar`;
    return 'User avatar';
  });

  readonly initials = computed(() => {
    const name = this.userName()?.trim();
    return name ? getInitials(name) || null : null;
  });

  onImageError(): void {
    this.imageError.set(true);
  }
}
