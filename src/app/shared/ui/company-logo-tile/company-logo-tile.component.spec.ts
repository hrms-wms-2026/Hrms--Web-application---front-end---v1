import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyLogoTileComponent } from './company-logo-tile.component';

describe('CompanyLogoTileComponent', () => {
  let fixture: ComponentFixture<CompanyLogoTileComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CompanyLogoTileComponent] });
    fixture = TestBed.createComponent(CompanyLogoTileComponent);
  });

  it('renders the first letter of the company name, uppercased, when there is no logo', () => {
    fixture.componentRef.setInput('name', 'acme corp');
    fixture.detectChanges();
    const initial = fixture.nativeElement.querySelector('.company-logo-tile__initial');
    expect(initial?.textContent?.trim()).toBe('A');
  });

  it('falls back to "O" when the name is empty or not provided', () => {
    fixture.detectChanges();
    const initial = fixture.nativeElement.querySelector('.company-logo-tile__initial');
    expect(initial?.textContent?.trim()).toBe('O');
  });

  it('renders an image instead of initials when a logo URL is provided', () => {
    fixture.componentRef.setInput('name', 'Acme Corp');
    fixture.componentRef.setInput('logoUrl', 'https://example.test/logo.png');
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.test/logo.png');
    expect(fixture.nativeElement.querySelector('.company-logo-tile__initial')).toBeFalsy();
  });

  it('gives the image a real alt and gives the fallback tile an accessible label', () => {
    fixture.componentRef.setInput('name', 'Acme Corp');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('.company-logo-tile');
    expect(tile.getAttribute('role')).toBe('img');
    expect(tile.getAttribute('aria-label')).toBe('Acme Corp logo');
    expect(tile.getAttribute('title')).toBe('Acme Corp');

    fixture.componentRef.setInput('logoUrl', 'https://example.test/logo.png');
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img.alt).toBe('Acme Corp logo');
    expect(tile.getAttribute('role')).toBeNull();
  });

  it('applies the requested size class, defaulting to md', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.company-logo-tile--md')).toBeTruthy();
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.company-logo-tile--sm')).toBeTruthy();
  });
});
