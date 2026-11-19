export interface ActionItemLink {
  kind: string;
  params: Record<string, string>;
}

export interface ActionItem {
  sourceKey: string;
  entityId: string;
  title: string;
  subjectEmployeeId: string | null;
  subjectName: string | null;
  createdAt: string;
  exceptionStatus: string | null;
  link: ActionItemLink;
}

export interface ActionSourceSummary {
  sourceKey: string;
  domain: 'people' | 'work';
  status: 'ok' | 'unavailable';
  pendingCount: number;
  inProgressCount: number | null;
  oldestPendingAt: string | null;
  topItems: ActionItem[];
}

export interface TeamActionItemsResponse {
  legalEntityId: string;
  sources: ActionSourceSummary[];
}
