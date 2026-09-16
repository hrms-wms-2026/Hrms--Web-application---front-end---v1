export interface WorkMode {
  id: string;
  legalEntityId: string;
  name: string;
  biometricEnabled: boolean;
  webEnabled: boolean;
  trayEnabled: boolean;
  photoRequired: boolean;
  /** First clock-in/check-in becomes this employee's permanent location reference point instead
   *  of being checked against the legal entity's office point. */
  selfRegistersLocation?: boolean;
  /** Keeps the daily office/home/other confirmation screen for this work mode instead of fixing
   *  the location behavior above. Mutually exclusive with selfRegistersLocation. */
  allowsDailyLocationChoice?: boolean;
  isSystemSeeded: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UpsertWorkModeRequest = Pick<
  WorkMode,
  | 'name'
  | 'biometricEnabled'
  | 'webEnabled'
  | 'trayEnabled'
  | 'photoRequired'
> & Partial<Pick<
  WorkMode,
  | 'selfRegistersLocation'
  | 'allowsDailyLocationChoice'
>>;

export const MAX_WORK_MODES_PER_LEGAL_ENTITY = 5;
