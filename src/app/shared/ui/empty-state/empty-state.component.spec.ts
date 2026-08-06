import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  standalone: true,
  imports: [EmptyStateComponent],
  template: `<app-empty-state title="No departments yet" description="Create your first department to get started."><button>Create</button></app-empty-state>`
})
class HostComponent {}

describe('EmptyStateComponent', () => {
  it('renders title, description, and projected content', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No departments yet');
    expect(el.textContent).toContain('Create your first department to get started.');
    expect(el.querySelector('button')?.textContent).toContain('Create');
  });
});
