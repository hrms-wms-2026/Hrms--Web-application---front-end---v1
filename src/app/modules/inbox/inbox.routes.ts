import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

/** `''` (the list) or `:source/:kind/:id` (one item), as ONE route so selecting a row only changes the
 *  params: the page, its filters and the loaded list are kept. */
export function inboxUrlMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length !== 3) return null;
  const [source, kind, id] = segments;
  return { consumed: segments, posParams: { source, kind, id } };
}

/** /inbox lists every request and alert involving the user; /inbox/:source/:kind/:id deep-links one item. */
export const INBOX_ROUTES: Routes = [
  {
    matcher: inboxUrlMatcher,
    loadComponent: () => import('./feature/inbox-page/inbox-page.component').then((m) => m.InboxPageComponent)
  }
];
