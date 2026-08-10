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
      import('./feature/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent)
  },
  {
    path: ':projectId/milestones/:objectiveId',
    loadComponent: () =>
      import('./feature/milestone-detail/milestone-detail.component').then((m) => m.MilestoneDetailComponent)
  }
];
