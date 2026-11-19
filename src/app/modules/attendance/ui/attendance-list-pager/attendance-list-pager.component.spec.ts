import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceListPagerComponent } from './attendance-list-pager.component';

function setup(inputs: { page: number; pageSize: number; totalCount: number; busy?: boolean }) {
  const fixture = TestBed.createComponent(AttendanceListPagerComponent);
  fixture.componentRef.setInput('page', inputs.page);
  fixture.componentRef.setInput('pageSize', inputs.pageSize);
  fixture.componentRef.setInput('totalCount', inputs.totalCount);
  if (inputs.busy !== undefined) fixture.componentRef.setInput('busy', inputs.busy);
  fixture.detectChanges();
  const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tt-pagination-buttons button');
  return { fixture, buttons };
}

describe('AttendanceListPagerComponent', () => {
  it('renders nothing when everything fits on one page', () => {
    const { fixture } = setup({ page: 1, pageSize: 20, totalCount: 20 });
    expect((fixture.nativeElement as HTMLElement).querySelector('.tt-pagination')).toBeNull();
  });

  it('shows the page position and emits the neighbouring page', () => {
    const { fixture, buttons } = setup({ page: 2, pageSize: 10, totalCount: 25 });
    const changed = vi.fn();
    fixture.componentInstance.pageChanged.subscribe(changed);
    expect((fixture.nativeElement as HTMLElement).querySelector('.tt-pagination-info')?.textContent).toContain('Page 2 of 3');
    buttons[0].click();
    buttons[1].click();
    expect(changed.mock.calls).toEqual([[1], [3]]);
  });

  it('disables Previous on the first page and Next on the last page', () => {
    expect(setup({ page: 1, pageSize: 10, totalCount: 25 }).buttons[0].disabled).toBe(true);
    expect(setup({ page: 3, pageSize: 10, totalCount: 25 }).buttons[1].disabled).toBe(true);
  });

  it('disables both buttons while busy', () => {
    const { buttons } = setup({ page: 2, pageSize: 10, totalCount: 25, busy: true });
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });
});
