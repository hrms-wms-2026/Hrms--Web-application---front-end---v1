import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseEntityIcon } from './entity-icon.registry';

/**
 * A project's, leave type's or group's picked icon on a soft tint of its colour: a Lucide icon, an emoji, or (with no
 * icon) the initials of `name`. Takes primitives only. Size it with `--entity-icon-size` (default 2.25rem).
 */
@Component({
  selector: 'app-entity-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-entity-icon' },
  template: `
    <span
      class="ei"
      [class.ei--circle]="shape() === 'circle'"
      [class.ei--emoji]="parsed()?.kind === 'emoji'"
      [style.--ei-color]="color() || 'var(--color-accent)'"
      [attr.aria-hidden]="true"
    >
      @switch (parsed()?.kind) {
        @case ('lucide') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            @for (child of lucideChildren(); track $index) {
              @switch (child.tag) {
                @case ('path') { <svg:path [attr.d]="child.a['d']" /> }
                @case ('circle') { <svg:circle [attr.cx]="child.a['cx']" [attr.cy]="child.a['cy']" [attr.r]="child.a['r']" /> }
                @case ('rect') {
                  <svg:rect [attr.x]="child.a['x']" [attr.y]="child.a['y']" [attr.width]="child.a['width']" [attr.height]="child.a['height']"
                            [attr.rx]="child.a['rx']" [attr.ry]="child.a['ry']" />
                }
                @case ('line') { <svg:line [attr.x1]="child.a['x1']" [attr.y1]="child.a['y1']" [attr.x2]="child.a['x2']" [attr.y2]="child.a['y2']" /> }
                @case ('polyline') { <svg:polyline [attr.points]="child.a['points']" /> }
                @case ('polygon') { <svg:polygon [attr.points]="child.a['points']" /> }
                @case ('ellipse') { <svg:ellipse [attr.cx]="child.a['cx']" [attr.cy]="child.a['cy']" [attr.rx]="child.a['rx']" [attr.ry]="child.a['ry']" /> }
              }
            }
          </svg>
        }
        @case ('emoji') { <span class="ei__emoji">{{ emoji() }}</span> }
        @default { <span class="ei__initials">{{ initials() }}</span> }
      }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .ei {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--entity-icon-size, 2.25rem); height: var(--entity-icon-size, 2.25rem);
      border-radius: 28%;
      background: color-mix(in srgb, var(--ei-color) 14%, transparent);
      color: var(--ei-color);
      container-type: size;
    }
    .ei--circle { border-radius: 999px; }
    .ei svg { width: 52%; height: 52%; }
    .ei__emoji { font-size: 58cqh; line-height: 1; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif; }
    .ei__initials { font-size: 38cqh; font-weight: 600; letter-spacing: 0.02em; line-height: 1; }
  `]
})
export class EntityIconComponent {
  /** The stored value: "lucide:{name}", "emoji:{emoji}", or null/empty for initials. */
  readonly icon = input<string | null | undefined>(null);
  /** The tint; defaults to the accent colour. */
  readonly color = input<string | null | undefined>(null);
  /** Used for the initials when there is no icon. */
  readonly name = input('');
  readonly shape = input<'rounded' | 'circle'>('rounded');

  protected readonly parsed = computed(() => parseEntityIcon(this.icon()));
  protected readonly emoji = computed(() => {
    const p = this.parsed();
    return p?.kind === 'emoji' ? p.emoji : '';
  });
  protected readonly lucideChildren = computed(() => {
    const p = this.parsed();
    return p?.kind === 'lucide' ? p.node.map(([tag, a]) => ({ tag, a })) : [];
  });
  protected readonly initials = computed(() =>
    this.name().trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?');
}
