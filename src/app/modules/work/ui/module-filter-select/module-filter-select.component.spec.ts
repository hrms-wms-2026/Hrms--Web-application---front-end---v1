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
    fixture.componentRef.setInput('activityFilter', 'all');
    fixture.detectChanges();
  });

  it('renders All modules plus each option in the shared select', () => {
    const select = fixture.nativeElement.querySelector('[data-testid="module-filter-dropdown"] select') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual(['All modules', 'Root', 'Child']);
    expect(select.value).toBe('o1');
  });

  it('emits the selected value when the user changes the module select', () => {
    const emitted: string[] = [];
    fixture.componentInstance.selectionChanged.subscribe((value) => emitted.push(value));

    const select = fixture.nativeElement.querySelector('[data-testid="module-filter-dropdown"] select') as HTMLSelectElement;
    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual(['all']);
  });

  it('renders All/Active/Inactive options for the activity filter select', () => {
    const select = fixture.nativeElement.querySelector('[data-testid="module-activity-filter-dropdown"] select') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual(['All', 'Active', 'Inactive']);
  });

  it('emits the selected value when the user changes the activity filter select', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activityFilterChanged.subscribe((value) => emitted.push(value));

    const select = fixture.nativeElement.querySelector('[data-testid="module-activity-filter-dropdown"] select') as HTMLSelectElement;
    select.value = 'inactive';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual(['inactive']);
  });
});
