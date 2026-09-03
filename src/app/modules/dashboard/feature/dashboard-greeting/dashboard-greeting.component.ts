import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';

@Component({
  selector: 'app-dashboard-greeting',
  standalone: true,
  templateUrl: './dashboard-greeting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardGreetingComponent {
  private readonly authStore = inject(AuthStore);

  protected readonly displayName = computed(() => displayNameFromEmail(this.authStore.email()));

  protected readonly timeOfDayGreeting = computed(() => timeOfDayGreetingFor(new Date()));

  protected readonly dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
}

/** Mirrors ProfileMenuComponent.displayName's email-local-part derivation, so the greeting
 * and the profile menu never disagree on what to call the signed-in employee. */
function displayNameFromEmail(email: string | null): string | null {
  const mail = email?.trim();
  if (!mail) return null;
  const localPart = mail.split('@')[0];
  const words = localPart.split(/[._-]/).filter(Boolean);
  if (words.length === 0) return null;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function timeOfDayGreetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
