import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { getTimeOfDayInfo, TimeOfDayInfo } from '../../util/time-of-day.util';

@Component({
  selector: 'app-dashboard-greeting',
  standalone: true,
  templateUrl: './dashboard-greeting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardGreetingComponent {
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  // Ticks every minute so the greeting re-evaluates across a "Good morning" -> "Good afternoon"
  // boundary instead of freezing at whatever time-of-day was active on first render (computed()
  // has no reactive dependency without this, since `new Date()` alone never invalidates it).
  private readonly now = signal(Date.now());

  protected readonly displayName = computed(() => displayNameFromEmail(this.authStore.email()));

  protected readonly timeOfDayInfo = computed<TimeOfDayInfo>(() => getTimeOfDayInfo(new Date(this.now())));

  protected readonly timeOfDayGreeting = computed(() => this.timeOfDayInfo().greeting);

  protected readonly dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  constructor() {
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => {
      if (this.tickTimer !== null) clearInterval(this.tickTimer);
    });
  }
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

