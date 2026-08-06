import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalComponent } from './modal.component';

@Component({
  standalone: true,
  imports: [ModalComponent],
  template: `<app-modal [open]="isOpen" title="Delete company" (closed)="onClosed()"><p>Are you sure?</p></app-modal>`
})
class HostComponent {
  isOpen = true;
  closedCount = 0;
  onClosed(): void {
    this.closedCount++;
  }
}

describe('ModalComponent', () => {
  it('renders nothing when closed', async () => {
    await TestBed.configureTestingModule({ imports: [ModalComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ModalComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('renders the title, projected content, and a dialog role when open', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(el.textContent).toContain('Delete company');
    expect(el.textContent).toContain('Are you sure?');
  });

  it('emits closed when the close button is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('button[aria-label="Close"]'));
    closeButton.nativeElement.click();

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('emits closed when the backdrop is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.fixed > .absolute') as HTMLElement;
    backdrop.click();

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('emits closed on Escape', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.componentInstance.closedCount).toBe(1);
  });
});
