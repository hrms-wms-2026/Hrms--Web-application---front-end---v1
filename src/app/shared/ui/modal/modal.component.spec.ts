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

  it('defaults to the md size class', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-md')).toBe(true);
    expect(dialog.classList.contains('max-w-5xl')).toBe(false);
  });

  it('applies the xl size class when size="xl"', async () => {
    @Component({
      standalone: true,
      imports: [ModalComponent],
      template: `<app-modal [open]="true" size="xl"><p>content</p></app-modal>`
    })
    class XlHostComponent {}

    await TestBed.configureTestingModule({ imports: [XlHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(XlHostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-5xl')).toBe(true);
    expect(dialog.classList.contains('max-w-md')).toBe(false);
  });

  it('constrains height with internal scroll for lg, xl, and 2xl, but not md', async () => {
    @Component({
      standalone: true,
      imports: [ModalComponent],
      template: `
        <app-modal [open]="true" size="md"><p>md</p></app-modal>
        <app-modal [open]="true" size="lg"><p>lg</p></app-modal>
        <app-modal [open]="true" size="xl"><p>xl</p></app-modal>
        <app-modal [open]="true" size="2xl"><p>2xl</p></app-modal>
      `
    })
    class AllSizesHostComponent {}

    await TestBed.configureTestingModule({ imports: [AllSizesHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AllSizesHostComponent);
    fixture.detectChanges();

    const dialogs = fixture.nativeElement.querySelectorAll('[role="dialog"]') as NodeListOf<HTMLElement>;
    expect(dialogs.length).toBe(4);
    const [md, lg, xl, xxl] = Array.from(dialogs);
    expect(md.classList.contains('modal-dialog--constrained')).toBe(false);
    expect(lg.classList.contains('modal-dialog--constrained')).toBe(true);
    expect(xl.classList.contains('modal-dialog--constrained')).toBe(true);
    expect(xxl.classList.contains('modal-dialog--constrained')).toBe(true);
  });

  it('allows overriding maxWidth with customMaxWidth', async () => {
    @Component({
      standalone: true,
      imports: [ModalComponent],
      template: `<app-modal [open]="true" size="lg" customMaxWidth="max-w-3xl"><p>wide</p></app-modal>`
    })
    class CustomWidthHostComponent {}

    await TestBed.configureTestingModule({ imports: [CustomWidthHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CustomWidthHostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-3xl')).toBe(true);
    expect(dialog.classList.contains('max-w-xl')).toBe(false);
  });
});
