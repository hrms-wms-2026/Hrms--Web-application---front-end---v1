import { Routes } from '@angular/router';

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
        children: [
          { path: '', redirectTo: 'tree', pathMatch: 'full' },
          {
            path: 'tree',
            loadComponent: () =>
              import('./feature/milestone-tree-tab/milestone-tree-tab.component').then((m) => m.MilestoneTreeTabComponent)
          },
          {
            path: 'board',
            loadComponent: () =>
              import('./feature/task-board/task-board.component').then((m) => m.TaskBoardComponent)
          },
          {
            path: 'backlog',
            loadComponent: () =>
              import('./feature/task-backlog/task-backlog.component').then((m) => m.TaskBacklogComponent)
          },
          {
            path: 'approvals',
            loadComponent: () =>
              import('./feature/work-approvals/work-approvals.component').then((m) => m.WorkApprovalsComponent)
          },
          {
            path: 'my-task',
            loadComponent: () =>
              import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent),
            data: { title: 'My Task' }
          },
          {
            path: 'list',
            loadComponent: () =>
              import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent),
            data: { title: 'List' }
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./feature/objective-settings/objective-settings.component').then((m) => m.ObjectiveSettingsComponent)
          }
        ]
      }
    ]
  }
];
