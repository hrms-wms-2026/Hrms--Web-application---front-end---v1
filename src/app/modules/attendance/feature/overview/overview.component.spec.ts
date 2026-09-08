import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { OverviewComponent } from './overview.component';

describe('OverviewComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<ComponentFixture<OverviewComponent>> {
    await TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: TimeTrackingStore,
          useValue: {
            today: signal(null), todayLoading: signal(false), actionLoading: signal(false), activeAction: signal(null),
            clockIn: vi.fn(), startBreak: vi.fn(), endBreak: vi.fn(), clockOut: vi.fn(),
            history: signal([]), historyLoading: signal(false), historyError: signal(null), loadMyHistory: vi.fn(() => Promise.resolve()),
            monthlySummary: signal(null), monthlySummaryLoading: signal(false), monthlySummaryError: signal(null), loadMonthlySummary: vi.fn(() => Promise.resolve()),
            myCorrections: signal([]), myCorrectionsLoaded: signal(true), loadMyCorrections: vi.fn(),
            myWorkAreaRequests: signal([]), myWorkAreaRequestsLoaded: signal(true), loadMyWorkAreaRequests: vi.fn(),
            canViewCoveredEmployees: signal(false)
          }
        }
      ]
    }).compileComponents();

    return TestBed.createComponent(OverviewComponent);
  }

  it('renders the status card, weekly trend, monthly health, and requests summary', async () => {
    const fixture = await setup();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-attendance-status-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-trend-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-monthly-health-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-requests-summary-card')).toBeTruthy();
  });

  it('renders a quick link to Time Tracking', async () => {
    const fixture = await setup();
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="quick-link-time-tracking"]');
    expect(link.getAttribute('href')).toContain('/attendance/time-tracking');
  });
});
