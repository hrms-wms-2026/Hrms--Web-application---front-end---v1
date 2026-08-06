import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PopoverComponent } from './popover.component';

@Component({
  standalone: true,
  imports: [PopoverComponent],
  template: `
    <app-popover [open]="isOpen" ariaLabel="Menu" (closed)="closedCount = closedCount + 1">
      <button popover-trigger type="button" (click)="isOpen = !isOpen">Trigger</button>
      <div popover-panel><button class="inside">Inside</button></div>
    </app-popover>
    <button class="outside" type="button">Outside</button>
  `
})
class HostComponent {
  isOpen = false;
  closedCount = 0;
}

describe('PopoverComponent', () => {
  it('does not render the panel when closed', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
  });

  it('renders the panel with the projected content when open', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.isOpen = true;
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[role="menu"]');
    expect(panel).toBeTruthy();
    expect(panel.querySelector('.inside')).toBeTruthy();
  });

  it('does not emit closed when the trigger itself is clicked (parent owns the toggle)', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[popover-trigger]')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen).toBe(true);
    expect(fixture.componentInstance.closedCount).toBe(0);
  });

  it('emits closed on an outside click while open', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.isOpen = true;
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.outside')).nativeElement.click();

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('emits closed on Escape while open', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.isOpen = true;
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('does not emit closed on a click inside the panel', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.isOpen = true;
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.inside')).nativeElement.click();

    expect(fixture.componentInstance.closedCount).toBe(0);
  });
});
