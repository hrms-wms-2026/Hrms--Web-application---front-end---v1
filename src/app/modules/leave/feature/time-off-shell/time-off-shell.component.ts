/** People-style navigation: the shared main-layout submenu owns Time Off navigation. */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({ selector: 'app-time-off-shell', standalone: true, imports: [RouterOutlet], templateUrl: './time-off-shell.component.html', styleUrl: './time-off-shell.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class TimeOffShellComponent {}
