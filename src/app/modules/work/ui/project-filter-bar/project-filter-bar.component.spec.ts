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
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }, { id: 'cat2', name: 'Frontend' }], loadCategories: loadCategoriesSpy } }]
    });
    fixture = TestBed.createComponent(ProjectFilterBarComponent);
  });

  it('loads categories on init', () => {
    fixture.detectChanges();
    expect(loadCategoriesSpy).toHaveBeenCalled();
  });

  it('emits the selected category ids as an array', () => {
    fixture.detectChanges();
    let emitted: string[] | undefined;
    fixture.componentInstance.categoriesChanged.subscribe((v) => (emitted = v));

    fixture.componentInstance.selectCategories(['cat1', 'cat2']);

    expect(emitted).toEqual(['cat1', 'cat2']);
  });

  it('emits achievedFilterChanged when a status option is selected', () => {
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.achievedFilterChanged.subscribe((v: string) => (emitted = v));

    fixture.componentInstance.selectStatus('archived');

    expect(emitted).toBe('archived');
  });
});
