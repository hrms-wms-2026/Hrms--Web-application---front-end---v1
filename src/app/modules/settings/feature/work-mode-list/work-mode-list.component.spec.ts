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
          selfRegistersLocation: false,
          allowsDailyLocationChoice: false,
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

  it('disables every row checkbox when canEdit is false', () => {
    fixture.componentRef.setInput('canEdit', false);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('[data-testid="work-mode-row"]');
    const checkboxes: HTMLInputElement[] = Array.from(row.querySelectorAll('input[type="checkbox"]'));
    expect(checkboxes.length).toBe(6);
    checkboxes.forEach((checkbox) => expect(checkbox.disabled).toBe(true));
  });

  it('does not render the Deactivate button when canEdit is false', () => {
    fixture.componentRef.setInput('canEdit', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="deactivate-work-mode"]')).toBeNull();
  });

  it('does not render the "Add work mode" button when canEdit is false, regardless of atCap', () => {
    fixture.componentRef.setInput('canEdit', false);
    (storeStub.atCap as any).set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="add-work-mode"]')).toBeNull();
  });

  it('opens the Add work mode popup modal when "Add work mode" is clicked and saves on confirm', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="add-work-mode-modal"]')).toBeNull();
    const addButton = fixture.nativeElement.querySelector('[data-testid="add-work-mode"]');
    addButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="add-work-mode-modal"]')).toBeTruthy();
    fixture.componentInstance.draft.name = 'Contractors';
    fixture.detectChanges();

    fixture.componentInstance.confirmAdd();
    fixture.detectChanges();

    expect(storeStub.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Contractors', webEnabled: true })
    );
    expect(fixture.nativeElement.querySelector('[data-testid="add-work-mode-modal"]')).toBeNull();
  });

  describe('setLocationBehavior', () => {
    it('turning on selfRegistersLocation turns off allowsDailyLocationChoice', () => {
      const component = fixture.componentInstance;
      const payload = { ...storeStub.items!()[0], allowsDailyLocationChoice: true };
      const result = component.setLocationBehavior(payload, 'selfRegistersLocation', true);
      expect(result.selfRegistersLocation).toBe(true);
      expect(result.allowsDailyLocationChoice).toBe(false);
    });

    it('turning on allowsDailyLocationChoice turns off selfRegistersLocation', () => {
      const component = fixture.componentInstance;
      const payload = { ...storeStub.items!()[0], selfRegistersLocation: true };
      const result = component.setLocationBehavior(payload, 'allowsDailyLocationChoice', true);
      expect(result.allowsDailyLocationChoice).toBe(true);
      expect(result.selfRegistersLocation).toBe(false);
    });

    it('turning a flag off leaves the other flag untouched', () => {
      const component = fixture.componentInstance;
      const payload = { ...storeStub.items!()[0], selfRegistersLocation: true, allowsDailyLocationChoice: false };
      const result = component.setLocationBehavior(payload, 'selfRegistersLocation', false);
      expect(result.selfRegistersLocation).toBe(false);
      expect(result.allowsDailyLocationChoice).toBe(false);
    });
  });
});
