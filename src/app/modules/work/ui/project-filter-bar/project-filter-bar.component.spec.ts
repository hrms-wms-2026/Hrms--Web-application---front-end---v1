import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectFilterBarComponent } from './project-filter-bar.component';
import { ProjectCategoryStore } from '../../state/project-category.store';

describe('ProjectFilterBarComponent', () => {
  let fixture: ComponentFixture<ProjectFilterBarComponent>;
  let loadCategoriesSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadCategoriesSpy = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ProjectFilterBarComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: loadCategoriesSpy } }]
    });
    fixture = TestBed.createComponent(ProjectFilterBarComponent);
  });

  it('loads categories on init', () => {
    fixture.detectChanges();
    expect(loadCategoriesSpy).toHaveBeenCalled();
  });

  it('emits categoryChanged when the category select changes', () => {
    fixture.detectChanges();
    let emitted: string | null | undefined;
    fixture.componentInstance.categoryChanged.subscribe((v: string | null) => (emitted = v));

    const select: HTMLSelectElement = fixture.nativeElement.querySelectorAll('select')[0];
    select.value = 'cat1';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toBe('cat1');
  });

  it('emits achievedFilterChanged when the status select changes', () => {
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.achievedFilterChanged.subscribe((v: string) => (emitted = v));

    const select: HTMLSelectElement = fixture.nativeElement.querySelectorAll('select')[1];
    select.value = 'archived';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toBe('archived');
  });
});
