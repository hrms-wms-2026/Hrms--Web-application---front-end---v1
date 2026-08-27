import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { FocusStatusApiService } from '../../data-access/focus-status-api.service';
import { FocusStatus } from '../../models/focus-status.model';
import { WellbeingCarouselCardComponent } from './wellbeing-carousel-card.component';

function makeStatus(overrides: Partial<FocusStatus> = {}): FocusStatus {
  return { isBreakReminderDue: false, continuousFocusMinutes: 0, ...overrides };
}

describe('WellbeingCarouselCardComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  async function setup(
    status: FocusStatus | 'error' = makeStatus()
  ): Promise<{
    fixture: ComponentFixture<WellbeingCarouselCardComponent>;
    getMyFocusStatus: ReturnType<typeof vi.fn>;
    startBreak: ReturnType<typeof vi.fn>;
  }> {
    const getMyFocusStatus = vi.fn(() =>
      status === 'error' ? { subscribe: (obs: any) => obs.error(new Error('boom')) } : of(status)
    );
    const startBreak = vi.fn();
    const store = {
      actionLoading: signal(false),
      startBreak
    };

    await TestBed.configureTestingModule({
      imports: [WellbeingCarouselCardComponent],
      providers: [
        { provide: FocusStatusApiService, useValue: { getMyFocusStatus } },
        { provide: TimeTrackingStore, useValue: store }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(WellbeingCarouselCardComponent);
    fixture.detectChanges();
    return { fixture, getMyFocusStatus, startBreak };
  }

  it('loads focus status on init and shows the first wellbeing tip', async () => {
    const { fixture, getMyFocusStatus } = await setup();
    expect(getMyFocusStatus).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card-title"]').textContent.trim()).toBe('Stay hydrated');
  });

  it('inserts and jumps to the break-reminder card the moment it becomes due', async () => {
    const { fixture } = await setup(makeStatus({ isBreakReminderDue: true, continuousFocusMinutes: 92 }));

    const card = fixture.nativeElement.querySelector('[data-testid="wellbeing-card"]');
    expect(card.getAttribute('data-card-kind')).toBe('reminder');
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card-description"]').textContent).toContain('92 minutes');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="wellbeing-dot"]').length).toBe(5); // 1 reminder + 4 tips
  });

  it('does not show the Start Break button on a plain tip card', async () => {
    const { fixture } = await setup(makeStatus({ isBreakReminderDue: false }));
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-start-break"]')).toBeNull();
  });

  it('shows the Start Break button on the reminder card and calls the store action', async () => {
    const { fixture, startBreak } = await setup(makeStatus({ isBreakReminderDue: true, continuousFocusMinutes: 90 }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="wellbeing-start-break"]');
    expect(button).not.toBeNull();
    button.click();
    expect(startBreak).toHaveBeenCalledOnce();
  });

  it('does not auto-rotate away from an active break-reminder card, but manual next still can', async () => {
    vi.useFakeTimers();
    const { fixture } = await setup(makeStatus({ isBreakReminderDue: true, continuousFocusMinutes: 90 }));

    vi.advanceTimersByTime(6_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card"]').getAttribute('data-card-kind')).toBe('reminder');

    const nextButton: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Next tip"]');
    nextButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card"]').getAttribute('data-card-kind')).not.toBe('reminder');
  });

  it('advances to the next card on manual next click, wrapping around', async () => {
    const { fixture } = await setup();
    const nextButton: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Next tip"]');

    nextButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card-title"]').textContent.trim()).toBe('Check your posture');
  });

  it('auto-rotates to the next card after the rotation interval elapses', async () => {
    vi.useFakeTimers();
    const { fixture } = await setup();

    vi.advanceTimersByTime(6_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card-title"]').textContent.trim()).toBe('Check your posture');
  });

  it('polls focus status again after the poll interval elapses', async () => {
    vi.useFakeTimers();
    const { getMyFocusStatus } = await setup();

    vi.advanceTimersByTime(90_000);

    expect(getMyFocusStatus).toHaveBeenCalledTimes(2);
  });

  it('falls back to a null focus status without crashing on request failure', async () => {
    const { fixture } = await setup('error');
    expect(fixture.nativeElement.querySelector('[data-testid="wellbeing-card-title"]').textContent.trim()).toBe('Stay hydrated');
  });
});
