import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  it('emits pressed on click', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.pressed.subscribe(() => (emitted = true));

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();

    expect(emitted).toBe(true);
  });

  it('disables the native button when disabled is true', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('disables the native button when loading is true', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('defaults to type="button" so it never submits a form by accident', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.type).toBe('button');
  });

  it('defaults to the md size padding', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.className).toContain('px-4');
    expect(button.className).toContain('py-2');
  });

  it('applies compact padding/font when size is sm', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.className).toContain('px-2.5');
    expect(button.className).toContain('py-1.5');
    expect(button.className).toContain('text-xs');
    expect(button.className).not.toContain('px-4');
  });
});
