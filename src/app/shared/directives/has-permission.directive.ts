import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../../core/auth/state/permission.service';

/**
 * *appHasPermission="'org:manage'" or *appHasPermission="['org:read','org:manage']"
 * (any-of match). Renders/removes the host template based on PermissionService, so
 * templates never inline permission-array literals more than once. Prefer this over a
 * service call in the component class only when the whole element/block should
 * disappear - use PermissionService directly when you need a disabled (not hidden)
 * state instead.
 */
@Directive({
  selector: '[appHasPermission]'
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly permissionService = inject(PermissionService);

  readonly appHasPermission = input<string | readonly string[] | undefined>(undefined);

  private hasView = false;

  constructor() {
    effect(() => {
      const allowed = this.evaluate(this.appHasPermission());
      if (allowed && !this.hasView) {
        this.viewContainerRef.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainerRef.clear();
        this.hasView = false;
      }
    });
  }

  private evaluate(required: string | readonly string[] | undefined): boolean {
    if (required === undefined) {
      return true;
    }
    if (typeof required === 'string') {
      return this.permissionService.hasPermission(required);
    }
    if (required.length === 0) {
      return true;
    }
    return this.permissionService.hasAnyPermission(required);
  }
}
