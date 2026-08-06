import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HasPermissionDirective } from './has-permission.directive';
import { PermissionService } from '../../core/auth/state/permission.service';

@Component({
  imports: [HasPermissionDirective],
  template: `<div *appHasPermission="required()" class="gated">secret</div>`
})
class HostComponent {
  readonly required = signal<string | readonly string[] | undefined>(undefined);
}

describe('HasPermissionDirective', () => {
  function setup(hasPermission: boolean, hasAnyPermission = hasPermission) {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: PermissionService,
          useValue: { hasPermission: () => hasPermission, hasAnyPermission: () => hasAnyPermission }
        }
      ]
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the host template when the single required permission is granted', () => {
    const fixture = setup(true);
    fixture.componentInstance.required.set('org:manage');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gated')).toBeTruthy();
  });

  it('removes the host template when the single required permission is missing', () => {
    const fixture = setup(false);
    fixture.componentInstance.required.set('org:manage');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gated')).toBeFalsy();
  });

  it('renders when any permission in an array is granted', () => {
    const fixture = setup(false, true);
    fixture.componentInstance.required.set(['org:read', 'org:manage']);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gated')).toBeTruthy();
  });

  it('renders unconditionally when no permission is specified', () => {
    const fixture = setup(false, false);
    fixture.componentInstance.required.set(undefined);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gated')).toBeTruthy();
  });

  it('toggles the view off when the required permission changes to one the user lacks', () => {
    const fixture = setup(true, true);
    fixture.componentInstance.required.set('org:manage');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.gated')).toBeTruthy();
  });
});
