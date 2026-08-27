import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { WorkPatternDay, WorkPatternResponse } from '../../models/work-pattern.model';
import { WorkPatternCardComponent } from './work-pattern-card.component';

function day(date: string, focusMinutes: number, meetingMinutes: number, adminMinutes: number): WorkPatternDay {
  return { date, focusMinutes, meetingMinutes, adminMinutes };
}

describe('WorkPatternCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(response: WorkPatternResponse | 'error' = { days: [] }): Promise<{
    fixture: ComponentFixture<WorkPatternCardComponent>;
    getMyWorkPattern: ReturnType<typeof vi.fn>;
  }> {
    const getMyWorkPattern = vi.fn(() =>
      response === 'error' ? throwError(() => new Error('network error')) : of(response)
    );

    await TestBed.configureTestingModule({
      imports: [WorkPatternCardComponent],
      providers: [{ provide: WorkPatternApiService, useValue: { getMyWorkPattern } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkPatternCardComponent);
    fixture.detectChanges();
    return { fixture, getMyWorkPattern };
  }

  it('loads the current week work pattern on init', async () => {
    const { getMyWorkPattern } = await setup();
    expect(getMyWorkPattern).toHaveBeenCalledOnce();
    const [from, to] = getMyWorkPattern.mock.calls[0];
    expect(from <= to).toBe(true);
  });

  it('renders one stacked bar per day of the week', async () => {
    const { fixture } = await setup();
    const bars = fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-bar"]');
    expect(bars.length).toBe(7);
  });

  it('renders focus/meeting/admin segments in every bar', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-segment-focus"]').length).toBe(7);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-segment-meeting"]').length).toBe(7);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-segment-admin"]').length).toBe(7);
  });

  it('shows the weekly focus total summed across days', async () => {
    const { fixture } = await setup({
      days: [day('2026-08-24', 180, 0, 0), day('2026-08-25', 120, 0, 0)]
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('5h'); // 180 + 120 = 300 minutes = 5h
  });

  it('falls back to a zero total when the request fails', async () => {
    const { fixture } = await setup('error');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('0h');
  });
});
