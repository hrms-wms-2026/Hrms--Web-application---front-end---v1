import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Outline icon paths (24x24, stroke = currentColor) used across the employee detail screens. */
const ICON_PATHS = {
  overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  document: 'M7 3h7l5 5v13H7zM14 3v5h5M10 12h6M10 16h6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  chart: 'M5 20V10M10 20V4M15 20v-8M20 20v-5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  'calendar-check': 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  plane: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  'check-circle': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.5 2.5L16 9.5',
  check: 'M5 12.5l4 4L19 7',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  building: 'M4 21V5l8-2v18M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01M2 21h20',
  'id-card': 'M3 5h18v14H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 16a3 3 0 0 1 6 0M14 9h4M14 13h4',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  home: 'M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  alert: 'M12 3L2 20h20zM12 10v4M12 17h.01',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  monitor: 'M3 4h18v12H3zM8 21h8M12 16v5',
  coffee: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  transfer: 'M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  timer: 'M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 11v3l2 1M9 3h6'
} as const;

export type DetailIconName = keyof typeof ICON_PATHS;

@Component({
  selector: 'app-detail-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: [`:host { display: inline-flex; flex-shrink: 0; line-height: 0; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetailIconComponent {
  readonly name = input.required<DetailIconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.8);

  readonly path = computed(() => ICON_PATHS[this.name()]);
}
