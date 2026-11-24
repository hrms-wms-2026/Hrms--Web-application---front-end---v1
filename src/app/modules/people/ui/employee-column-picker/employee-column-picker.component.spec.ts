import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmployeeColumnKey } from '../../models/employee-columns';
import { EmployeeColumnPickerComponent } from './employee-column-picker.component';

@Component({
  standalone: true,
  imports: [EmployeeColumnPickerComponent],
  template: `<app-employee-column-picker [visible]="visible()" (applied)="applied.push($event)" (closed)="closes = closes + 1" />`
})
class HostComponent {
  visible = signal<readonly EmployeeColumnKey[]>(['employee', 'position']);
  applied: EmployeeColumnKey[][] = [];
  closes = 0;
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(id: string) => el.querySelector(`[data-testid="${id}"]`) as T | null;
  return { fixture, q, host: fixture.componentInstance };
}

describe('EmployeeColumnPickerComponent', () => {
  it('shows the current visibility as switches, with employee locked on', async () => {
    const { q } = await setup();
    expect(q('column-toggle-position')!.getAttribute('aria-checked')).toBe('true');
    expect(q('column-toggle-email')!.getAttribute('aria-checked')).toBe('false');
    expect(q<HTMLButtonElement>('column-toggle-employee')!.disabled).toBe(true);
    expect(q('column-toggle-employee')!.getAttribute('aria-checked')).toBe('true');
  });

  it('splits fields into Shown and Hidden with counts', async () => {
    const { q } = await setup();
    expect(q('columns-count-shown')!.textContent!.trim()).toBe('2');
    expect(q('columns-count-hidden')!.textContent!.trim()).toBe('7');
  });

  it('applies each switch straight away, in canonical order', async () => {
    const { q, host } = await setup();
    q('column-toggle-email')!.click();
    expect(host.applied).toEqual([['employee', 'position', 'email']]);
    q('column-toggle-position')!.click();
    expect(host.applied[1]).toEqual(['employee']);
  });

  it('Reset to default emits the default columns', async () => {
    const { q, host } = await setup();
    q('columns-reset')!.click();
    expect(host.applied[0]).toEqual(['employee', 'position', 'department', 'employmentType', 'reportingManager']);
  });

  it('search filters the list by label', async () => {
    const { fixture, q } = await setup();
    const search = q<HTMLInputElement>('columns-search')!;
    search.value = 'mail';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('column-toggle-email')).not.toBeNull();
    expect(q('column-toggle-position')).toBeNull();
  });

  it('the close button emits closed', async () => {
    const { q, host } = await setup();
    q('columns-close')!.click();
    expect(host.closes).toBe(1);
  });
});
