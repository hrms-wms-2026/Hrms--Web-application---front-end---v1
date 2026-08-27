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
            path: 'approvals',
            loadComponent: () =>
              import('./feature/work-approvals/work-approvals.component').then((m) => m.WorkApprovalsComponent)
          },
          
          
          
        ]
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
        path: 'my-task',
        loadComponent: () =>
          import('./feature/my-task/my-task.component').then((m) => m.MyTaskComponent)
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
      },
      {
        path: 'task/:taskId',
        loadComponent: () =>
          import('./feature/task-detail-page/task-detail-page.component').then((m) => m.TaskDetailPageComponent)
      }
    ]
  }
];
