import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkModeListComponent } from './work-mode-list.component';
import { WorkModeStore } from '../../state/work-mode.store';

describe('WorkModeListComponent', () => {
  let fixture: ComponentFixture<WorkModeListComponent>;
  let storeStub: Partial<InstanceType<typeof WorkModeStore>>;

  beforeEach(async () => {
    storeStub = {
      items: signal([
        {
          id: 'wm-1',
          legalEntityId: 'le-1',
          name: 'Remote',
          biometricEnabled: false,
          webEnabled: true,
          trayEnabled: false,
          photoRequired: false,
          isSystemSeeded: true,
          displayOrder: 0,
          isActive: true,
          createdAt: '',
          updatedAt: ''
        }
      ]) as any,
      atCap: signal(false) as any,
      loading: signal(false) as any,
      saving: signal(false) as any,
      error: signal(null) as any,
      load: vi.fn() as any,
      create: vi.fn() as any,
      update: vi.fn() as any,
      deactivate: vi.fn() as any
    };
    await TestBed.configureTestingModule({
      imports: [WorkModeListComponent],
      providers: [{ provide: WorkModeStore, useValue: storeStub }]
    }).compileComponents();
    fixture = TestBed.createComponent(WorkModeListComponent);
    fixture.componentRef.setInput('legalEntityId', 'le-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one row per work mode', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="work-mode-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Remote');
  });

  it('disables "Add work mode" when atCap is true', () => {
    (storeStub.atCap as any).set(true);
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector('[data-testid="add-work-mode"]');
    expect(addButton.disabled).toBe(true);
  });

  it('calls store.deactivate with the row id when delete is confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteButton = fixture.nativeElement.querySelector('[data-testid="deactivate-work-mode"]');
    deleteButton.click();
    expect(storeStub.deactivate).toHaveBeenCalledWith('wm-1');
  });

  it('does not call store.deactivate when the confirm dialog is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteButton = fixture.nativeElement.querySelector('[data-testid="deactivate-work-mode"]');
    deleteButton.click();
    expect(storeStub.deactivate).not.toHaveBeenCalled();
  });
});
