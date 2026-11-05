import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { buildTenantUrl, readLastTenantSlug } from '../../../../core/auth/utils/tenant-redirect';
import { ThemeStore } from '../../../../core/theme/state/theme.store';

const HIDE_AFTER = 120;
const SCROLL_DELTA = 8;
/**
 * Presentational public-site header: brand mark, in-page section links, sign-in CTA and a
 * keyboard-operable mobile menu. Pure presentational component (no data-access calls of its own).
 *
 * Auto-hides on scroll-down past HIDE_AFTER and reappears on scroll-up, but stays visible while
 * the mobile menu is open or focus is inside the header - see onScroll()/updateVisibility(). State
 * lives in signals so visibility updates propagate under zoneless change detection without relying
 * on zone.js (this app has none).
 */
@Component({
  selector: 'app-landing-header',
  standalone: true,
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './landing-header.component.html',
  styleUrl: './landing-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingHeaderComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly themeStore = inject(ThemeStore);

  readonly menuOpen = signal(false);
  readonly headerVisible = signal(true);
  /** One source of truth with the app's Appearance setting (ThemeStore). */
  readonly isDarkMode = computed(() => this.themeStore.resolvedMode() === 'dark');
  readonly isScrolled = signal(false);
  readonly workspaceUrl = signal<string | null>(null);

  private lastScrollY = 0;
  private focusWithinHeader = false;
  private rafId: number | null = null;
  private scrollListener: (() => void) | null = null;
  private focusInListener: (() => void) | null = null;
  private focusOutListener: ((event: FocusEvent) => void) | null = null;

  constructor() {
    const lastTenantSlug = readLastTenantSlug(this.document.cookie);
    this.workspaceUrl.set(lastTenantSlug ? buildTenantUrl(lastTenantSlug, '/dashboard') : null);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.reset());
  }

  toggleMode(): void {
    this.themeStore.setMode(this.isDarkMode() ? 'light' : 'dark');
  }

  applyLightMode(): void {
    this.themeStore.setMode('light');
  }

  applyDarkMode(): void {
    this.themeStore.setMode('dark');
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    if (this.menuOpen()) {
      this.headerVisible.set(true);
    }
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.lastScrollY = window.scrollY;

    this.scrollListener = () => this.onScroll();
    window.addEventListener('scroll', this.scrollListener, { passive: true });

    this.focusInListener = () => {
      this.focusWithinHeader = true;
      this.headerVisible.set(true);
    };
    this.focusOutListener = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !this.elementRef.nativeElement.contains(next)) {
        this.focusWithinHeader = false;
      }
    };

    const host = this.elementRef.nativeElement;
    host.addEventListener('focusin', this.focusInListener);
    host.addEventListener('focusout', this.focusOutListener);

    this.destroyRef.onDestroy(() => this.teardown());
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  /** Resets scroll tracking and visibility - called after Angular route navigation. */
  reset(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.lastScrollY = window.scrollY;
    }
    this.menuOpen.set(false);
    this.headerVisible.set(true);
  }

  private onScroll(): void {
    if (this.rafId !== null) {
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateVisibility();
    });
  }

  private updateVisibility(): void {
    const currentScrollY = window.scrollY;
    this.isScrolled.set(currentScrollY > 20);

    if (this.menuOpen() || this.focusWithinHeader) {
      this.headerVisible.set(true);
      this.lastScrollY = currentScrollY;
      return;
    }

    if (currentScrollY <= HIDE_AFTER) {
      this.headerVisible.set(true);
    } else {
      const delta = currentScrollY - this.lastScrollY;
      if (delta > SCROLL_DELTA) {
        this.headerVisible.set(false);
      } else if (delta < -SCROLL_DELTA) {
        this.headerVisible.set(true);
      }
    }

    this.lastScrollY = currentScrollY;
  }

  private teardown(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
    const host = this.elementRef.nativeElement;
    if (this.focusInListener) {
      host.removeEventListener('focusin', this.focusInListener);
      this.focusInListener = null;
    }
    if (this.focusOutListener) {
      host.removeEventListener('focusout', this.focusOutListener);
      this.focusOutListener = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
