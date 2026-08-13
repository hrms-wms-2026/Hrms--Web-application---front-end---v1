import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { POSITION_TEMPLATE_DRAG_MIME_TYPE, PositionTemplatePackPositionResponse, PositionTemplatePackResponse } from '../../models/position.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

export interface TemplatePositionSelectedEvent {
  readonly position: PositionTemplatePackPositionResponse;
  readonly packName: string;
}

@Component({
  selector: 'app-position-template-drawer',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './position-template-drawer.component.html',
  styleUrl: './position-template-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionTemplateDrawerComponent {
  @Input() open = false;
  @Input() templatePacks: readonly PositionTemplatePackResponse[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() canCreate = true;

  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() templatePositionSelected = new EventEmitter<TemplatePositionSelectedEvent>();

  readonly searchQuery = signal('');
  readonly searchExpanded = signal(false);
  readonly collapsedPackIds = signal<Set<string>>(new Set<string>());

  get filteredPacks(): readonly PositionTemplatePackResponse[] {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.templatePacks;

    return this.templatePacks
      .map((pack) => {
        const packMatch = pack.name.toLowerCase().includes(q) || (pack.description && pack.description.toLowerCase().includes(q));
        const matchingPositions = pack.positions.filter(
          (pos) =>
            pos.positionName.toLowerCase().includes(q) ||
            pos.departmentName.toLowerCase().includes(q) ||
            (pos.reportsToPositionKey && pos.reportsToPositionKey.toLowerCase().includes(q))
        );

        if (packMatch) return pack;
        if (matchingPositions.length > 0) {
          return {
            ...pack,
            positions: matchingPositions
          };
        }
        return null;
      })
      .filter((pack): pack is PositionTemplatePackResponse => pack !== null);
  }

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
    if (!this.searchExpanded()) {
      this.searchQuery.set('');
    }
  }

  isPackExpanded(packId: string): boolean {
    return !this.collapsedPackIds().has(packId);
  }

  togglePackExpand(packId: string): void {
    this.collapsedPackIds.update((set) => {
      const next = new Set(set);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  onSelectPosition(pos: PositionTemplatePackPositionResponse, packName: string): void {
    this.templatePositionSelected.emit({
      position: pos,
      packName
    });
  }

  onDragStart(event: DragEvent, pos: PositionTemplatePackPositionResponse, packName: string): void {
    if (!this.canCreate || !event.dataTransfer) return;
    const data = JSON.stringify({ position: pos, packName });
    // Safe internal type carries the parsed payload; text/plain is kept only as a
    // human-readable fallback label, never parsed as the drop payload.
    event.dataTransfer.setData(POSITION_TEMPLATE_DRAG_MIME_TYPE, data);
    event.dataTransfer.setData('text/plain', pos.positionName);
    event.dataTransfer.effectAllowed = 'copy';
  }
}
