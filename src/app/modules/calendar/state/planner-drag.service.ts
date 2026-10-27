import { Injectable, signal } from '@angular/core';
import { PlannerFocusItem } from '../../work/planner/models/planner.models';

export interface PlannerDraggedTask {
  taskId: string;
  projectId: string;
  title: string;
  /** The remaining estimate, which sizes the drop preview; null without an estimate. */
  minutes: number | null;
}

/** Carries a Focus card being dragged over to the calendar grid (the panel and the grid are separate components). */
@Injectable({ providedIn: 'root' })
export class PlannerDragService {
  readonly dragging = signal<PlannerDraggedTask | null>(null);

  start(item: PlannerFocusItem): void {
    this.dragging.set({ taskId: item.taskId, projectId: item.projectId, title: item.title, minutes: item.remainingMinutes });
  }

  end(): void {
    this.dragging.set(null);
  }
}
