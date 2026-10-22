import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { FocusStatusApiService } from '../../data-access/focus-status-api.service';
import { FocusStatus } from '../../models/focus-status.model';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';

export type WellbeingCardKind = 'reminder' | 'hydration' | 'posture' | 'eye-rest' | 'stretch';

export interface WellbeingCard {
  readonly kind: WellbeingCardKind;
  readonly title: string;
  readonly description: string;
}

const FOCUS_STATUS_POLL_MS = 90_000;
const ROTATE_MS = 6_000;

/** Illustration for a card kind, added as each one is supplied. A kind with no entry falls
 * back to the small line-icon badge. */
const ILLUSTRATIONS: Partial<Record<WellbeingCardKind, string>> = {
  reminder: '/assets/wellbeing/mindful-break.png',
  hydration: '/assets/wellbeing/hydration.png',
  posture: '/assets/wellbeing/posture.png',
  'eye-rest': '/assets/wellbeing/eye-rest.png',
  stretch: '/assets/wellbeing/stretch.png'
};

const WELLBEING_TIPS: readonly WellbeingCard[] = [
  { kind: 'hydration', title: 'Stay hydrated', description: 'Drink a glass of water — dehydration is a common cause of afternoon fatigue.' },
  { kind: 'posture', title: 'Check your posture', description: 'Sit up straight and relax your shoulders. Good posture reduces strain over a long day.' },
  { kind: 'eye-rest', title: 'Rest your eyes', description: 'Look at something 20 feet away for 20 seconds to ease screen fatigue.' },
  { kind: 'stretch', title: 'Stretch it out', description: 'A quick 2-minute stretch can boost circulation and focus.' }
];

@Component({
  selector: 'app-wellbeing-carousel-card',
  standalone: true,
  imports: [],
  templateUrl: './wellbeing-carousel-card.component.html',
  styleUrl: './wellbeing-carousel-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WellbeingCarouselCardComponent implements OnInit, OnDestroy {
  private readonly focusStatusApi = inject(FocusStatusApiService);
  private readonly timeTrackingStore = inject(TimeTrackingStore);

  private readonly focusStatus = signal<FocusStatus | null>(null);
  /** Inside a dashboard frame the first status comes from the bootstrap and polls go through the widget
   * context; outside one (or when that data isn't available, or a refresh fails) the card calls its own
   * API as before - whose failure still means "tips only". */
  private readonly feed = injectWidgetDataFeed<FocusStatus>({
    apply: (status) => this.applyFocusStatus(status),
    fetch: () => this.refreshFocusStatus()
  });
  protected readonly currentIndex = signal(0);
  protected readonly actionLoading = this.timeTrackingStore.actionLoading;

  protected readonly cards = computed<WellbeingCard[]>(() => {
    const status = this.focusStatus();
    const reminder: WellbeingCard[] = status?.isBreakReminderDue
      ? [
          {
            kind: 'reminder',
            title: 'Take a mindful break',
            description: `You've been focused for ${status.continuousFocusMinutes} minutes. A short break can help you recharge.`
          }
        ]
      : [];
    return [...reminder, ...WELLBEING_TIPS];
  });

  protected readonly activeCard = computed<WellbeingCard | null>(() => {
    const cards = this.cards();
    if (cards.length === 0) return null;
    return cards[this.currentIndex() % cards.length];
  });

  protected readonly contentVisible = signal(true);

  private focusStatusPollId: ReturnType<typeof setInterval> | null = null;
  private rotateId: ReturnType<typeof setInterval> | null = null;
  private fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private wasBreakReminderDue = false;
  private isFirstIndexChange = true;

  constructor() {
    // Cross-fades card content on every index change (manual or auto) - skips the very first
    // run so the initial card doesn't fade in on load.
    effect(() => {
      this.currentIndex();
      if (this.isFirstIndexChange) {
        this.isFirstIndexChange = false;
        return;
      }
      if (this.fadeTimeoutId) clearTimeout(this.fadeTimeoutId);
      this.contentVisible.set(false);
      this.fadeTimeoutId = setTimeout(() => this.contentVisible.set(true), 30);
    });
  }

  ngOnInit(): void {
    this.feed.start();
    this.focusStatusPollId = setInterval(() => this.feed.reload(), FOCUS_STATUS_POLL_MS);
    // Respect prefers-reduced-motion: don't auto-advance a rotating carousel for employees who
    // asked the OS not to animate content changes on their behalf. Manual prev/next/dots still work.
    if (!prefersReducedMotion()) {
      this.rotateId = setInterval(() => this.autoAdvance(), ROTATE_MS);
    }
  }

  ngOnDestroy(): void {
    if (this.focusStatusPollId) clearInterval(this.focusStatusPollId);
    if (this.rotateId) clearInterval(this.rotateId);
    if (this.fadeTimeoutId) clearTimeout(this.fadeTimeoutId);
  }

  /** Auto-rotate tick - skips advancing while the break reminder is showing, so an active
   * nudge doesn't rotate out of view before the employee has a chance to act on it. */
  private autoAdvance(): void {
    if (this.activeCard()?.kind === 'reminder') return;
    this.next();
  }

  protected next(): void {
    const total = this.cards().length;
    if (total === 0) return;
    this.currentIndex.set((this.currentIndex() + 1) % total);
  }

  protected previous(): void {
    const total = this.cards().length;
    if (total === 0) return;
    this.currentIndex.set((this.currentIndex() - 1 + total) % total);
  }

  protected goTo(index: number): void {
    this.currentIndex.set(index);
  }

  protected illustrationFor(kind: WellbeingCardKind): string | null {
    return ILLUSTRATIONS[kind] ?? null;
  }

  protected startBreak(): void {
    if (this.actionLoading()) return;
    void this.timeTrackingStore.startBreak();
  }

  private refreshFocusStatus(): void {
    this.focusStatusApi.getMyFocusStatus().subscribe({
      next: (status) => this.applyFocusStatus(status),
      error: () => this.focusStatus.set(null)
    });
  }

  private applyFocusStatus(status: FocusStatus): void {
    this.focusStatus.set(status);
    // Jump straight to the reminder card the moment it becomes due, so it isn't missed
    // mid-rotation - the reminder is always inserted at index 0 in `cards`.
    if (status.isBreakReminderDue && !this.wasBreakReminderDue) {
      this.currentIndex.set(0);
    }
    this.wasBreakReminderDue = status.isBreakReminderDue;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
