import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkDropdownComponent } from './work-dropdown.component';

const OPTIONS = [
  { value: 'a', label: 'Ann' },
  { value: 'b', label: 'Bob' },
  { value: 'c', label: 'Cy' }
];

describe('WorkDropdownComponent', () => {
  let fixture: ComponentFixture<WorkDropdownComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WorkDropdownComponent] });
    fixture = TestBed.createComponent(WorkDropdownComponent);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('selected', 'a');
  });

  describe('single-select (default)', () => {
    it('emits selectionChanged and closes the menu when an option is picked', () => {
      fixture.detectChanges();
      fixture.componentInstance.open.set(true);
      let emitted: string | undefined;
      fixture.componentInstance.selectionChanged.subscribe((v) => (emitted = v));

      fixture.componentInstance.select('b', new Event('click'));

      expect(emitted).toBe('b');
      expect(fixture.componentInstance.open()).toBe(false);
    });
  });

  describe('multiple-select mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('multiple', true);
      fixture.componentRef.setInput('values', []);
      fixture.componentRef.setInput('allLabel', 'All people');
      fixture.detectChanges();
    });

    it('shows the allLabel on the trigger when nothing is selected', () => {
      const trigger = fixture.nativeElement.querySelector('.work-dropdown__trigger');
      expect(trigger.textContent).toContain('All people');
    });

    it('shows a count on the trigger once values are selected', () => {
      fixture.componentRef.setInput('values', ['a', 'b']);
      fixture.detectChanges();
      const trigger = fixture.nativeElement.querySelector('.work-dropdown__trigger');
      expect(trigger.textContent).toContain('2 selected');
    });

    it('emits the growing selection as options are toggled', () => {
      const emitted: string[][] = [];
      fixture.componentInstance.valuesChanged.subscribe((v) => emitted.push(v));

      fixture.componentInstance.toggleValue('a');
      fixture.componentRef.setInput('values', ['a']);
      fixture.componentInstance.toggleValue('b');

      expect(emitted).toEqual([['a'], ['a', 'b']]);
    });

    it('removes an already-selected value when toggled again', () => {
      fixture.componentRef.setInput('values', ['a', 'b']);
      let emitted: string[] | undefined;
      fixture.componentInstance.valuesChanged.subscribe((v) => (emitted = v));

      fixture.componentInstance.toggleValue('a');

      expect(emitted).toEqual(['b']);
    });

    it('keeps the menu open after a toggle', () => {
      fixture.componentInstance.open.set(true);
      fixture.componentInstance.toggleValue('a');
      expect(fixture.componentInstance.open()).toBe(true);
    });

    it('toggles a value when its rendered option is clicked', () => {
      let emitted: string[] | undefined;
      fixture.componentInstance.valuesChanged.subscribe((v) => (emitted = v));
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();

      const firstOption = fixture.nativeElement.querySelector('.work-dropdown__option') as HTMLButtonElement;
      firstOption.click();

      expect(emitted).toEqual(['a']);
      expect(fixture.componentInstance.open()).toBe(true);
    });

    it('renders a filled checkbox for selected options and an empty one otherwise', () => {
      fixture.componentRef.setInput('values', ['a']);
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();

      const checkboxes = fixture.nativeElement.querySelectorAll('.work-dropdown__checkbox');
      expect(checkboxes[0].classList).toContain('work-dropdown__checkbox--on');
      expect(checkboxes[1].classList).not.toContain('work-dropdown__checkbox--on');
    });

    it('clearValues emits an empty selection', () => {
      fixture.componentRef.setInput('values', ['a', 'b']);
      let emitted: string[] | undefined;
      fixture.componentInstance.valuesChanged.subscribe((v) => (emitted = v));

      fixture.componentInstance.clearValues(new Event('click'));

      expect(emitted).toEqual([]);
    });
  });

  describe('size', () => {
    it('applies the compact trigger class when size is "sm"', () => {
      fixture.componentRef.setInput('size', 'sm');
      fixture.detectChanges();
      const trigger = fixture.nativeElement.querySelector('.work-dropdown__trigger');
      expect(trigger.classList).toContain('work-dropdown__trigger--sm');
    });
  });
});
