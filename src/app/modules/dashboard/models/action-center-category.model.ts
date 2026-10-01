export interface ActionCenterCategory {
  sourceKey: string;
  label: string;
  domain: 'people' | 'work';
  status: 'ok' | 'unavailable';
  pendingCount: number;
  oldestWaitingLabel: string | null;
}
