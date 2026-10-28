import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PositionTreeNodeComponent } from './position-tree-node.component';
import { PositionListTableComponent } from '../position-list-table/position-list-table.component';
import { POSITION_TEMPLATE_DRAG_MIME_TYPE, OccupantPreviewItem, PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';

function fakeDragEvent(opts: {
  types?: string[];
  getData?: (type: string) => string;
} = {}): DragEvent {
  const types = opts.types ?? [];
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types,
      dropEffect: '',
      getData: opts.getData ?? (() => ''),
      setData: vi.fn()
    }
  } as unknown as DragEvent;
}

describe('PositionTreeNodeComponent', () => {
  function makeNode(overrides: Partial<PositionTreeNodeResponse>): PositionTreeNodeResponse {
    return {
      id: 'pos-1',
      legalEntityId: 'le-1',
      departmentId: null,
      name: 'Chief Executive Officer',
      code: 'CEO',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      childCount: 0,
      children: [],
      ...overrides
    };
  }

  async function createComponent(node: PositionTreeNodeResponse) {
    await TestBed.configureTestingModule({ imports: [PositionTreeNodeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    return fixture;
  }

  function cardText(fixture: ReturnType<typeof TestBed.createComponent>): string {
    return fixture.nativeElement.textContent as string;
  }

  it('renders app-position-seat-preview instead of old —/N capacity text (unique, no occupant data)', async () => {
    const fixture = await createComponent(makeNode({}));
    const text = cardText(fixture);
    // Old raw capacity text must be gone
    expect(text).not.toContain('—/1');
    expect(text).not.toContain('1/1');
    // The seat-preview host element must be present
    expect(fixture.nativeElement.querySelector('app-position-seat-preview')).not.toBeNull();
  });

  it('renders one empty circle when assignedCount and occupantPreview are absent (stale backend)', async () => {
    const fixture = await createComponent(makeNode({})); // no assignedCount / occupantPreview
    // One gray empty-seat circle expected (capacity 1, assigned 0)
    const emptyCircles = fixture.nativeElement.querySelectorAll('.psp-circle--empty');
    expect(emptyCircles.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.psp-circle--employee')).toBeNull();
  });

  it('renders employee initials circle when backend provides occupantPreview with initials', async () => {
    const emp: OccupantPreviewItem = {
      employeeId: 'e-1', displayName: 'Jane Smith', initials: 'JS',
      avatarFileId: null, avatarUrl: null
    };
    const node = makeNode({ maxOccupancy: 1, assignedCount: 1, occupantPreview: [emp], remainingAssignedCount: 0 } as Partial<PositionTreeNodeResponse>);
    const fixture = await createComponent(node);

    expect(fixture.nativeElement.querySelector('.psp-circle--employee')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.psp-initials')?.textContent?.trim()).toBe('JS');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('status pill reflects assignedCount, not the deprecated currentOccupancy placeholder (regression: pill said Unassigned despite a real occupant)', async () => {
    const emp: OccupantPreviewItem = {
      employeeId: 'e-1', displayName: 'Dulanjana D', initials: 'DD',
      avatarFileId: null, avatarUrl: null
    };
    // Tree responses never send currentOccupancy at all; assignedCount is the real field.
    const node = makeNode({ maxOccupancy: 1, assignedCount: 1, occupantPreview: [emp], remainingAssignedCount: 0 } as Partial<PositionTreeNodeResponse>);
    const fixture = await createComponent(node);
    const text = cardText(fixture);

    expect(text).not.toContain('Unassigned');
    expect(text).toContain('Occupied');
  });

  it('gives Archived precedence and the status pill shows Archived, not Unassigned', async () => {
    const fixture = await createComponent(makeNode({ isActive: false }));
    const text = cardText(fixture);
    expect(text).toContain('Archived');
    expect(text).not.toContain('Unassigned');
    expect(text).not.toContain('Occupied');
    // seat-preview still present even for archived
    expect(fixture.nativeElement.querySelector('app-position-seat-preview')).not.toBeNull();
  });

  it('suppresses the status pill when occupancy status is unknown (Capacity tracking unavailable)', async () => {
    const fixture = await createComponent(makeNode({ positionType: 'pooled', maxOccupancy: 4 }));
    const text = cardText(fixture);
    expect(text).not.toContain('Capacity tracking unavailable');
    expect(fixture.nativeElement.querySelector('.ptn-status-pill')).toBeNull();
  });

  it('opens the unified position panel directly from the three-dot button without selecting the card', async () => {
    const node = makeNode({});
    const fixture = await createComponent(node);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    const selected = vi.fn();
    const opened = vi.fn();
    fixture.componentInstance.selectPosition.subscribe(selected);
    fixture.componentInstance.viewCoverage.subscribe(opened);

    (fixture.nativeElement.querySelector('.ptn-node-card') as HTMLElement).click();
    expect(selected).toHaveBeenCalledWith(node);

    (fixture.nativeElement.querySelector('.ptn-action-btn') as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith(node);
    expect(fixture.nativeElement.querySelector('.ptn-menu')).toBeNull();
  });

  it('renders green/amber coverage state and compact Primary/backup level labels', async () => {
    const fixture = await createComponent(makeNode({}));
    fixture.componentRef.setInput('coverageVisual', {
      state: 'unresolved', levels: ['Primary', '2'], accessibleLabel: 'Coverage needs attention'
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ptn-node-card--coverage-unresolved')).not.toBeNull();
    expect(Array.from(fixture.nativeElement.querySelectorAll('.ptn-coverage-level')).map((x: any) => x.textContent.trim()))
      .toEqual(['Primary', '2']);
    expect(fixture.nativeElement.querySelector('.ptn-coverage-warning')).not.toBeNull();
  });

  it('renders seat preview component in list-table as well (shared component regression)', async () => {
    // Verifies both tree and list use the same component without duplicating rendering logic
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [PositionListTableComponent] }).compileComponents();
    const listFixture = TestBed.createComponent(PositionListTableComponent);
    const listPosition: PositionListItemResponse = {
      id: 'pos-1', legalEntityId: 'le-1', departmentId: null,
      name: 'Chief Executive Officer', code: 'CEO', positionType: 'unique',
      maxOccupancy: 1, reportsToPositionId: null, isActive: true,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
      currentOccupancy: null
    };
    listFixture.componentRef.setInput('positions', [listPosition]);
    listFixture.detectChanges();

    expect(listFixture.nativeElement.querySelector('app-position-seat-preview')).not.toBeNull();
    expect(listFixture.nativeElement.textContent).not.toContain('—/1');
  });

  describe('Native drag/drop: template drop-under-position', () => {
    const templatePosition = {
      positionKey: 'sw-eng',
      positionName: 'Software Engineer',
      departmentName: 'Engineering',
      reportsToPositionKey: 'eng-mgr',
      linkedRoleTemplateId: null
    };

    async function createManagedComponent(node: PositionTreeNodeResponse) {
      const fixture = await createComponent(node);
      fixture.componentRef.setInput('canManage', true);
      fixture.detectChanges();
      return fixture;
    }

    it('dragover with the template MIME type shows the template drop-target visual state, distinct from a plain position reparent drag', async () => {
      const node = makeNode({});
      const fixture = await createManagedComponent(node);
      const component = fixture.componentInstance;

      component.onDragOver(fakeDragEvent({ types: [POSITION_TEMPLATE_DRAG_MIME_TYPE] }));
      fixture.detectChanges();

      expect(component.isTemplateDragOver()).toBe(true);
      expect(component.isDragOver()).toBe(false);
      expect(fixture.nativeElement.querySelector('.ptn-node-card--template-dragover')).not.toBeNull();
      expect(cardText(fixture)).toContain('Drop under this position.');
    });

    it('drag-over visual state clears on dragleave', async () => {
      const node = makeNode({});
      const fixture = await createManagedComponent(node);
      const component = fixture.componentInstance;

      component.onDragOver(fakeDragEvent({ types: [POSITION_TEMPLATE_DRAG_MIME_TYPE] }));
      expect(component.isTemplateDragOver()).toBe(true);

      component.onDragLeave(fakeDragEvent());
      fixture.detectChanges();

      expect(component.isTemplateDragOver()).toBe(false);
      expect(component.isDragOver()).toBe(false);
      expect(fixture.nativeElement.querySelector('.ptn-node-card--template-dragover')).toBeNull();
    });

    it('drag-over visual state for a plain position reparent drag still appears and clears (regression)', async () => {
      const node = makeNode({});
      const fixture = await createManagedComponent(node);
      const component = fixture.componentInstance;

      component.onDragOver(fakeDragEvent({ types: ['text/plain'] }));
      fixture.detectChanges();
      expect(component.isDragOver()).toBe(true);
      expect(component.isTemplateDragOver()).toBe(false);
      expect(fixture.nativeElement.querySelector('.ptn-node-card--dragover')).not.toBeNull();

      component.onDragLeave(fakeDragEvent());
      fixture.detectChanges();
      expect(component.isDragOver()).toBe(false);
    });

    it('dropping a template payload emits templateDropped with the template position, pack name, and this node as targetPosition (not reparentPosition)', async () => {
      const node = makeNode({ id: 'pos-target-1', name: 'Engineering Manager', departmentId: 'dept-eng-1' });
      const fixture = await createManagedComponent(node);
      const component = fixture.componentInstance;

      const templateDroppedSpy = vi.fn();
      const reparentSpy = vi.fn();
      component.templateDropped.subscribe(templateDroppedSpy);
      component.reparentPosition.subscribe(reparentSpy);

      const payload = JSON.stringify({ position: templatePosition, packName: 'Software Starter Pack' });
      component.onDragOver(fakeDragEvent({ types: [POSITION_TEMPLATE_DRAG_MIME_TYPE] }));
      component.onDrop(
        fakeDragEvent({
          types: [POSITION_TEMPLATE_DRAG_MIME_TYPE],
          getData: (type) => (type === POSITION_TEMPLATE_DRAG_MIME_TYPE ? payload : '')
        })
      );

      expect(templateDroppedSpy).toHaveBeenCalledWith({
        templatePosition,
        packName: 'Software Starter Pack',
        targetPosition: node
      });
      expect(reparentSpy).not.toHaveBeenCalled();
      expect(component.isTemplateDragOver()).toBe(false);
    });

    it('an existing-position reparent drop still emits reparentPosition, not templateDropped (regression)', async () => {
      const node = makeNode({ id: 'pos-target-1' });
      const fixture = await createManagedComponent(node);
      const component = fixture.componentInstance;

      const templateDroppedSpy = vi.fn();
      const reparentSpy = vi.fn();
      component.templateDropped.subscribe(templateDroppedSpy);
      component.reparentPosition.subscribe(reparentSpy);

      component.onDrop(
        fakeDragEvent({
          types: ['text/plain'],
          getData: (type) => (type === 'text/plain' ? 'pos-dragged-1' : '')
        })
      );

      expect(reparentSpy).toHaveBeenCalledWith({
        position: { id: 'pos-dragged-1' },
        newReportsToPositionId: 'pos-target-1'
      });
      expect(templateDroppedSpy).not.toHaveBeenCalled();
    });

    it('read-only (canManage=false) node ignores template dragover/drop entirely', async () => {
      const node = makeNode({});
      const fixture = await createComponent(node);
      fixture.componentRef.setInput('canManage', false);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      const templateDroppedSpy = vi.fn();
      component.templateDropped.subscribe(templateDroppedSpy);

      component.onDragOver(fakeDragEvent({ types: [POSITION_TEMPLATE_DRAG_MIME_TYPE] }));
      expect(component.isTemplateDragOver()).toBe(false);

      component.onDrop(fakeDragEvent({ types: [POSITION_TEMPLATE_DRAG_MIME_TYPE] }));
      expect(templateDroppedSpy).not.toHaveBeenCalled();
    });
  });
});
