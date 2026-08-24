export interface PositionHistoryEntryResponse {
  readonly positionName: string;
  readonly departmentName: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly changeReason: 'Promotion' | 'Transfer' | 'LateralMove' | null;
  readonly initiatedByName: string;
  readonly approvedByName: string | null;
}
