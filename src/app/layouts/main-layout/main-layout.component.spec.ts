import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthStore } from '../../core/auth/state/auth.store';

describe('MainLayoutComponent', () => {
  it('renders the top and side navbar shell without legacy branding or placeholder text', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { email: () => 'asha@onevo.test' } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-top-navbar')).toBeTruthy();
    expect(el.querySelector('app-side-navbar')).toBeTruthy();
    expect(el.textContent).not.toContain('ONEVO');
    expect(el.textContent).not.toContain('Navigation will be configured later');
  });

  it('passes the authenticated user email down to the top navbar', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { email: () => 'asha@onevo.test' } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('asha@onevo.test');
  });
});
