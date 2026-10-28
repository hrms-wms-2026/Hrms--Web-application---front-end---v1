import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
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
  readonly activeTab = signal<FeatureTabId>('workday');
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
    this.restartAutoRotation();
  }

  setTab(tab: FeatureTabId): void {
    this.selectTab(tab);
  }

  private startAutoRotation(): void {
    this.stopAutoRotation();
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

  private restartAutoRotation(): void {
    this.startAutoRotation();
  }
}
