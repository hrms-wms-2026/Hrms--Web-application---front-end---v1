import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { detailFixture } from '../../feature/employee-detail/tabs/employee-detail-tab.testing';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeProfileHeaderComponent } from './employee-profile-header.component';

@Component({
  standalone: true,
  imports: [EmployeeProfileHeaderComponent],
  template: `
    <app-employee-profile-header [employee]="employee">
      <button header-actions type="button">Projected action</button>
    </app-employee-profile-header>
  `
})
class HostComponent {
  employee: EmployeeDetailResponse = detailFixture;
}

describe('EmployeeProfileHeaderComponent', () => {
  it('renders identity, employment facts and projected actions', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('AL');
    expect(text).toContain('E-001');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Engineering');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('Remote');
    expect(text).toContain('15 Jan 2024');
    expect(text).toContain('Projected action');
  });

  it('falls back when position and manager are missing', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.employee = {
      ...detailFixture,
      jobInformation: { ...detailFixture.jobInformation, positionName: null, reportingManagerName: null }
    };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Unassigned Position');
    expect(text).toContain('Unassigned');
  });
});
