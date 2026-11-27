import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { PeopleApiService } from '../../../modules/people/data-access/people-api.service';
import { FileApiService } from '../../../shared/data-access/file-api.service';
import { NavigationStateService } from '../nav/navigation-state.service';
import { QuickSearchCommand, buildQuickSearchCommands, personCommand } from './quick-search.commands';

/** Opens the Quick Search popup (navbar search pill, Ctrl/Cmd+K) and runs what the user picks from it. */
@Injectable({ providedIn: 'root' })
export class QuickSearchService {
  private static readonly RECENT_KEY = 'crownus.quick_search_recent';
  private static readonly MAX_RECENT = 5;

  private readonly router = inject(Router);
  private readonly nav = inject(NavigationStateService);
  private readonly permissions = inject(PermissionService);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly fileApi = inject(FileApiService);

  readonly isOpen = signal(false);
  /** The New Leave Request popup, opened by the "Request time off" action. */
  readonly leaveRequestOpen = signal(false);

  private readonly recentIds = signal<readonly string[]>(this.loadRecent());

  readonly commands = computed(() =>
    buildQuickSearchCommands({
      visibleItems: this.nav.visibleItems(),
      accessibleChildren: (item) => this.nav.accessibleChildren(item),
      hasPermission: (permission) => this.permissions.hasPermission(permission),
      hasModule: (module) => this.permissions.hasModule(module)
    })
  );

  /** People search needs the Employees page: profiles open there, under the same permissions (the sidebar's rule). */
  readonly canSearchPeople = computed(() =>
    this.nav.visibleItems().some((item) => this.nav.accessibleChildren(item).some((child) => child.id === 'people-employees'))
  );

  /** Up to five people whose name, number or email matches; the API only returns people the viewer may see. */
  searchPeople(query: string): Observable<QuickSearchCommand[]> {
    return this.peopleApi.listEmployees({ search: query, page: 1, pageSize: 5, sortBy: 'name', sortDir: 'asc' }).pipe(
      map((page) => page.items.map((employee) => personCommand(employee, employee.avatarFileId ? this.fileApi.getFileUrl(employee.avatarFileId) : null))),
      catchError(() => of([]))
    );
  }

  /** Recently opened commands the viewer can still open, most recent first. */
  readonly recent = computed(() => {
    const byId = new Map(this.commands().map((command) => [command.id, command]));
    return this.recentIds()
      .map((id) => byId.get(id))
      .filter((command): command is QuickSearchCommand => !!command);
  });

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  execute(command: QuickSearchCommand): void {
    this.close();
    // People aren't kept in Recent: Recent is rebuilt from the page and action list.
    if (command.group !== 'People') this.remember(command.id);
    if (command.run === 'request-time-off') {
      this.leaveRequestOpen.set(true);
      return;
    }
    if (command.route) {
      void this.router.navigate([command.route], command.queryParams ? { queryParams: command.queryParams } : {});
    }
  }

  private remember(id: string): void {
    const next = [id, ...this.recentIds().filter((recent) => recent !== id)].slice(0, QuickSearchService.MAX_RECENT);
    this.recentIds.set(next);
    try {
      window.localStorage.setItem(QuickSearchService.RECENT_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage exceptions in private/restricted environments
    }
  }

  private loadRecent(): readonly string[] {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(QuickSearchService.RECENT_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }
}
