import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div class="avatar avatar--{{ size() }}" [attr.aria-label]="altText()">
      @if (showImage()) {
        <img
          [src]="avatarUrl()"
          [alt]="altText()"
          class="avatar__image"
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
    const name = this.userName()?.trim();
    if (name) return `${name}'s avatar`;
    const mail = this.email()?.trim();
    if (mail) return `${mail}'s avatar`;
    return 'User avatar';
  });

  readonly initials = computed(() => {
    const name = this.userName()?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts.length === 1 && parts[0].length >= 1) {
        return parts[0].substring(0, 2).toUpperCase();
      }
    }
    return null;
  });

  onImageError(): void {
    this.imageError.set(true);
  }
}
