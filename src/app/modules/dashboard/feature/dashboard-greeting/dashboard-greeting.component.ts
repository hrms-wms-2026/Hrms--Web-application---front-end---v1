import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { getTimeOfDayInfo, TimeOfDayInfo } from '../../util/time-of-day.util';
import { injectNow } from '../../../../core/clock/clock.service';

@Component({
  selector: 'app-dashboard-greeting',
  standalone: true,
  templateUrl: './dashboard-greeting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardGreetingComponent {
  private readonly authStore = inject(AuthStore);
  // Re-evaluates "Good morning" -> "Good afternoon" as time passes: computed() needs a signal to depend on.
  private readonly now = injectNow('minute');

  protected readonly displayName = computed(() => displayNameFromEmail(this.authStore.email()));

  protected readonly timeOfDayInfo = computed<TimeOfDayInfo>(() => getTimeOfDayInfo(new Date(this.now())));

  protected readonly timeOfDayGreeting = computed(() => this.timeOfDayInfo().greeting);

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

