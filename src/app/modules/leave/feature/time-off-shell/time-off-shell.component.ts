/** Quiet Operations Desk: local Time Off context rail, deliberately limited to shipped screens. */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
@Component({ selector: 'app-time-off-shell', standalone: true, imports: [RouterLink, RouterLinkActive, RouterOutlet], templateUrl: './time-off-shell.component.html', styleUrl: './time-off-shell.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class TimeOffShellComponent { readonly menuItems = [{ label: 'Leave Types', route: '/time-off/types' }, { label: 'Leave Policies', route: '/time-off/policies' }] as const; }
