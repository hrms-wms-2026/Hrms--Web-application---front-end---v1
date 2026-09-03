import { TestBed } from '@angular/core/testing';
import { DepartmentsPlaceholderComponent } from './departments-placeholder.component';

describe('DepartmentsPlaceholderComponent', () => {
  it('shows the "Departments" title and text explaining management is not built yet', async () => {
    await TestBed.configureTestingModule({ imports: [DepartmentsPlaceholderComponent] }).compileComponents();

    const fixture = TestBed.createComponent(DepartmentsPlaceholderComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBe('Departments');
    expect(el.textContent).toContain('subsequent implementation phases');
  });
});
