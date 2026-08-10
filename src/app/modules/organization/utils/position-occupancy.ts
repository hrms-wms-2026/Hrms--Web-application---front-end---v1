import { PositionTypeKind } from '../models/position.model';

export type PositionOccupancyStatusType =
  | 'occupied'
  | 'vacant'
  | 'full'
  | 'available'
  | 'unassigned'
  | 'unknown'
  | 'archived';

export interface PositionOccupancyDisplay {
  readonly capacityText: string;
  readonly capacityAriaLabel: string;
  readonly statusLabel: string;
  readonly statusType: PositionOccupancyStatusType;
  readonly occupancyKnown: boolean;
}

export interface PositionOccupancyInput {
  readonly positionType: PositionTypeKind | string | null | undefined;
  readonly maxOccupancy: number;
  readonly currentOccupancy: number | null | undefined;
  readonly currentOccupancyCheckSupported?: boolean;
  readonly isActive: boolean;
}

/**
 * No position_assignments table exists yet, so the backend sends
 * currentOccupancy: null / currentOccupancyCheckSupported: false rather than a
 * real count. null must never be displayed as 0 or inferred as 1 from capacity.
 */
export function resolvePositionOccupancy(input: PositionOccupancyInput): PositionOccupancyDisplay {
  const isUnique = (input.positionType ?? '').toString().toLowerCase() === 'unique';
  const maxOccupancy = input.maxOccupancy;
  const supported = input.currentOccupancyCheckSupported !== false;
  const current = input.currentOccupancy;
  const occupancyKnown = supported && current !== null && current !== undefined && Number.isFinite(current);

  const capacityText = occupancyKnown ? `${current}/${maxOccupancy}` : `—/${maxOccupancy}`;

  if (!input.isActive) {
    return {
      capacityText,
      capacityAriaLabel: occupancyKnown
        ? `Archived position, ${current} of ${maxOccupancy} filled`
        : `Archived position, capacity ${maxOccupancy}, assignment status unknown`,
      statusLabel: 'Archived',
      statusType: 'archived',
      occupancyKnown
    };
  }

  if (!occupancyKnown) {
    if (isUnique) {
      return {
        capacityText,
        capacityAriaLabel: `Capacity ${maxOccupancy}, no confirmed assignment`,
        statusLabel: 'Unassigned',
        statusType: 'unassigned',
        occupancyKnown: false
      };
    }
    return {
      capacityText,
      capacityAriaLabel: `Capacity ${maxOccupancy}, assignment count unavailable`,
      statusLabel: 'Capacity tracking unavailable',
      statusType: 'unknown',
      occupancyKnown: false
    };
  }

  const atOrOverCapacity = current! >= maxOccupancy;
  const capacityAriaLabel = `${current} of ${maxOccupancy} filled`;

  if (isUnique) {
    return atOrOverCapacity
      ? { capacityText, capacityAriaLabel, statusLabel: 'Occupied', statusType: 'occupied', occupancyKnown: true }
      : { capacityText, capacityAriaLabel, statusLabel: 'Vacant', statusType: 'vacant', occupancyKnown: true };
  }

  return atOrOverCapacity
    ? { capacityText, capacityAriaLabel, statusLabel: 'Full', statusType: 'full', occupancyKnown: true }
    : { capacityText, capacityAriaLabel, statusLabel: 'Available capacity', statusType: 'available', occupancyKnown: true };
}
