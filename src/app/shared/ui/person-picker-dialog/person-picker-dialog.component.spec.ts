import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PeopleApiService } from '../../../modules/people/data-access/people-api.service';
import { PersonPickerDialogComponent, PersonSearch } from './person-picker-dialog.component';

describe('PersonPickerDialogComponent', () => {
  let listEmployees: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    listEmployees = vi.fn(() => of({
      items: [
        { id: 'e2', fullName: 'Zara Khan', email: 'z@x.com', positionName: 'Designer', departmentName: 'Product', avatarFileId: null },
        { id: 'e1', fullName: 'Arun Raj', email: 'a@x.com', positionName: null, departmentName: null, avatarFileId: null }
      ],
      totalCount: 2, page: 1, pageSize: 50
    }));
    TestBed.configureTestingModule({
      imports: [PersonPickerDialogComponent],
      providers: [{ provide: PeopleApiService, useValue: { listEmployees } }]
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(PersonPickerDialogComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const confirmed: string[][] = [];
    fixture.componentInstance.confirmed.subscribe((ids) => confirmed.push(ids));
    const names = () => Array.from(el.querySelectorAll('.ppd__name')).map((n) => n.textContent!.trim());
    return { fixture, el, confirmed, names };
  }

  it('searches the employee directory by default: alphabetical, with job · department (or email) underneath', async () => {
    const { el, names } = await render();

    expect(listEmployees).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 50 });
    expect(names()).toEqual(['Arun Raj', 'Zara Khan']);
    expect(el.textContent).toContain('Designer · Product');
    expect(el.textContent).toContain('a@x.com');
  });

  it('several people: tick, then Add sends them all; people already in are ticked, disabled and labelled', async () => {
    const { fixture, el, confirmed } = await render({ disabledPeople: [{ id: 'e1', name: 'Arun Raj' }], disabledLabel: 'Already a member' });

    const arun = el.querySelector('[data-testid="person-picker-row-e1"] input') as HTMLInputElement;
    expect(arun.checked && arun.disabled).toBe(true);
    expect(el.textContent).toContain('Already a member');
    (el.querySelector('[data-testid="person-picker-row-e2"] input') as HTMLInputElement).click();
    fixture.detectChanges();
    (el.querySelector('[data-testid="person-picker-confirm"]') as HTMLButtonElement).click();

    expect(confirmed).toEqual([['e2']]);
  });

  it('one person: a click picks them, with no checkboxes or Add button', async () => {
    const { el, confirmed } = await render({ multiple: false });

    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(el.querySelector('[data-testid="person-picker-confirm"]')).toBeNull();
    (el.querySelector('[data-testid="person-picker-row-e2"]') as HTMLButtonElement).click();

    expect(confirmed).toEqual([['e2']]);
  });

  it('uses a custom source, debounces typing, and never lists hidden people', async () => {
    const search = vi.fn<PersonSearch>(() => of([{ id: 'me', name: 'Me' }, { id: 'p1', name: 'Priya' }]));
    const { fixture, el, names } = await render({ search, hiddenIds: ['me'] });
    expect(names()).toEqual(['Priya']);

    const input = el.querySelector('[data-testid="person-picker-search"]') as HTMLInputElement;
    input.value = 'pri';
    input.dispatchEvent(new Event('input'));
    expect(search).not.toHaveBeenCalledWith('pri');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(search).toHaveBeenCalledWith('pri');
    expect(listEmployees).not.toHaveBeenCalled();
  });
});
