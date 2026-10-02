import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeChecklistOverviewResponse } from '../../models/employee-overview.model';
import { OverviewChecklistsWidgetComponent } from './overview-checklists-widget.component';

describe('OverviewChecklistsWidgetComponent', () => {
  const response: EmployeeChecklistOverviewResponse = {
    groups: [
      { name: 'Onboarding', lifecycleType: 'onboarding', completed: 6, bypassed: 0, total: 8 },
      { name: 'Security training', lifecycleType: 'onboarding', completed: 2, bypassed: 0, total: 2 },
      { name: 'Equipment setup', lifecycleType: 'onboarding', completed: 1, bypassed: 1, total: 3 }
    ]
  };

  function setup(getOverviewChecklists: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewChecklistsWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewChecklists } }]
    });
    const fixture = TestBed.createComponent(OverviewChecklistsWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the checklists for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1');
  });

  it('shows each group with its completed / total count', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="checklist-group"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Onboarding');
    expect(rows[0].textContent).toContain('6 / 8');
    expect(rows[1].textContent).toContain('2 / 2');
  });

  it('sizes each progress bar by completed over total', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const width = (i: number) => (el.querySelectorAll('[data-testid="checklist-bar"]')[i] as HTMLElement).style.width;

    expect(width(0)).toBe('75%');
    expect(width(1)).toBe('100%');
    expect(parseFloat(width(2))).toBeCloseTo(33.33, 1);
  });

  it('notes bypassed tasks separately and marks a finished group', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="checklist-group"]');

    expect(rows[2].textContent).toContain('1 bypassed');
    expect(rows[0].textContent).not.toContain('bypassed');
    expect(rows[1].classList.contains('group--done')).toBe(true);
    expect(rows[0].classList.contains('group--done')).toBe(false);
  });

  it('gives each bar an accessible label', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelectorAll('[role="progressbar"]')[0].getAttribute('aria-label')).toBe('Onboarding: 6 of 8 completed');
  });

  it('shows the empty state when there are no checklist tasks', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ groups: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
    expect(el.style.display).toBe('none');
  });

  it('keeps the host visible when checklist content exists', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.style.display).not.toBe('none');
  });

  it('shows all groups without View all when there are three or fewer', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)));

    (el.querySelector('app-widget-card') as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-testid="checklist-group"]')).toHaveLength(3);
    expect(el.querySelector('[data-testid="checklists-toggle"]')).toBeNull();
    expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(false);
  });

  it('shows three groups, then pops out with all of them on a card click - without another request', () => {
    const get = vi.fn().mockReturnValue(of({
      groups: [
        ...response.groups,
        { name: 'Offboarding', lifecycleType: 'offboarding', completed: 0, bypassed: 0, total: 4 },
        { name: 'Policies', lifecycleType: 'onboarding', completed: 1, bypassed: 0, total: 1 }
      ]
    }));
    const { fixture, el } = setup(get);
    expect(el.querySelectorAll('[data-testid="checklist-group"]')).toHaveLength(3);

    (el.querySelector('app-widget-card') as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(true);
    expect(el.querySelectorAll('[data-testid="checklist-group"]')).toHaveLength(5);

    (el.querySelector('[data-testid="checklists-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="checklist-group"]')).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
