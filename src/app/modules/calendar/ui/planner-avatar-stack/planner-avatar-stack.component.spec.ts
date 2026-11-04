import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { PlannerAvatarStackComponent } from './planner-avatar-stack.component';

describe('PlannerAvatarStackComponent', () => {
  function render(ids: readonly string[], max?: number): HTMLElement {
    TestBed.configureTestingModule({
      imports: [PlannerAvatarStackComponent],
      providers: [{ provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn((id: string) => of({ id, name: id, avatarFileId: null })) } }],
    });
    const fixture = TestBed.createComponent(PlannerAvatarStackComponent);
    fixture.componentRef.setInput('employeeIds', ids);
    if (max !== undefined) fixture.componentRef.setInput('max', max);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the first three people, then "+N" for the rest', () => {
    const el = render(['e1', 'e2', 'e3', 'e4', 'e5']);

    expect(el.querySelectorAll('app-employee-avatar').length).toBe(3);
    expect(el.querySelector('[data-testid="avatar-stack-more"]')!.textContent!.trim()).toBe('+2');
  });

  it('shows one person with no "+0"', () => {
    const el = render(['e1']);

    expect(el.querySelectorAll('app-employee-avatar').length).toBe(1);
    expect(el.querySelector('[data-testid="avatar-stack-more"]')).toBeNull();
  });

  it('draws nothing for no people', () => {
    const el = render([]);

    expect(el.querySelector('[data-testid="avatar-stack"]')).toBeNull();
  });

  it('honours a different max', () => {
    const el = render(['e1', 'e2', 'e3'], 2);

    expect(el.querySelectorAll('app-employee-avatar').length).toBe(2);
    expect(el.querySelector('[data-testid="avatar-stack-more"]')!.textContent!.trim()).toBe('+1');
  });
});
