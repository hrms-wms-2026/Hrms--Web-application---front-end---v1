import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { QuickSearchCommand } from './quick-search.commands';
import { QuickSearchDialogComponent } from './quick-search-dialog.component';
import { QuickSearchService } from './quick-search.service';

const commands: QuickSearchCommand[] = [
  { id: 'home', label: 'Home', group: 'Pages', icon: 'home', route: '/dashboard' },
  { id: 'settings-users', label: 'Users', group: 'Pages', hint: 'Settings', icon: 'settings', route: '/settings/users' },
  { id: 'action-request-time-off', label: 'Request time off', group: 'Actions', run: 'request-time-off' }
];

const asha: QuickSearchCommand = {
  id: 'person-e1',
  label: 'Asha Perera',
  group: 'People',
  hint: 'Designer',
  route: '/people/employees/e1',
  person: { name: 'Asha Perera', avatarUrl: null }
};

function setup(recent: QuickSearchCommand[] = [], options: { canSearchPeople?: boolean; people?: QuickSearchCommand[] } = {}) {
  const service = {
    commands: signal(commands),
    recent: signal(recent),
    canSearchPeople: signal(options.canSearchPeople ?? false),
    searchPeople: vi.fn(() => of(options.people ?? [])),
    execute: vi.fn(),
    close: vi.fn()
  };
  TestBed.configureTestingModule({
    imports: [QuickSearchDialogComponent],
    providers: [{ provide: QuickSearchService, useValue: service }]
  });
  const fixture = TestBed.createComponent(QuickSearchDialogComponent);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  const input = el.querySelector('input') as HTMLInputElement;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (k: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    fixture.detectChanges();
  };
  const titles = () => Array.from(el.querySelectorAll('.quick-search__section-title')).map((t) => t.textContent?.trim());
  const labels = () => Array.from(el.querySelectorAll('.quick-search__label')).map((t) => t.textContent?.trim());
  return { service, el, fixture, type, key, titles, labels };
}

describe('QuickSearchDialogComponent', () => {
  // jsdom has no layout, so no scrollIntoView.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('lists Recent, Pages and Actions when nothing is typed', () => {
    const { titles, labels } = setup([commands[1]]);
    expect(titles()).toEqual(['Recent', 'Pages', 'Actions']);
    expect(labels()).toEqual(['Users', 'Home', 'Users', 'Request time off']);
  });

  it('filters as you type and says when nothing matches', () => {
    const { type, labels, el } = setup();
    type('user');
    expect(labels()).toEqual(['Users']);
    type('qwerty');
    expect(labels()).toEqual([]);
    expect(el.querySelector('.quick-search__empty')?.textContent).toContain('qwerty');
  });

  it('moves with the arrow keys, wraps around, and opens the highlighted result on Enter', () => {
    const { key, service, el } = setup();
    key('ArrowDown');
    key('ArrowDown');
    expect(el.querySelector('.quick-search__option--active .quick-search__label')?.textContent?.trim()).toBe('Request time off');
    key('ArrowDown');
    expect(el.querySelector('.quick-search__option--active .quick-search__label')?.textContent?.trim()).toBe('Home');
    key('ArrowUp');
    key('Enter');
    expect(service.execute).toHaveBeenCalledWith(commands[2]);
  });

  describe('people', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('searches people 250ms after typing stops and lists them after the page matches', () => {
      const { type, labels, titles, service, el, fixture } = setup([], { canSearchPeople: true, people: [asha] });
      type('as');
      expect(el.querySelector('.quick-search__loading')).toBeTruthy();
      expect(service.searchPeople).not.toHaveBeenCalled();

      type('asha');
      vi.advanceTimersByTime(250);
      fixture.detectChanges();
      expect(service.searchPeople).toHaveBeenCalledTimes(1);
      expect(service.searchPeople).toHaveBeenCalledWith('asha');
      expect(titles()).toEqual(['People']);
      expect(labels()).toEqual(['Asha Perera']);
      expect(el.querySelector('app-avatar')).toBeTruthy();
      expect(el.querySelector('.quick-search__loading')).toBeNull();
    });

    it('does not search below two letters or without access to Employees', () => {
      const short = setup([], { canSearchPeople: true, people: [asha] });
      short.type('a');
      vi.advanceTimersByTime(300);
      expect(short.service.searchPeople).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      const noAccess = setup([], { canSearchPeople: false, people: [asha] });
      noAccess.type('asha');
      vi.advanceTimersByTime(300);
      expect(noAccess.service.searchPeople).not.toHaveBeenCalled();
      expect(noAccess.el.querySelector('.quick-search__loading')).toBeNull();
    });
  });

  it('opens a clicked result and closes on Escape or a backdrop click', () => {
    const { el, key, service } = setup();
    (el.querySelectorAll('.quick-search__option')[1] as HTMLButtonElement).click();
    expect(service.execute).toHaveBeenCalledWith(commands[1]);
    key('Escape');
    (el.querySelector('.quick-search__backdrop') as HTMLElement).click();
    expect(service.close).toHaveBeenCalledTimes(2);
  });
});
