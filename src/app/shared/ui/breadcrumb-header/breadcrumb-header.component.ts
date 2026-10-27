import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavIconComponent } from '../../../layouts/main-layout/side-navbar/nav-icon.component';
import { NavIconName } from '../../../layouts/main-layout/nav/nav-item.model';
import { MobileBackBarState } from '../../../layouts/main-layout/nav/mobile-back-bar.state';

export interface BreadcrumbSwitcherItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-breadcrumb-header',
  standalone: true,
  imports: [NavIconComponent, RouterLink],
  templateUrl: './breadcrumb-header.component.html',
  styleUrl: './breadcrumb-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.bh--repeats-back-bar]': 'repeatsMobileBackBar()' }
})
export class BreadcrumbHeaderComponent {
  private readonly backBar = inject(MobileBackBarState);
  parentLabel = input.required<string>();
  currentLabel = input.required<string>();
  /** An optional level between the parent and the current page (Inbox › Chats › Priya). */
  middleLabel = input<string | undefined>(undefined);
  parentUrl = input<string | undefined>(undefined);
  icon = input<NavIconName | undefined>(undefined);

  /** When non-empty, the current-page breadcrumb segment becomes a click-to-open switcher (ClickUp-style) listing these as alternatives. */
  switcherItems = input<readonly BreadcrumbSwitcherItem[]>([]);
  switcherActiveId = input<string>('');
  switcherGroupLabel = input<string>('');
  switcherSelected = output<string>();
  /** Opt-in: the current-page segment becomes a button (e.g. the inbox's chat name opens that chat's info). */
  currentClickable = input(false);
  currentTitle = input<string>('');
  currentClicked = output<void>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly filteredSwitcherItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    const items = this.switcherItems();
    return q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
  });

  /** On phones the layout's back bar already names this page (MobileSectionNavComponent), so a plain
   *  "Section › Page" crumb would say it twice. Crumbs that add something (a middle level, a switcher) stay. */
  protected readonly repeatsMobileBackBar = computed(
    () =>
      this.backBar.label() === this.currentLabel() &&
      !this.middleLabel() &&
      this.switcherItems().length === 0
  );

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  toggleOpen(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
    this.search.set('');
  }

  select(id: string): void {
    this.open.set(false);
    if (id !== this.switcherActiveId()) this.switcherSelected.emit(id);
  }
}
