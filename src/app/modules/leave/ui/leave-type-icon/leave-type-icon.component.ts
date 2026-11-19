import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';
import { leaveTypeDefaultIcon } from '../../utils/leave-hub.util';

/** A leave type's round badge: its colour, tinted, with its picked icon, or a picture guessed from its name. */
@Component({
  selector: 'app-leave-type-icon',
  standalone: true,
  imports: [EntityIconComponent],
  template: `<app-entity-icon shape="circle" [icon]="shown()" [color]="color()" [name]="name()" />`,
  styles: [`:host { display: inline-flex; --entity-icon-size: var(--lti-size, 2.5rem); }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveTypeIconComponent {
  readonly name = input.required<string>();
  readonly code = input('');
  readonly color = input('var(--color-accent)');
  /** The picked icon ("lucide:{name}" / "emoji:{emoji}"), if any. */
  readonly icon = input<string | null | undefined>(null);
  protected readonly shown = computed(() => this.icon() || leaveTypeDefaultIcon(this.name(), this.code()));
}
