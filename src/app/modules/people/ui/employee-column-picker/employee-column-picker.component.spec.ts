import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmployeeColumnKey } from '../../models/employee-columns';
import { EmployeeColumnPickerComponent } from './employee-column-picker.component';

@Component({
  standalone: true,
  imports: [EmployeeColumnPickerComponent],
  template: `<app-employee-column-picker [visible]="visible()" (applied)="applied.push($event)" />`
})
class HostComponent {
  visible = signal<readonly EmployeeColumnKey[]>(['employee', 'position']);
  applied: EmployeeColumnKey[][] = [];
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(id: string) => el.querySelector(`[data-testid="${id}"]`) as T | null;
  const open = () => { q('columns-trigger')!.click(); fixture.detectChanges(); };
  return { fixture, q, open, host: fixture.componentInstance };
}

describe('EmployeeColumnPickerComponent', () => {
  it('opens with the current visibility checked and employee locked', async () => {
    const { q, open } = await setup();
    open();
    expect(q<HTMLInputElement>('column-toggle-position')!.checked).toBe(true);
    expect(q<HTMLInputElement>('column-toggle-email')!.checked).toBe(false);
    expect(q<HTMLInputElement>('column-toggle-employee')!.disabled).toBe(true);
  });

  it('stages toggles and emits canonical order only on Apply', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q<HTMLInputElement>('column-toggle-email')!.click();
    q<HTMLInputElement>('column-toggle-position')!.click();
    q<HTMLInputElement>('column-toggle-department')!.click();
    fixture.detectChanges();
    expect(host.applied).toEqual([]);
    q('columns-apply')!.click();
    fixture.detectChanges();
    expect(host.applied).toEqual([['employee', 'department', 'email']]);
    expect(q('columns-apply')).toBeNull();
  });

  it('Reset restores the defaults in the draft', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q('columns-reset')!.click();
    fixture.detectChanges();
    q('columns-apply')!.click();
    expect(host.applied[0]).toEqual(['employee', 'position', 'department', 'employmentType', 'reportingManager']);
  });

  it('search filters the list by label', async () => {
    const { fixture, q, open } = await setup();
    open();
    const search = q<HTMLInputElement>('columns-search')!;
    search.value = 'mail';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('column-toggle-email')).not.toBeNull();
    expect(q('column-toggle-position')).toBeNull();
  });
});
