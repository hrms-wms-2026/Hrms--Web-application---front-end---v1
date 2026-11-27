import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { NavIconComponent } from '../side-navbar/nav-icon.component';
import { PEOPLE_SEARCH_MIN_LENGTH, QuickSearchCommand, filterQuickSearchCommands } from './quick-search.commands';
import { QuickSearchService } from './quick-search.service';

interface QuickSearchSection {
  title: string;
  items: { command: QuickSearchCommand; index: number }[];
}

/**
 * The Quick Search popup: type to find any page or action the viewer can open, arrow keys to move, Enter to open,
 * Escape to close. With nothing typed it lists recent picks, then every page and action. From two letters on it
 * also finds people (for viewers who can open the Employees page).
 */
@Component({
  selector: 'app-quick-search-dialog',
  standalone: true,
  imports: [NavIconComponent, AvatarComponent],
  templateUrl: './quick-search-dialog.component.html',
  styleUrl: './quick-search-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickSearchDialogComponent {
  protected readonly quickSearch = inject(QuickSearchService);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly listId = 'quick-search-results';

  /** People matching the current query (empty below the minimum length or without access). */
  protected readonly people = signal<QuickSearchCommand[]>([]);
  protected readonly peopleLoading = signal(false);

  /** Results in display order, split into titled sections; `index` is the position in the flat keyboard order. */
  protected readonly sections = computed<QuickSearchSection[]>(() => {
    const query = this.query().trim();
    const matches = filterQuickSearchCommands(this.quickSearch.commands(), query);
    const groups: { title: string; commands: QuickSearchCommand[] }[] = [];
    if (!query && this.quickSearch.recent().length > 0) {
      groups.push({ title: 'Recent', commands: this.quickSearch.recent() });
    }
    if (query) {
      // Best match first: whichever group holds the top result is listed first.
      const order = [...new Set(matches.map((command) => command.group))];
      for (const group of order) groups.push({ title: group, commands: matches.filter((command) => command.group === group) });
    } else {
      groups.push({ title: 'Pages', commands: matches.filter((command) => command.group === 'Pages') });
      groups.push({ title: 'Actions', commands: matches.filter((command) => command.group === 'Actions') });
    }
    // People come after the page and action matches; they arrive a moment later from the server.
    groups.push({ title: 'People', commands: this.people() });

    let index = 0;
    return groups
      .filter((group) => group.commands.length > 0)
      .map((group) => ({ title: group.title, items: group.commands.map((command) => ({ command, index: index++ })) }));
  });

  private readonly flat = computed(() => this.sections().flatMap((section) => section.items.map((item) => item.command)));

  protected readonly activeId = computed(() => (this.flat().length > 0 ? this.optionId(this.activeIndex()) : null));

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());

    // Search people 250ms after typing stops; a newer query cancels the older request.
    toObservable(this.query)
      .pipe(
        map((query) => query.trim()),
        distinctUntilChanged(),
        tap((query) => {
          const searching = this.quickSearch.canSearchPeople() && query.length >= PEOPLE_SEARCH_MIN_LENGTH;
          this.peopleLoading.set(searching);
          if (!searching) this.people.set([]);
        }),
        debounceTime(250),
        switchMap((query) =>
          this.quickSearch.canSearchPeople() && query.length >= PEOPLE_SEARCH_MIN_LENGTH ? this.quickSearch.searchPeople(query) : of([])
        ),
        takeUntilDestroyed()
      )
      .subscribe((people) => {
        this.people.set(people);
        this.peopleLoading.set(false);
        // Keep the highlight on a row that still exists.
        if (this.activeIndex() >= this.flat().length) this.activeIndex.set(0);
      });
  }

  protected optionId(index: number): string {
    return `quick-search-option-${index}`;
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.flat().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.moveTo((this.activeIndex() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.moveTo((this.activeIndex() - 1 + count) % count);
        break;
      case 'Enter': {
        event.preventDefault();
        const command = this.flat()[this.activeIndex()];
        if (command) this.quickSearch.execute(command);
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.quickSearch.close();
        break;
    }
  }

  protected pick(command: QuickSearchCommand): void {
    this.quickSearch.execute(command);
  }

  private moveTo(index: number): void {
    this.activeIndex.set(index);
    this.list()?.nativeElement.querySelector(`#${this.optionId(index)}`)?.scrollIntoView({ block: 'nearest' });
  }
}
