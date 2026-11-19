import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchiveConfirmModalComponent } from './archive-confirm-modal.component';

describe('ArchiveConfirmModalComponent', () => {
  let fixture: ComponentFixture<ArchiveConfirmModalComponent>;
  let component: ArchiveConfirmModalComponent;
  let confirmed: number;
  let cancelled: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const buttonByText = (text: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.acm-footer button')).find((b) => b.textContent?.trim() === text)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ArchiveConfirmModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(ArchiveConfirmModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entityType', 'department');
    fixture.componentRef.setInput('entityName', 'Finance');
    fixture.componentRef.setInput('subtitle', 'This removes the department.');
    confirmed = 0;
    cancelled = 0;
    component.confirmed.subscribe(() => confirmed++);
    component.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
  });

  it('renders the title, subtitle and the entity in the confirm label', () => {
    expect(el().querySelector('.acm-title')?.textContent).toContain('Archive ‘Finance’?');
    expect(el().querySelector('.acm-subtitle')?.textContent).toContain('This removes the department.');
    expect(buttonByText('Archive department')).toBeTruthy();
  });

  it('renders impact counts and marks the non-zero ones as blocked', () => {
    fixture.componentRef.setInput('impacts', [
      { label: 'Child departments', count: 2 },
      { label: 'Positions', count: 0 }
    ]);
    fixture.componentRef.setInput('canArchive', false);
    fixture.componentRef.setInput('blockerMessages', ['Move the child departments first.']);
    fixture.detectChanges();

    const cards = Array.from(el().querySelectorAll('.acm-dep-card'));
    expect(cards.map((c) => c.querySelector('.acm-dep-label')?.textContent)).toEqual(['Child departments', 'Positions']);
    expect(cards.map((c) => c.querySelector('.acm-dep-count')?.textContent)).toEqual(['2', '0']);
    expect(cards.map((c) => c.classList.contains('acm-dep-card--blocked'))).toEqual([true, false]);
    expect(el().querySelector('.acm-alert--error')?.textContent).toContain('This department cannot be archived yet.');
    expect(el().querySelector('.acm-blocker-list')?.textContent).toContain('Move the child departments first.');
    expect(buttonByText('Archive department').disabled).toBe(true);
  });

  it('shows the clear message when nothing blocks the archive', () => {
    fixture.componentRef.setInput('impacts', [{ label: 'Positions', count: 0 }]);
    fixture.componentRef.setInput('clearMessage', 'Nothing is linked.');
    fixture.detectChanges();

    expect(el().querySelector('.acm-alert--info')?.textContent).toContain('Nothing is linked.');
    expect(el().querySelector('.acm-alert--error')).toBeNull();
  });

  it('shows the checking state instead of the impacts and disables confirm', () => {
    fixture.componentRef.setInput('checking', true);
    fixture.componentRef.setInput('impacts', [{ label: 'Positions', count: 0 }]);
    fixture.detectChanges();

    expect(el().querySelector('.acm-loading-state')?.textContent).toContain('Checking department dependencies…');
    expect(el().querySelector('.acm-deps-grid')).toBeNull();
    expect(buttonByText('Archive department').disabled).toBe(true);
  });

  it('renders the warning message when one is given', () => {
    fixture.componentRef.setInput('warningMessage', 'Users may lose permissions.');
    fixture.detectChanges();

    expect(el().querySelector('.acm-alert--warning')?.textContent).toContain('Users may lose permissions.');
  });

  it('emits confirmed when the confirm button is clicked', () => {
    buttonByText('Archive department').click();

    expect(confirmed).toBe(1);
    expect(cancelled).toBe(0);
  });

  it('emits cancelled when the cancel button is clicked', () => {
    buttonByText('Cancel').click();

    expect(cancelled).toBe(1);
    expect(confirmed).toBe(0);
  });

  it('emits cancelled on Escape', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelled).toBe(1);
  });

  it('ignores Escape while saving', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelled).toBe(0);
  });
});
