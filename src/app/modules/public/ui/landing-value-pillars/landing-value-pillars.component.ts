import { ChangeDetectionStrategy, Component } from '@angular/core';

export type LandingPillarIcon = 'people' | 'attendance' | 'time-off' | 'work';

export interface LandingPillar {
  icon: LandingPillarIcon;
  label: string;
}

export const LANDING_VALUE_PILLARS: readonly LandingPillar[] = [
  { icon: 'people', label: 'Employee management' },
  { icon: 'attendance', label: 'Attendance management' },
  { icon: 'time-off', label: 'Time off management' },
  { icon: 'work', label: 'Work management' }
];

/** Presentational strip of the platform's four core capability areas. */
@Component({
  selector: 'app-landing-value-pillars',
  standalone: true,
  templateUrl: './landing-value-pillars.component.html',
  styleUrl: './landing-value-pillars.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingValuePillarsComponent {
  readonly pillars = LANDING_VALUE_PILLARS;
}
