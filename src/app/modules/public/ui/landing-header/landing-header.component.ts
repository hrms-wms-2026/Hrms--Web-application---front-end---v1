import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { buildTenantUrl } from '../../../../core/auth/utils/tenant-redirect';

const HIDE_AFTER = 120;
const SCROLL_DELTA = 8;
const LAST_TENANT_COOKIE = 'onevo_last_tenant';

function readLastTenantSlug(document: Document): string | null {
  const cookies = document.cookie.split(';').map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${LAST_TENANT_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(LAST_TENANT_COOKIE.length + 1));
  return value.length > 0 ? value : null;
}

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

  readonly menuOpen = signal(false);
  readonly headerVisible = signal(true);
  readonly isDarkMode = signal(false);
  readonly isScrolled = signal(false);
  readonly workspaceUrl = signal<string | null>(null);

  private lastScrollY = 0;
  private focusWithinHeader = false;
  private rafId: number | null = null;
  private scrollListener: (() => void) | null = null;
  private focusInListener: (() => void) | null = null;
  private focusOutListener: ((event: FocusEvent) => void) | null = null;

  constructor() {
    const lastTenantSlug = readLastTenantSlug(this.document);
    this.workspaceUrl.set(lastTenantSlug ? buildTenantUrl(lastTenantSlug, '/dashboard') : null);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.reset());
  }

  toggleMode(): void {
    const nextMode = !this.isDarkMode();
    this.isDarkMode.set(nextMode);
    this.applyModeToDocument(nextMode);
  }

  applyLightMode(): void {
    this.isDarkMode.set(false);
    this.applyModeToDocument(false);
  }

  applyDarkMode(): void {
    this.isDarkMode.set(true);
    this.applyModeToDocument(true);
  }

  private applyModeToDocument(isDark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const doc = document.documentElement;
    if (isDark) {
      doc.classList.add('dark');
      doc.setAttribute('data-mode', 'dark');
      try { localStorage.setItem('onevo.color.mode', 'dark'); } catch {}
    } else {
      doc.classList.remove('dark');
      doc.setAttribute('data-mode', 'light');
      try { localStorage.setItem('onevo.color.mode', 'light'); } catch {}
    }
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

    // Initialize mode from localStorage or system prefers-color-scheme
    try {
      const stored = localStorage.getItem('onevo.color.mode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialDark = stored ? stored === 'dark' : prefersDark;
      this.isDarkMode.set(initialDark);
      this.applyModeToDocument(initialDark);
    } catch {
      // Fallback if localStorage or matchMedia fails
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
