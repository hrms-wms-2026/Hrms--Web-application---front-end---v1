import { TestBed } from '@angular/core/testing';
import { HomePageProfileCapsuleComponent } from './home-page-profile-capsule.component';

describe('HomePageProfileCapsuleComponent', () => {
  it('shows userName when provided', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', 'Asha Kumar');
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Asha Kumar');
  });

  it('falls back to email when userName is not provided', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('asha@onevo.test');
  });

  it('falls back to email when userName is blank (whitespace only)', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', '   ');
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('asha@onevo.test');
  });

  it('shows "User" when neither userName nor email is provided', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('User');
  });

  it('shows "User" when both inputs are explicitly null', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', null);
    fixture.componentRef.setInput('email', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('User');
  });

  it('renders a long identity value fully in the DOM and exposes it via title (visual truncation is CSS-only)', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    const longEmail = 'a.very.long.employee.email.address.for.testing@onevo-enterprise-workspace.example.com';
    fixture.componentRef.setInput('email', longEmail);
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.profile-capsule') as HTMLElement;
    expect(span.textContent?.trim()).toBe(longEmail);
    expect(span.getAttribute('title')).toBe(longEmail);
  });
});
