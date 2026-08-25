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

  it('renders All modules plus each option in the shared menu', () => {
    const host = fixture.nativeElement.querySelector('[data-testid="module-filter-dropdown"]') as HTMLElement;
    const trigger = host.querySelector('.work-dropdown__trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Root');

    trigger.click();
    fixture.detectChanges();
    const labels = Array.from(host.querySelectorAll('.work-dropdown__option')).map((option) => option.textContent?.trim());
    expect(labels).toEqual(['All modules', 'Root', 'Child']);
  });

  it('emits the selected value when the user changes the dropdown', () => {
    const emitted: string[] = [];
    fixture.componentInstance.selectionChanged.subscribe((value) => emitted.push(value));

    const host = fixture.nativeElement.querySelector('[data-testid="module-filter-dropdown"]') as HTMLElement;
    host.querySelector('.work-dropdown__trigger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    const option = Array.from(host.querySelectorAll('.work-dropdown__option')).find((item) => item.textContent?.trim() === 'All modules') as HTMLButtonElement;
    option.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['all']);
  });

  it('renders All/Active/Inactive options for the activity filter menu', () => {
    const host = fixture.nativeElement.querySelector('[data-testid="module-activity-filter-dropdown"]') as HTMLElement;
    host.querySelector('.work-dropdown__trigger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    const labels = Array.from(host.querySelectorAll('.work-dropdown__option')).map((option) => option.textContent?.trim());
    expect(labels).toEqual(['All', 'Active', 'Inactive']);
  });

  it('emits the selected value when the user changes the activity filter dropdown', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activityFilterChanged.subscribe((value) => emitted.push(value));

    const host = fixture.nativeElement.querySelector('[data-testid="module-activity-filter-dropdown"]') as HTMLElement;
    host.querySelector('.work-dropdown__trigger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    const option = Array.from(host.querySelectorAll('.work-dropdown__option')).find((item) => item.textContent?.trim() === 'Inactive') as HTMLButtonElement;
    option.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['inactive']);
  });
});
