import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DraftChip, DraftsStore } from '../../../shared/state/drafts.store';
import { DraftsBarComponent } from './drafts-bar.component';

describe('DraftsBarComponent', () => {
  let fixture: ComponentFixture<DraftsBarComponent>;
  const chips = signal<DraftChip[]>([]);
  const store = { chips, load: vi.fn(async () => {}), removeChip: vi.fn(async () => true) };
  const router = { navigate: vi.fn() };
  const el = () => fixture.nativeElement as HTMLElement;
  const offset = () => document.documentElement.style.getPropertyValue('--bottom-tray-offset');

  const TWO_CHIPS: DraftChip[] = [
    { kind: 'task', id: 't1', label: 'Fix login', badge: null, projectId: 'p1' },
    { kind: 'employee', id: 'e1', label: 'Jane', badge: 'Awaiting approval', projectId: null }
  ];

  beforeEach(() => {
    chips.set([]);
    store.load.mockClear();
    store.removeChip.mockClear();
    router.navigate.mockClear();
    TestBed.configureTestingModule({
      imports: [DraftsBarComponent],
      providers: [{ provide: DraftsStore, useValue: store }, { provide: Router, useValue: router }]
    });
    fixture = TestBed.createComponent(DraftsBarComponent);
    fixture.detectChanges();
  });

  it('renders nothing and zero offset when there are no drafts', () => {
    expect(el().querySelector('[data-testid="drafts-bar"]')).toBeNull();
    expect(offset()).toBe('0px');
  });

  it('loads drafts when it is created', () => {
    expect(store.load).toHaveBeenCalled();
  });

  it('renders one chip per draft with badge, and reserves bottom space', () => {
    chips.set(TWO_CHIPS);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="draft-chip-task-t1"]')!.textContent).toContain('Fix login');
    expect(el().querySelector('[data-testid="draft-chip-employee-e1"]')!.textContent).toContain('Awaiting approval');
    expect(offset()).toBe('56px');
  });

  it('opens the right screen for each kind', () => {
    chips.set(TWO_CHIPS);
    fixture.detectChanges();
    (el().querySelector('[data-testid="draft-chip-task-t1"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1', 'backlog'], { queryParams: { taskDraftId: 't1' } });
    (el().querySelector('[data-testid="draft-chip-employee-e1"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees'], { queryParams: { draftId: 'e1' } });
  });

  it('asks before deleting, then removes via the store', async () => {
    chips.set(TWO_CHIPS);
    fixture.detectChanges();
    (el().querySelector('[data-testid="draft-chip-remove-task-t1"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(store.removeChip).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Delete draft?');

    await (fixture.componentInstance as unknown as { confirmDelete: () => Promise<void> }).confirmDelete();

    expect(store.removeChip).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('keeps the confirmation open with an error when deleting fails', async () => {
    chips.set(TWO_CHIPS);
    fixture.detectChanges();
    store.removeChip.mockResolvedValueOnce(false);
    (el().querySelector('[data-testid="draft-chip-remove-task-t1"]') as HTMLElement).click();
    fixture.detectChanges();

    await (fixture.componentInstance as unknown as { confirmDelete: () => Promise<void> }).confirmDelete();
    fixture.detectChanges();

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Could not delete the draft.');
  });

  it('reloads on window focus', () => {
    store.load.mockClear();
    window.dispatchEvent(new Event('focus'));
    expect(store.load).toHaveBeenCalled();
  });
});
