import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { UnsavedChangesService } from '../../shared/services/unsaved-changes.service';

/** Blocks leaving a route while a registered form has unsaved changes, via the shared dialog. */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => inject(UnsavedChangesService).requestClose();
