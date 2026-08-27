import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SubModuleFormComponent } from './sub-module-form.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('SubModuleFormComponent', () => {
  let fixture: ComponentFixture<SubModuleFormComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: 'parent-1', isDefault: false,
    title: 'Design Phase', description: 'Scope design', ownerId: 'u1', ownerName: 'Arun',
    reportingManagerId: 'm1', reportingManagerName: 'Manager', createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, isOwner: true,
    isAchieved: false, achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SubModuleFormComponent] });
    fixture = TestBed.createComponent(SubModuleFormComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('emits the exact create payload and has no Achieved control in create mode', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('New Module');
    component.description.set('Details');
    component.startDate.set('2026-04-01');
    component.endDate.set('2026-05-01');
    component.allocatedHours.set(12);
    const created = vi.fn();
    component.created.subscribe(created);

    component.submit();

    expect(fixture.nativeElement.querySelector('[data-testid="achieved-field"]')).toBeNull();
    expect(created).toHaveBeenCalledWith({
      parentObjectiveId: 'parent-1', title: 'New Module', description: 'Details',
      startDate: '2026-04-01', endDate: '2026-05-01', allocatedHours: 12
    });
  });

  it('prefills edit mode and emits fields with achieved metadata', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('Updated Module');
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.submit();

    expect(component.description()).toBe('Scope design');
    expect(saved).toHaveBeenCalledWith({
      fields: {
        title: 'Updated Module', description: 'Scope design',
        startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 20
      },
      achievedChanged: false,
      achieved: false
    });
  });

  it('shows the Default Module explanation and disables Achieved in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    const achieved = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input') as HTMLInputElement;

    expect(achieved.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Default Module follows');
  });

  it('blocks invalid create values and shows field errors', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const created = vi.fn();
    (fixture.componentInstance as any).created.subscribe(created);

    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(created).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });
});
