import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveRespondInfoDialogComponent } from './leave-respond-info-dialog.component';

describe('LeaveRespondInfoDialogComponent', () => {
  let fixture: ComponentFixture<LeaveRespondInfoDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveRespondInfoDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveRespondInfoDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('question', 'Can you share tickets?');
  });

  it('shows the manager question', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="info-question"]')?.textContent).toContain('Can you share tickets?');
  });

  it('does not emit an empty reply', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onConfirm();
    expect(emitted).toEqual([]);
  });

  it('emits the typed reply', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.message.set('Tickets attached');
    fixture.componentInstance.onConfirm();
    expect(emitted).toEqual([{ message: 'Tickets attached', fileRecordIds: null }]);
  });
});
