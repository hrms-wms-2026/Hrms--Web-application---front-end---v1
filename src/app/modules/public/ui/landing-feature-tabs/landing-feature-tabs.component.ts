import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

export type FeatureTabId = 'workday' | 'hr' | 'intelligence' | 'worksync';

@Component({
  selector: 'app-landing-feature-tabs',
  imports: [KeyboardClickDirective],
  standalone: true,
  templateUrl: './landing-feature-tabs.component.html',
  styleUrl: './landing-feature-tabs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingFeatureTabsComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  readonly activeTab = signal<FeatureTabId>('workday');
  readonly isPaused = signal(false);
  readonly isAutoPlaying = signal(true);
  private readonly tabs: FeatureTabId[] = ['workday', 'hr', 'intelligence', 'worksync'];
  private timerId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startAutoRotation();
  }

  ngOnDestroy(): void {
    this.stopAutoRotation();
  }

  selectTab(tab: FeatureTabId): void {
    this.activeTab.set(tab);
    this.isAutoPlaying.set(false);
    this.stopAutoRotation();
  }

  setTab(tab: FeatureTabId): void {
    this.selectTab(tab);
  }

  pauseAutoRotation(): void {
    if (!this.isAutoPlaying()) {
      return;
    }
    this.isPaused.set(true);
    this.stopAutoRotation();
  }

  resumeAutoRotation(): void {
    if (!this.isAutoPlaying()) {
      return;
    }
    this.isPaused.set(false);
    this.startAutoRotation();
  }

  private startAutoRotation(): void {
    this.stopAutoRotation();
    if (!isPlatformBrowser(this.platformId) || !this.isAutoPlaying()) {
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      this.isAutoPlaying.set(false);
      return;
    }
    this.timerId = setInterval(() => {
      const currentIndex = this.tabs.indexOf(this.activeTab());
      const nextIndex = (currentIndex + 1) % this.tabs.length;
      this.activeTab.set(this.tabs[nextIndex]);
    }, 5000);
  }

  private stopAutoRotation(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
