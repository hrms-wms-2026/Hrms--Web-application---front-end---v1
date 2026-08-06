import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent],
  template: `<app-page-header title="Departments" subtitle="Manage your org structure"><button>New department</button></app-page-header>`
})
class HostComponent {}

describe('PageHeaderComponent', () => {
  it('renders the title, subtitle, and projected actions', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Departments');
    expect(el.textContent).toContain('Manage your org structure');
    expect(el.querySelector('button')?.textContent).toContain('New department');
  });
});
