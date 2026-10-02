import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceCorrectionModalComponent } from './attendance-correction-modal.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { AttendanceTodayResponse } from '../../models/time-tracking.model';

describe('AttendanceCorrectionModalComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    open = true,
    today: Partial<AttendanceTodayResponse> | null = { workDate: '2026-09-09', timezone: 'UTC' }
  ): Promise<ComponentFixture<AttendanceCorrectionModalComponent>> {
    await TestBed.configureTestingModule({
      imports: [AttendanceCorrectionModalComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: {
            today: signal(today as AttendanceTodayResponse | null),
            correctionActionLoading: signal(false),
            correctionError: signal(null),
            correctionPreview: signal(null),
            previewCorrection: vi.fn(),
            submitCorrection: vi.fn(),
            clearCorrectionPreview: vi.fn()
          }
        },
        {
          provide: NotificationService,
          useValue: {
            success: vi.fn(),
            error: vi.fn()
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceCorrectionModalComponent);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the modal when open is true with max-w-3xl width', async () => {
    const fixture = await setup(true);
    const dialog: HTMLElement | null = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.classList.contains('max-w-3xl')).toBe(true);
  });

  it('does not render dialog content when open is false', async () => {
    const fixture = await setup(false);
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('validates that reason and clock-in time are required', async () => {
    const fixture = await setup(true);
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.componentInstance.correctionFieldErrors()['reason']).toBe('Tell us why this correction is needed.');
    expect(fixture.componentInstance.correctionFieldErrors()['requestedClockInAt']).toBe('Enter a clock-in time.');
  });

  it('emits closed event when cancel button is clicked', async () => {
    const fixture = await setup(true);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const cancelButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.correction-form__actions button'
    );
    cancelButton?.click();

    expect(closedSpy).toHaveBeenCalled();
  });
});
