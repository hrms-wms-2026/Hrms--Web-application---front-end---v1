import { TestBed } from '@angular/core/testing';
import { HomePageProfileCapsuleComponent } from './home-page-profile-capsule.component';

describe('HomePageProfileCapsuleComponent', () => {
  it('renders an avatar component instance', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', 'Asha Kumar');
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('app-avatar');
    expect(avatar).toBeTruthy();
  });
});
