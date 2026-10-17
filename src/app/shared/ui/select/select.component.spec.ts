import { TestBed } from '@angular/core/testing';
import { SelectComponent, SelectOption } from './select.component';
import { openSelect, openSelectOptions, pickSelectOption, selectDisplayText, selectTrigger } from './select.testing';

const COUNTRIES: SelectOption[] = [
  { value: 'us', label: 'United States' },
  { value: 'in', label: 'India' }
];

function create(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(SelectComponent);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return fixture;
}

describe('SelectComponent', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.replaceChildren()));

  it('shows the bound value label on the trigger and lists every option when opened', () => {
    const fixture = create({ options: COUNTRIES, value: 'in' });
    const host = fixture.nativeElement as HTMLElement;

    expect(selectDisplayText(host)).toBe('India');
    const options = openSelect(host, () => fixture.detectChanges());
    expect(options.map((o) => o.textContent?.trim())).toEqual(['United States', 'India']);
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });

  it('emits valueChange and closes when an option is picked', () => {
    const fixture = create({ options: COUNTRIES });
    let emitted: string | undefined;
    fixture.componentInstance.valueChange.subscribe((value) => (emitted = value));

    pickSelectOption(fixture.nativeElement, 'United States', () => fixture.detectChanges());

    expect(emitted).toBe('us');
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('shows the placeholder when nothing is selected', () => {
    const fixture = create({ options: COUNTRIES, placeholder: 'Select a country' });
    expect(selectDisplayText(fixture.nativeElement)).toBe('Select a country');
  });

  it('renders the leading icon', () => {
    const fixture = create({ options: [{ value: 'all', label: 'All modules' }], value: 'all', icon: 'module' });
    expect(fixture.nativeElement.querySelector('[data-testid="select-leading-icon"]')).not.toBeNull();
  });

  it('renders disabled options as disabled and ignores clicks on them', () => {
    const fixture = create({
      options: [
        { value: 'open', label: 'Software Engineer' },
        { value: 'full', label: 'Project Manager', disabled: true }
      ]
    });
    let emitted: string | undefined;
    fixture.componentInstance.valueChange.subscribe((value) => (emitted = value));

    const options = openSelect(fixture.nativeElement, () => fixture.detectChanges());
    expect(options[0].disabled).toBe(false);
    expect(options[1].disabled).toBe(true);
    fixture.componentInstance.select({ value: 'full', label: 'Project Manager', disabled: true });
    expect(emitted).toBeUndefined();
  });

  it('shows a search box by default and filters by it', () => {
    const fixture = create({ options: COUNTRIES });
    openSelect(fixture.nativeElement, () => fixture.detectChanges());
    expect(document.querySelector('[data-testid="select-search"]')).not.toBeNull();
    fixture.componentInstance.query.set('ind');
    fixture.detectChanges();
    expect(openSelectOptions().map((o) => o.textContent?.trim())).toEqual(['India']);
  });

  it('hides the search box when searchable is false', () => {
    const fixture = create({ options: COUNTRIES, searchable: false });
    openSelect(fixture.nativeElement, () => fixture.detectChanges());
    expect(document.querySelector('[data-testid="select-search"]')).toBeNull();
  });

  it('shows vacancy markers as badges only when vacancyBadges is on', () => {
    const fixture = create({
      options: [{ value: 'eng', label: 'Engineer [3]' }, { value: 'pm', label: 'PM [No vacancy]' }],
      vacancyBadges: true
    });
    const options = openSelect(fixture.nativeElement, () => fixture.detectChanges());
    expect(options[0].textContent).toContain('Engineer');
    expect(options[0].textContent).toContain('3 open');
    expect(options[1].textContent).toContain('No vacancy');
  });

  it('does not open when disabled', () => {
    const fixture = create({ options: COUNTRIES, disabled: true });
    expect(selectTrigger(fixture.nativeElement).disabled).toBe(true);
    fixture.componentInstance.openPanel();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});
