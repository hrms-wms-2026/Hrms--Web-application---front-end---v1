import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Leading icons for form fields (app-input, app-select, raw `.ui-field` frames). */
export type FieldIcon =
  | 'hash'
  | 'mail'
  | 'phone'
  | 'calendar'
  | 'clock'
  | 'briefcase'
  | 'building'
  | 'user'
  | 'users'
  | 'lock'
  | 'search'
  | 'link'
  | 'globe'
  | 'map-pin'
  | 'tag'
  | 'id-card'
  | 'filter'
  | 'module'
  | 'status'
  | 'category'
  | 'sprint';

const FIELD_ICON_PATHS: Record<FieldIcon, string> = {
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  mail: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z M3.5 6.5 12 13l8.5-6.5',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M16 2v4M8 2v4M4 10h16',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7.5V12l3 2',
  briefcase: 'M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18',
  building: 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M3 21h18 M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  users: 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6 M17 6.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z M16 13.5c2.7.4 4.8 2.6 4.8 6',
  lock: 'M5 11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M8 9V7a4 4 0 1 1 8 0v2',
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M21 21l-4.3-4.3',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18',
  'map-pin': 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z M7.5 7.5h.01',
  'id-card': 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M6 16c.5-1.2 1.6-2 3-2s2.5.8 3 2 M14 10h4M14 14h3',
  filter: 'M3 7h18M6 7v10M18 7v10M9 17h6',
  module: 'M4 5h16v14H4z M8 9h8M8 13h5',
  status: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 8v4l2.5 2',
  category: 'M4 6h16M7 12h10M10 18h4',
  sprint: 'M4 5h16v14H4z M8 9h8M8 13h5'
};

/** Decorative 16px outline icon used in a field's leading addon. */
@Component({
  selector: 'app-field-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path [attr.d]="path()" />
    </svg>
  `
})
export class FieldIconComponent {
  readonly name = input.required<FieldIcon>();
  readonly path = computed(() => FIELD_ICON_PATHS[this.name()]);
}
