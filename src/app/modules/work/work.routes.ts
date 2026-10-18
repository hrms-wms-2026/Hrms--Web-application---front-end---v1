import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const WORK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/project-list/project-list.component').then((m) => m.ProjectListComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./feature/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
    children: [
      {
        path: 'milestones/:milestoneId',
        canDeactivate: [unsavedChangesGuard],
        children: [
          { path: '', redirectTo: 'tree', pathMatch: 'full' },
          {
            path: 'tree',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('./feature/milestone-tree-tab/milestone-tree-tab.component').then((m) => m.MilestoneTreeTabComponent)
          }
        ]
      },
      {
        // Approvals moved to the user's Inbox. Old links (dashboard deep links, bookmarks) still land
        // on the request: ?request=<id> opens that item.
        path: 'approvals',
        redirectTo: ({ queryParams }) => (queryParams['request'] ? `/inbox/work/approval/${queryParams['request']}` : '/inbox')
      },
      {
        path: 'board',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./feature/task-board/task-board.component').then((m) => m.TaskBoardComponent)
      },
      {
        path: 'backlog',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./feature/task-backlog/task-backlog.component').then((m) => m.TaskBacklogComponent)
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./feature/project-calendar/project-calendar.component').then((m) => m.ProjectCalendarComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./feature/project-settings/project-settings.component').then((m) => m.ProjectSettingsComponent)
      }
    ]
  }
];
