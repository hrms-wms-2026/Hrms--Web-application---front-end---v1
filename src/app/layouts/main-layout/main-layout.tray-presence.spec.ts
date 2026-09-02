import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../core/auth/state/auth.store';
import { TrayPresenceApiService } from '../../core/tray-presence/data-access/tray-presence-api.service';
import { TrayActivationGateComponent } from '../../core/tray-presence/feature/tray-activation-gate/tray-activation-gate.component';
import { TrayPresenceStore } from '../../core/tray-presence/state/tray-presence.store';
import { NavigationStateService } from './nav/navigation-state.service';
import { MainLayoutComponent } from './main-layout.component';

@Component({ selector: 'app-side-navbar', standalone: true, template: '' })
class SideNavbarStubComponent {}

@Component({ selector: 'app-top-navbar', standalone: true, template: '' })
class TopNavbarStubComponent {
  readonly email = input('');
}

@Component({ selector: 'app-sub-sidebar', standalone: true, template: '' })
class SubSidebarStubComponent {
  readonly sectionLabel = input('');
  readonly items = input<unknown[]>([]);
}

@Component({ selector: 'app-toast-host', standalone: true, template: '' })
class ToastHostStubComponent {}

@Component({ selector: 'app-mobile-bottom-nav', standalone: true, template: '' })
class MobileBottomNavStubComponent {}

@Component({ selector: 'app-locked-workspace-preview', standalone: true, template: '' })
class LockedWorkspacePreviewStubComponent {}

@Component({ selector: 'router-outlet', standalone: true, template: '' })
class RouterOutletStubComponent {}

describe('MainLayoutComponent tray activation gate', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;
  const canRenderProtectedContent = signal(false);
  const isBlocking = signal(false);
  const phase = signal<'waiting' | 'connected'>('waiting');
  const hasUsableCode = signal(true);
  const code = signal('BCDF2345');
  const codeSecondsRemaining = signal(600);
  const copyState = signal<'idle' | 'copied'>('idle');
  const generationError = signal<string | null>(null);

  beforeEach(async () => {
    canRenderProtectedContent.set(false);
    isBlocking.set(false);

    const trayPresence = {
      canRenderProtectedContent,
      isBlocking,
      phase,
      hasUsableCode,
      code,
      codeSecondsRemaining,
      copyState,
      generationError,
      start: vi.fn(),
      retry: vi.fn(),
      copyCode: vi.fn()
    };
    const trayApi = {
      getStatus: vi.fn(),
      generateActivationCode: vi.fn(() => of({ code: 'BCDF2345', expires_in_seconds: 600 }))
    };

    TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        { provide: TrayPresenceStore, useValue: trayPresence },
        { provide: TrayPresenceApiService, useValue: trayApi },
        {
          provide: AuthStore,
          useValue: {
            email: signal('buddy@example.test'),
            logout: vi.fn(),
            activeModules: signal(['monitoring'])
          }
        },
        {
          provide: NavigationStateService,
          useValue: { activeChildren: signal([]), activeItem: signal(null) }
        }
      ]
    });
    TestBed.overrideComponent(MainLayoutComponent, {
      set: {
        imports: [
          RouterOutletStubComponent,
          SideNavbarStubComponent,
          TopNavbarStubComponent,
          SubSidebarStubComponent,
          ToastHostStubComponent,
          MobileBottomNavStubComponent,
          TrayActivationGateComponent,
          LockedWorkspacePreviewStubComponent
        ]
      }
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(MainLayoutComponent);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows the gate only for confirmed disconnection and removes it after connection', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-tray-activation-gate')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-locked-workspace-preview')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();

    isBlocking.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#gate-title')?.textContent).toContain(
      'Connect the ONEVO tray app'
    );
    expect(fixture.nativeElement.querySelector('app-locked-workspace-preview')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();

    isBlocking.set(false);
    canRenderProtectedContent.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-tray-activation-gate')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-locked-workspace-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });
});

describe('MainLayoutComponent tray activation gate when monitoring module is not active', () => {
  it('never starts presence tracking or shows the connect-tray gate', async () => {
    const canRenderProtectedContent = signal(false);
    const isBlocking = signal(true);
    const start = vi.fn();

    const trayPresence = {
      canRenderProtectedContent,
      isBlocking,
      phase: signal<'waiting' | 'connected'>('waiting'),
      hasUsableCode: signal(true),
      code: signal('BCDF2345'),
      codeSecondsRemaining: signal(600),
      copyState: signal<'idle' | 'copied'>('idle'),
      generationError: signal<string | null>(null),
      start,
      retry: vi.fn(),
      copyCode: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        { provide: TrayPresenceStore, useValue: trayPresence },
        {
          provide: TrayPresenceApiService,
          useValue: { getStatus: vi.fn(), generateActivationCode: vi.fn() }
        },
        {
          provide: AuthStore,
          useValue: { email: signal('buddy@example.test'), logout: vi.fn(), activeModules: signal([]) }
        },
        {
          provide: NavigationStateService,
          useValue: { activeChildren: signal([]), activeItem: signal(null) }
        }
      ]
    });
    TestBed.overrideComponent(MainLayoutComponent, {
      set: {
        imports: [
          RouterOutletStubComponent,
          SideNavbarStubComponent,
          TopNavbarStubComponent,
          SubSidebarStubComponent,
          ToastHostStubComponent,
          MobileBottomNavStubComponent,
          TrayActivationGateComponent,
          LockedWorkspacePreviewStubComponent
        ]
      }
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(start).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-locked-workspace-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-tray-activation-gate')).toBeNull();

    TestBed.resetTestingModule();
  });
});
