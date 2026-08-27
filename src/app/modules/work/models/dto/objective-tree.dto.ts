export interface ObjectiveTreeItemDto {
  id: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isAchieved: boolean;
  progress: number;
  ownerName: string | null;
  isOwner: boolean;
}
