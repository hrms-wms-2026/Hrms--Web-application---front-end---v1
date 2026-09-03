import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CompanyLogoTileSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-company-logo-tile',
  standalone: true,
  template: `
    <div
      class="company-logo-tile company-logo-tile--{{ size() }}"
      [title]="name() || 'Workspace'"
      [attr.role]="logoUrl() ? null : 'img'"
      [attr.aria-label]="logoUrl() ? null : altText()"
    >
      @if (logoUrl(); as src) {
        <img [src]="src" [alt]="altText()" class="company-logo-tile__img" />
      } @else {
        <span class="company-logo-tile__initial">{{ initial() }}</span>
      }
    </div>
  `,
  styleUrl: './company-logo-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanyLogoTileComponent {
  readonly name = input<string | null | undefined>(undefined);
  readonly logoUrl = input<string | null | undefined>(undefined);
  readonly size = input<CompanyLogoTileSize>('md');

  readonly initial = computed(() => {
    const trimmed = this.name()?.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'O';
  });

  readonly altText = computed(() => {
    const trimmed = this.name()?.trim();
    return trimmed ? `${trimmed} logo` : 'Company logo';
  });
}
