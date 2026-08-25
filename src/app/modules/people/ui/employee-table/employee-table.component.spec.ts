import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { EmployeeTableComponent } from './employee-table.component';

describe('EmployeeTableComponent', () => {
  let fixture: ComponentFixture<EmployeeTableComponent>;

  const warningSummary = {
    showNotClockedInWarning: true,
    shouldHaveClockedIn: true,
    hasClockedInToday: false,
    workDate: '2026-08-21',
    timezone: 'Asia/Colombo',
    scheduledStartTime: '09:00',
    warningLabel: 'Still has not clocked in'
  } as const;

  const employee: EmployeeListItemResponse = {
    id: 'emp-1',
    employeeNumber: 'E-001',
    fullName: 'Ada Lovelace',
    email: 'ada@test.dev',
    departmentId: 'dept-1',
    departmentName: 'Engineering',
    positionId: 'pos-1',
    positionName: 'Software Engineer',
    legalEntityId: 'le-1',
    legalEntityName: 'Acme Co',
    employmentTypeLabel: 'Full-time',
    status: 'active',
    reportingManagerId: 'mgr-1',
    reportingManagerName: 'Grace Hopper'
  };

  async function setup(employees: readonly EmployeeListItemResponse[]) {
    await TestBed.configureTestingModule({
      imports: [EmployeeTableComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeTableComponent);
    fixture.componentRef.setInput('employees', employees);
    fixture.detectChanges();
  }

  it('renders the empty state when there are no employees', async () => {
    await setup([]);
    expect(fixture.nativeElement.textContent).toContain('No employees found');
  });

  it('renders employee rows with resolved names, not raw ids', async () => {
    await setup([employee]);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Engineering');
    expect(text).toContain('Acme Co');
    expect(text).toContain('Grace Hopper');
    expect(text).not.toContain('emp-1');
    expect(text).not.toContain('pos-1');
  });

  it('shows "Unassigned" rather than a blank cell when there is no reporting manager', async () => {
    await setup([{ ...employee, reportingManagerId: null, reportingManagerName: null }]);
    expect(fixture.nativeElement.textContent).toContain('Unassigned');
  });

  it('attaches routerLink to employee row and does not render Actions column or View link', async () => {
    await setup([employee]);
    const linkDe = fixture.debugElement.query(By.directive(RouterLink));
    expect(linkDe).not.toBeNull();
    expect(linkDe.nativeElement.classList.contains('emp-row')).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Actions');
    expect(fixture.nativeElement.querySelector('.emp-view-link')).toBeNull();
  });

  it('renders green status dot for active employee and red status dot for inactive employee on profile avatar', async () => {
    await setup([employee, { ...employee, id: 'emp-2', status: 'inactive' }]);

    const activeDot = fixture.nativeElement.querySelector('.emp-status-dot-avatar--active');
    expect(activeDot).not.toBeNull();

    const inactiveDot = fixture.nativeElement.querySelector('.emp-status-dot-avatar--inactive');
    expect(inactiveDot).not.toBeNull();

    expect(fixture.nativeElement.querySelector('.col-status')).toBeNull();
  });

  it('renders a red warning ring and friendly hover/focus text for a warning employee', async () => {
    await setup([{ ...employee, attendanceSummary: warningSummary }]);

    const warningAvatar = fixture.nativeElement.querySelector('.emp-avatar-wrapper--warning') as HTMLElement | null;
    expect(warningAvatar).not.toBeNull();
    expect(warningAvatar?.getAttribute('title')).toBe('Still has not clocked in');
    expect(warningAvatar?.getAttribute('aria-label')).toBe('Still has not clocked in');
    expect(warningAvatar?.getAttribute('role')).toBe('img');
    expect(warningAvatar?.getAttribute('tabindex')).toBe('0');
    expect(fixture.nativeElement.querySelector('.emp-attendance-warning-tooltip')?.textContent).toContain(
      'Still has not clocked in'
    );
  });

  it('does not render a warning ring or tooltip when attendanceSummary is null', async () => {
    await setup([{ ...employee, attendanceSummary: null }]);

    expect(fixture.nativeElement.querySelector('.emp-avatar-wrapper--warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('.emp-attendance-warning-tooltip')).toBeNull();
    expect(fixture.nativeElement.querySelector('.emp-avatar-wrapper')?.getAttribute('title')).toBeNull();
  });

  it('does not render a warning ring or tooltip when the backend warning flag is false', async () => {
    await setup([
      {
        ...employee,
        attendanceSummary: { ...warningSummary, showNotClockedInWarning: false, shouldHaveClockedIn: false }
      }
    ]);

    expect(fixture.nativeElement.querySelector('.emp-avatar-wrapper--warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('.emp-attendance-warning-tooltip')).toBeNull();
  });

  it('prioritizes warningLabel, then attentionLabel, and never exposes attentionType', async () => {
    await setup([
      {
        ...employee,
        attendanceSummary: {
          ...warningSummary,
          warningLabel: 'Arrived late today',
          attentionLabel: 'Friendly attention text',
          attentionType: 'not_clocked_in'
        }
      }
    ]);

    const warningAvatar = fixture.nativeElement.querySelector('.emp-avatar-wrapper--warning') as HTMLElement;
    expect(warningAvatar.getAttribute('title')).toBe('Arrived late today');
    expect(warningAvatar.getAttribute('aria-label')).toBe('Arrived late today');
    expect(fixture.nativeElement.textContent).not.toContain('not_clocked_in');
  });

  it('falls back to a friendly not-clocked-in message when warning labels are absent', async () => {
    await setup([
      {
        ...employee,
        attendanceSummary: {
          ...warningSummary,
          warningLabel: null,
          attentionLabel: null,
          attentionType: 'not_clocked_in'
        }
      }
    ]);

    const warningAvatar = fixture.nativeElement.querySelector('.emp-avatar-wrapper--warning') as HTMLElement;
    expect(warningAvatar.getAttribute('title')).toBe('Still has not clocked in');
    expect(fixture.nativeElement.querySelector('.emp-attendance-warning-tooltip')?.textContent).toContain(
      'Still has not clocked in'
    );
    expect(fixture.nativeElement.textContent).not.toContain('not_clocked_in');
  });

  it('renders generic attention using its friendly label and severity class', async () => {
    await setup([
      {
        ...employee,
        id: 'emp-warning-attention',
        attendanceSummary: {
          ...warningSummary,
          showNotClockedInWarning: false,
          attentionType: 'worked_during_time_off',
          attentionSeverity: 'warning',
          attentionLabel: 'Worked during approved time off'
        }
      },
      {
        ...employee,
        id: 'emp-critical-attention',
        attendanceSummary: {
          ...warningSummary,
          showNotClockedInWarning: false,
          attentionType: 'over_break',
          attentionSeverity: 'critical',
          attentionLabel: 'Break time exceeded'
        }
      },
      {
        ...employee,
        id: 'emp-neutral-attention',
        attendanceSummary: {
          ...warningSummary,
          showNotClockedInWarning: false,
          attentionType: 'informational',
          attentionSeverity: 'info',
          attentionLabel: 'Schedule information'
        }
      }
    ]);

    const attentionElements = fixture.nativeElement.querySelectorAll('.emp-attention-indicator') as NodeListOf<HTMLElement>;
    expect(attentionElements[0].textContent).toContain('Worked during approved time off');
    expect(attentionElements[0].classList.contains('emp-attention--warning')).toBe(true);
    expect(attentionElements[1].classList.contains('emp-attention--critical')).toBe(true);
    expect(attentionElements[2].classList.contains('emp-attention--neutral')).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('worked_during_time_off');
    expect(fixture.nativeElement.textContent).not.toContain('over_break');
  });

  it('renders backend break overage minutes and avoids duplicate break attention text', async () => {
    await setup([
      {
        ...employee,
        id: 'emp-overage',
        attendanceSummary: {
          ...warningSummary,
          showNotClockedInWarning: false,
          attentionLabel: 'Break time exceeded',
          attentionSeverity: 'critical',
          breakOverageMinutes: 15,
          isOverBreakAllowance: true
        }
      }
    ]);

    expect(fixture.nativeElement.querySelector('.emp-break-overage-marker')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Break time exceeded');

    fixture.componentRef.setInput('employees', [
      {
        ...employee,
        id: 'emp-overage-only',
        attendanceSummary: {
          ...warningSummary,
          showNotClockedInWarning: false,
          attentionLabel: null,
          breakOverageMinutes: 15,
          isOverBreakAllowance: true
        }
      }
    ]);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector('.emp-break-overage-marker');
    expect(marker?.textContent).toContain('Break exceeded by 15 min');
  });

  it('renders no attendance markers when the summary is absent', async () => {
    await setup([{ ...employee, attendanceSummary: null }]);

    expect(fixture.nativeElement.querySelector('.emp-attention-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('.emp-break-overage-marker')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('undefined');
    expect(fixture.nativeElement.textContent).not.toContain('null');
  });

  it('renders employees in the backend-provided order without client-side sorting', async () => {
    const normalEmployee = { ...employee, id: 'emp-normal', fullName: 'Ada Normal' };
    const warningEmployee = { ...employee, id: 'emp-warning', fullName: 'Zoe Warning', attendanceSummary: warningSummary };
    await setup([warningEmployee, normalEmployee]);

    const nameElements = fixture.nativeElement.querySelectorAll('.emp-name') as NodeListOf<HTMLElement>;
    const names = Array.from(nameElements).map((element) => element.textContent?.trim());
    expect(names).toEqual(['Zoe Warning', 'Ada Normal']);
  });
});
