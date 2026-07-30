import { TestBed } from '@angular/core/testing';
import { SideNavbarComponent } from './side-navbar.component';

describe('SideNavbarComponent', () => {
  it('renders an empty navigation shell', async () => {
    await TestBed.configureTestingModule({ imports: [SideNavbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SideNavbarComponent);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement | null;
    expect(nav).toBeTruthy();
    expect(nav?.textContent?.trim()).toBe('');
  });
});
