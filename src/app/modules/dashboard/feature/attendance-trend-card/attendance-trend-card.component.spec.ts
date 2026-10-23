import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceHistoryRow, AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { LegalEntityGeneralSettings } from '../../../organization/models/legal-entity.model';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { AttendanceTrendCardComponent } from './attendance-trend-card.component';

function row(workDate: string, totalWorkedMinutes: number): AttendanceHistoryRow {
  return {
    attendanceRecordId: `record-${workDate}`,
    workDate,
    employee: null,
    clockInAt: null,
    clockOutAt: null,
    isActive: false,
    breakMinutes: 0,
    totalWorkedMinutes,
    expectedWorkMode: null,
    attendanceSource: null,
    status: 'present',
    canViewDetails: false,
    canRequestCorrection: false,
    canRequestWorkAreaChange: false,
    canCorrect: false
  };
}

type StoreMock = {
  history: ReturnType<typeof signal<readonly AttendanceHistoryRow[]>>;
  historyLoading: ReturnType<typeof signal<boolean>>;
  historyError: ReturnType<typeof signal<string | null>>;
  today: ReturnType<typeof signal<AttendanceTodayResponse | null>>;
  loadMyHistory: ReturnType<typeof vi.fn>;
};

function currentMonday(reference = new Date()): string {
  const day = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const offset = day.getDay() === 0 ? -6 : 1 - day.getDay();
  const monday = new Date(day.getTime() + offset * 24 * 60 * 60 * 1000);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function addDays(dateOnly: string, days: number): string {
  const [year, month, date] = dateOnly.split('-').map(Number);
  const shifted = new Date(year, month - 1, date + days);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}

describe('AttendanceTrendCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    history?: readonly AttendanceHistoryRow[];
    today?: AttendanceTodayResponse | null;
    generalSettings?: Partial<LegalEntityGeneralSettings> | null;
    canReadCompanySettings?: boolean;
  } = {}): Promise<{
    fixture: ComponentFixture<AttendanceTrendCardComponent>;
    store: StoreMock;
    loadSettings: ReturnType<typeof vi.fn>;
  }> {
    const store: StoreMock = {
      history: signal(options.history ?? []),
      historyLoading: signal(false),
      historyError: signal(null),
      today: signal(options.today ?? null),
      loadMyHistory: vi.fn(() => Promise.resolve())
    };

    const canRead = options.canReadCompanySettings ?? true;
    const providers: any[] = [
      { provide: TimeTrackingStore, useValue: store },
      { provide: PermissionService, useValue: { hasAnyPermission: () => canRead } }
    ];

    const loadSettings = vi.fn(() => Promise.resolve());
    if (options.generalSettings !== undefined) {
      const gsMock = {
        settings: signal(options.generalSettings),
        legalEntityId: signal(options.generalSettings ? 'le-1' : null),
        load: loadSettings
      };
      providers.push({ provide: GeneralSettingsStore, useValue: gsMock });
    }

    await TestBed.configureTestingModule({
      imports: [AttendanceTrendCardComponent],
      providers
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceTrendCardComponent);
    fixture.detectChanges();
    return { fixture, store, loadSettings };
  }

  const selfServiceToday = { workDate: currentMonday(), legalEntityId: 'le-2', totalWorkedMinutes: 0, requiredWorkMinutes: 540 } as any;

  it('loads company General Settings for a user who may read them', async () => {
    const { loadSettings } = await setup({ today: selfServiceToday, generalSettings: null });
    expect(loadSettings).toHaveBeenCalledWith('le-2');
  });

  it('does not request admin-only General Settings for a self-service user, and uses today\'s scheduled minutes', async () => {
    const { fixture, loadSettings } = await setup({ today: selfServiceToday, generalSettings: null, canReadCompanySettings: false });
    expect(loadSettings).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent as string).toContain('Goal: 9h/day');
  });

  it('loads the current week history on init', async () => {
    const { store } = await setup();
    expect(store.loadMyHistory).toHaveBeenCalledTimes(1);
    const range = store.loadMyHistory.mock.calls[0][0];
    expect(range.from <= range.to).toBe(true);
  });

  it('shows the weekly total against the 40h fallback goal when settings not present', async () => {
    const monday = currentMonday();
    const { fixture } = await setup({ history: [row(monday, 456), row(addDays(monday, 1), 504)] });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('16h');
    expect(text).toContain('40h');
    expect(text).toContain('Goal: 8h/day');
  });

  it('renders one bar per day of the week', async () => {
    const { fixture } = await setup({ history: [row(currentMonday(), 456)] });
    const bars = fixture.nativeElement.querySelectorAll('[data-testid="attendance-trend-bar"]');
    expect(bars.length).toBe(7);
  });

  it('does not count history rows that fall outside the plotted week toward the total', async () => {
    const monday = currentMonday();
    const outsideWeek = addDays(monday, -14);
    const { fixture } = await setup({ history: [row(outsideWeek, 999)] });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('0h');
    expect(text).not.toContain('999');
  });

  it('dynamically computes weekly goal and daily goal from GeneralSettings company work hours and working days', async () => {
    // 06:46 to 12:46 = 6 hours (360 mins). 5 working days -> 6h * 5 = 30h weekly goal.
    const monday = currentMonday();
    const { fixture } = await setup({
      history: [row(monday, 360)],
      generalSettings: {
        workStartTime: '06:46',
        workEndTime: '12:46',
        breakDurationMinutes: 0,
        standardWorkingDays: [1, 2, 3, 4, 5]
      } as any
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('6h / 30h');
    expect(text).toContain('Goal: 6h/day');
  });

  it('multiplies company work hours with working days count when 6 days are configured', async () => {
    // 06:46 to 12:46 = 6 hours (360 mins). 6 working days -> 6h * 6 = 36h weekly goal.
    const { fixture } = await setup({
      generalSettings: {
        workStartTime: '06:46',
        workEndTime: '12:46',
        breakDurationMinutes: 0,
        standardWorkingDays: [1, 2, 3, 4, 5, 6]
      } as any
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('0h / 36h');
    expect(text).toContain('Goal: 6h/day');
  });

  it('falls back to today attendance requiredWorkMinutes when general settings are unavailable', async () => {
    // today requiredWorkMinutes = 360 (6 hours), default 5 days = 30h.
    const { fixture } = await setup({
      today: {
        workDate: currentMonday(),
        clockInAt: null,
        clockOutAt: null,
        totalWorkedMinutes: 120,
        requiredWorkMinutes: 360,
        shiftName: 'Morning Shift',
        workMode: 'office',
        expectedWorkMode: 'office',
        status: 'present',
        activeSession: null,
        canClockIn: false,
        canClockOut: true,
        canStartBreak: false,
        canEndBreak: false,
        canChangeWorkMode: true,
        canRequestCorrection: true,
        canRequestWorkAreaChange: true
      } as any
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('2h / 30h');
    expect(text).toContain('Goal: 6h/day');
  });
});
