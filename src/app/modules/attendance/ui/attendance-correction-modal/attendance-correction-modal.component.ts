import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  AttendanceCorrectionBreakRequest,
  AttendanceCorrectionPreviewRequest,
  AttendanceCorrectionType,
  CORRECTION_TYPE_OPTIONS
} from '../../models/attendance-correction.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import {
  DISPLAY_TIMEZONE_FALLBACK,
  dateOnlyForZone,
  formatDate,
  localDateTimeToIso,
  validDisplayTimezone
} from '../../utils/attendance-formatters';

export type CorrectionBreakDraft = { start: string; end: string };

@Component({
  selector: 'app-attendance-correction-modal',
  standalone: true,
  imports: [ButtonComponent, FormsModule, ModalComponent],
  templateUrl: './attendance-correction-modal.component.html',
  styleUrl: './attendance-correction-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceCorrectionModalComponent {
  readonly store = inject(TimeTrackingStore);
  private readonly notifications = inject(NotificationService);

  open = input(false);
  workDate = input<string>('');
  type = model<AttendanceCorrectionType>('clock_in');
  initialClockIn = input<string>('');
  initialClockOut = input<string>('');
  customMaxWidth = input<string>('max-w-3xl');

  closed = output<void>();
  submitted = output<{ status: string }>();

  readonly requestedClockInTime = signal('');
  readonly requestedClockOutTime = signal('');
  readonly correctionReason = signal('');
  readonly correctionNotes = signal('');
  readonly correctionBreaks = signal<CorrectionBreakDraft[]>([{ start: '', end: '' }]);
  readonly correctionFieldErrors = signal<Record<string, string>>({});
  readonly correctionFormMessage = signal('');
  readonly correctionPreviewReady = signal(false);

  readonly correctionTypeOptions = CORRECTION_TYPE_OPTIONS;
  readonly formatDate = formatDate;

  readonly effectiveWorkDate = computed(() => {
    const direct = this.workDate();
    if (direct) return direct;
    return this.store.today()?.workDate ?? '';
  });

  readonly displayTimezone = computed(
    () => this.store.today()?.timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.resetForm();
        });
      }
    });
  }

  resetForm(): void {
    this.requestedClockInTime.set(this.initialClockIn());
    this.requestedClockOutTime.set(this.initialClockOut());
    this.correctionReason.set('');
    this.correctionNotes.set('');
    this.correctionBreaks.set([{ start: '', end: '' }]);
    this.correctionFieldErrors.set({});
    this.correctionFormMessage.set('');
    this.correctionPreviewReady.set(false);
    this.store.clearCorrectionPreview?.();
  }

  closeModal(): void {
    if (this.store.correctionActionLoading?.()) return;
    this.closed.emit();
  }

  addBreakInterval(): void {
    this.correctionBreaks.update((items) => [...items, { start: '', end: '' }]);
  }

  removeBreakInterval(index: number): void {
    this.correctionBreaks.update((items) =>
      items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async previewOrSubmitCorrection(): Promise<void> {
    const request = this.buildCorrectionRequest();
    if (!request) return;

    if (!this.correctionPreviewReady()) {
      const preview = await this.store.previewCorrection(request);
      if (!preview) {
        this.correctionFormMessage.set(
          this.store.correctionError?.() || 'No eligible attendance approver is configured for this employee.'
        );
        return;
      }
      this.correctionPreviewReady.set(true);
      this.correctionFormMessage.set(
        preview.approvalRequired
          ? preview.approver?.positionName
            ? `This request will be sent to ${preview.approver.displayName}, ${preview.approver.positionName}.`
            : preview.approver
              ? `This request will be sent to ${preview.approver.displayName}.`
              : 'No eligible attendance approver is configured for this employee.'
          : 'This correction can be applied without approval.'
      );
      return;
    }

    if (this.store.correctionPreview?.()?.approvalRequired && !this.store.correctionPreview?.()?.approver) {
      this.correctionFormMessage.set('No eligible attendance approver is configured for this employee.');
      return;
    }

    const result = await this.store.submitCorrection(request);
    if (!result) {
      this.correctionFormMessage.set(
        this.store.correctionError?.() || 'Could not submit the correction request. Try again.'
      );
      return;
    }

    this.notifications.success(
      result.status === 'approved' ? 'Attendance correction applied.' : 'Correction request submitted.'
    );
    this.submitted.emit(result);
    this.closed.emit();
  }

  private buildCorrectionRequest(): AttendanceCorrectionPreviewRequest | null {
    const date = this.effectiveWorkDate();
    if (!date) return null;

    const errors: Record<string, string> = {};
    const reason = this.correctionReason().trim();
    if (!reason) errors['reason'] = 'Tell us why this correction is needed.';
    if (reason.length > 255) errors['reason'] = 'Reason must be 255 characters or fewer.';
    if (this.correctionNotes().length > 2000) errors['notes'] = 'Notes must be 2000 characters or fewer.';

    const type = this.type();
    const clockIn =
      type === 'clock_in' || type === 'full_day'
        ? this.toDateTimeOffset(this.requestedClockInTime(), date)
        : null;
    const clockOut =
      type === 'clock_out' || type === 'full_day'
        ? this.toDateTimeOffset(this.requestedClockOutTime(), date)
        : null;

    if (type === 'clock_in' || type === 'full_day') {
      if (!this.requestedClockInTime()) errors['requestedClockInAt'] = 'Enter a clock-in time.';
      else if (!clockIn) errors['requestedClockInAt'] = 'Enter a valid local time.';
    }

    if (type === 'clock_out' || type === 'full_day') {
      if (!this.requestedClockOutTime()) errors['requestedClockOutAt'] = 'Enter a clock-out time.';
      else if (!clockOut) errors['requestedClockOutAt'] = 'Enter a valid local time.';
    }

    if (clockIn && clockOut && new Date(clockOut).getTime() <= new Date(clockIn).getTime()) {
      errors['requestedClockOutAt'] = 'Clock-out must be after clock-in.';
    }

    let requestedBreaks: readonly AttendanceCorrectionBreakRequest[] | null = null;
    if (type === 'break') {
      const intervals = this.correctionBreaks().map((item) => ({
        start: this.toDateTimeOffset(item.start, date),
        end: this.toDateTimeOffset(item.end, date),
        rawStart: item.start,
        rawEnd: item.end
      }));

      if (!intervals.length || intervals.some((item) => !item.rawStart || !item.rawEnd || !item.start || !item.end)) {
        errors['requestedBreaks'] = 'Enter a valid start and end time for each break interval.';
      } else if (intervals.some((item) => new Date(item.end!).getTime() <= new Date(item.start!).getTime())) {
        errors['requestedBreaks'] = 'Each break interval must end after it starts.';
      } else {
        const ordered = [...intervals].sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());
        if (ordered.some((item, index) => index > 0 && new Date(ordered[index - 1].end!).getTime() > new Date(item.start!).getTime())) {
          errors['requestedBreaks'] = 'Break intervals cannot overlap.';
        }
        requestedBreaks = intervals.map((item) => ({
          breakStart: item.start!,
          breakEnd: item.end!,
          breakType: 'other'
        }));
      }
    }

    this.correctionFieldErrors.set(errors);
    this.correctionFormMessage.set(Object.keys(errors).length ? 'Please correct the highlighted fields.' : '');
    if (Object.keys(errors).length) return null;

    return {
      workDate: date,
      correctionType: type,
      requestedClockInAt: clockIn,
      requestedClockOutAt: clockOut,
      requestedBreaks,
      reason,
      notes: this.correctionNotes().trim() || null
    };
  }

  private toDateTimeOffset(value: string, workDate: string): string | null {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    try {
      const timezone = validDisplayTimezone(this.displayTimezone()) ?? DISPLAY_TIMEZONE_FALLBACK;
      const iso = localDateTimeToIso(workDate, value, timezone);
      return iso && dateOnlyForZone(iso, timezone) === workDate ? iso : null;
    } catch {
      return null;
    }
  }
}
