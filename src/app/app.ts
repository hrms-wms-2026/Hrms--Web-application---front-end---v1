import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeStore } from './core/theme/state/theme.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Customer-web-application');
  // Injected only to force ThemeStore's onInit hook to run at bootstrap, applying the
  // persisted preset before any route (including auth/login) renders.
  private readonly themeStore = inject(ThemeStore);
}
