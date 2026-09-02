import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeopleFilterSelectComponent } from './people-filter-select.component';

describe('PeopleFilterSelectComponent', () => {
  let fixture: ComponentFixture<PeopleFilterSelectComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PeopleFilterSelectComponent] });
    fixture = TestBed.createComponent(PeopleFilterSelectComponent);
    fixture.componentRef.setInput('options', [
      { employeeId: 'a', name: 'Ann' },
      { employeeId: 'b', name: 'Bob' }
    ]);
    fixture.componentRef.setInput('selected', []);
    fixture.detectChanges();
  });

  it('emits the growing selection as options are toggled', () => {
    const emitted: string[][] = [];
    fixture.componentInstance.selectionChanged.subscribe((v) => emitted.push(v));

    fixture.componentInstance.toggle('a');
    fixture.componentRef.setInput('selected', ['a']);
    fixture.componentInstance.toggle('b');

    expect(emitted).toEqual([['a'], ['a', 'b']]);
  });

  it('clear emits an empty selection', () => {
    fixture.componentRef.setInput('selected', ['a', 'b']);
    let emitted: string[] | undefined;
    fixture.componentInstance.selectionChanged.subscribe((v) => (emitted = v));
    fixture.componentInstance.clear();
    expect(emitted).toEqual([]);
  });

  it('shows a count once people are selected', () => {
    fixture.componentRef.setInput('selected', ['a', 'b']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="people-filter-toggle"]').textContent).toContain('People (2)');
  });
});
