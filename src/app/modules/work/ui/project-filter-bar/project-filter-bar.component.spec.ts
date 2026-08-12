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

  it('emits categoryChanged when a category option is selected', async () => {
    fixture.detectChanges();
    let emitted: string | null | undefined;
    fixture.componentInstance.categoryChanged.subscribe((v: string | null) => (emitted = v));

    // Open category dropdown
    fixture.componentInstance.toggleCategoryDropdown();
    fixture.detectChanges();

    // Select 'cat1'
    fixture.componentInstance.selectCategory('cat1');
    fixture.detectChanges();

    expect(emitted).toBe('cat1');
  });

  it('emits achievedFilterChanged when a status option is selected', async () => {
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.achievedFilterChanged.subscribe((v: string) => (emitted = v));

    // Open status dropdown
    fixture.componentInstance.toggleStatusDropdown();
    fixture.detectChanges();

    // Select 'archived'
    fixture.componentInstance.selectStatus('archived');
    fixture.detectChanges();

    expect(emitted).toBe('archived');
  });
});
