import { Routes } from '@angular/router';

/** /inbox lists every request and alert involving the user; /inbox/:source/:kind/:id deep-links one item. */
export const INBOX_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/inbox-page/inbox-page.component').then((m) => m.InboxPageComponent)
  },
  {
    path: ':source/:kind/:id',
    loadComponent: () => import('./feature/inbox-page/inbox-page.component').then((m) => m.InboxPageComponent)
  }
];
