import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
  let fixture: ComponentFixture<ConfirmModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmModalComponent] });
    fixture = TestBed.createComponent(ConfirmModalComponent);
  });

  it('does not render when closed', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders title and message when open', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Delete project');
    fixture.componentRef.setInput('message', "Delete project 'Website Revamp'? This cannot be undone.");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Delete project');
    expect(fixture.nativeElement.textContent).toContain('This cannot be undone.');
  });

  it('emits confirmed when the confirm button is pressed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let confirmed = false;
    fixture.componentInstance.confirmed.subscribe(() => (confirmed = true));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    buttons[buttons.length - 1].click();

    expect(confirmed).toBe(true);
  });

  it('emits cancelled when the cancel button is pressed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let cancelled = false;
    fixture.componentInstance.cancelled.subscribe(() => (cancelled = true));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    buttons[buttons.length - 2].click();

    expect(cancelled).toBe(true);
  });

  it('shows the error message when set', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('errorMessage', "A top-level milestone isn't yet Achieved");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("A top-level milestone isn't yet Achieved");
  });
});
