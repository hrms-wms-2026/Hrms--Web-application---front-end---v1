export interface WorkMode {
  id: string;
  legalEntityId: string;
  name: string;
  biometricEnabled: boolean;
  webEnabled: boolean;
  trayEnabled: boolean;
  photoRequired: boolean;
  isSystemSeeded: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UpsertWorkModeRequest = Pick<
  WorkMode,
  'name' | 'biometricEnabled' | 'webEnabled' | 'trayEnabled' | 'photoRequired'
>;

export const MAX_WORK_MODES_PER_LEGAL_ENTITY = 5;
