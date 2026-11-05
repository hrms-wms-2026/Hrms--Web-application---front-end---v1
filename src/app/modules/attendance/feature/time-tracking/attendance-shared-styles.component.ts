import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Carries the styles shared by the Attendance page and the panels and dialogs inside it.
 * They used to live in src/styles.css, which put ~5 kB into every page's initial bundle.
 * ViewEncapsulation.None is required: the classes are used across several child components,
 * so scoped (emulated) selectors would not reach them. The styles load with this lazy route only.
 */
@Component({
  selector: 'app-attendance-shared-styles',
  standalone: true,
  template: '',
  styleUrl: './attendance-shared-styles.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceSharedStylesComponent {}
