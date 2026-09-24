import { TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  it('renders generic fallback avatar when no avatarUrl is provided', async () => {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    const svg = fixture.nativeElement.querySelector('svg');
    expect(img).toBeFalsy();
    expect(svg).toBeTruthy();
  });

  it('renders image when avatarUrl is provided', async () => {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('avatarUrl', 'https://example.com/avatar.png');
    fixture.componentRef.setInput('userName', 'Asha Kumar');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/avatar.png');
    expect(img.alt).toBe("Asha Kumar's avatar");
  });

  it('falls back to generic circular avatar when image load fails', async () => {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('avatarUrl', 'https://example.com/broken-avatar.png');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.avatar__fallback')).toBeTruthy();
  });

  it('shows initials when userName is provided and image is absent', async () => {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('userName', 'Jane Doe');
    fixture.detectChanges();

    const initialsSpan = fixture.nativeElement.querySelector('.avatar__initials');
    expect(initialsSpan?.textContent?.trim()).toBe('JD');
  });

  it('renders circular shape by default and supports xs size', async () => {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('size', 'xs');
    fixture.detectChanges();

    const avatarDiv = fixture.nativeElement.querySelector('.avatar');
    expect(avatarDiv.classList.contains('avatar--circle')).toBe(true);
    expect(avatarDiv.classList.contains('avatar--xs')).toBe(true);
  });

  it('renders unassigned placeholder icon when unassigned is true', async () => {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('unassigned', true);
    fixture.detectChanges();

    const unassignedEl = fixture.nativeElement.querySelector('.avatar--unassigned');
    expect(unassignedEl).toBeTruthy();
    const unassignedIcon = fixture.nativeElement.querySelector('.avatar__icon--unassigned');
    expect(unassignedIcon).toBeTruthy();
  });
});
