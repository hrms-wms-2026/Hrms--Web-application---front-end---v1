import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PositionAccessTemplateResponse, PositionListItemResponse, PositionTreeNodeResponse, SetPositionAccessRequest } from '../../models/position.model';
import { RoleSummaryResponse } from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-position-access-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [StopClickPropagationDirective, CommonModule, ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './position-access-modal.component.html',
  styleUrl: './position-access-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionAccessModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) position!: PositionListItemResponse | PositionTreeNodeResponse;
  @Input() accessTemplate: PositionAccessTemplateResponse | null = null;
  @Input({ required: true }) availableRoles: readonly RoleSummaryResponse[] = [];
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  @Input() hasRoleReadAccess = false;
  @Input() canManage = false;

  @Output() saveAccess = new EventEmitter<SetPositionAccessRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly form = this.fb.group({
    roleId: [''],
    requiresApproval: [false]
  });

  get roleOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'No system role' }
    ];
    for (const r of this.availableRoles) {
      opts.push({ value: r.id, label: r.name });
    }
    return opts;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accessTemplate'] && this.accessTemplate) {
      this.form.patchValue({
        roleId: this.accessTemplate.roleId || '',
        requiresApproval: !!this.accessTemplate.requiresApproval
      });
    }
  }

  onSubmit(): void {
    const val = this.form.getRawValue();
    this.saveAccess.emit({
      roleId: val.roleId || '',
      requiresApproval: !!val.requiresApproval
    });
  }
}
