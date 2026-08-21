import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModuleFilterSelectComponent } from './module-filter-select.component';

describe('ModuleFilterSelectComponent', () => {
  let fixture: ComponentFixture<ModuleFilterSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleFilterSelectComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ModuleFilterSelectComponent);
    fixture.componentRef.setInput('options', [
      { id: 'o1', title: 'Root' },
      { id: 'o2', title: 'Child' }
    ]);
    fixture.componentRef.setInput('selected', 'o1');
    fixture.detectChanges();
  });

  it('renders All modules plus each option', () => {
    const select = fixture.nativeElement.querySelector('[data-testid="module-filter-select"]') as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent?.trim());
    expect(labels).toEqual(['All modules', 'Root', 'Child']);
    expect(select.value).toBe('o1');
  });

  it('emits the selected value when the user changes the dropdown', () => {
    const emitted: string[] = [];
    fixture.componentInstance.selectionChanged.subscribe((value) => emitted.push(value));

    const select = fixture.nativeElement.querySelector('[data-testid="module-filter-select"]') as HTMLSelectElement;
    select.value = 'all';
    select.dispatchEvent(new Event('input'));
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual(['all']);
  });
});
