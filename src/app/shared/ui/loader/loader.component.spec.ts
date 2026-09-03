import { TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  it('renders a status role with aria-busy', async () => {
    await TestBed.configureTestingModule({ imports: [LoaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const status = el.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the label when provided', async () => {
    await TestBed.configureTestingModule({ imports: [LoaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('label', 'Loading employees');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading employees');
  });
});
