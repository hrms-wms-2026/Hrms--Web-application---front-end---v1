import { TestBed } from '@angular/core/testing';
import { PositionsPlaceholderComponent } from './positions-placeholder.component';

describe('PositionsPlaceholderComponent', () => {
  it('shows the "Positions" title and text explaining management is not built yet', async () => {
    await TestBed.configureTestingModule({ imports: [PositionsPlaceholderComponent] }).compileComponents();

    const fixture = TestBed.createComponent(PositionsPlaceholderComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBe('Positions');
    expect(el.textContent).toContain('subsequent implementation phases');
  });
});
