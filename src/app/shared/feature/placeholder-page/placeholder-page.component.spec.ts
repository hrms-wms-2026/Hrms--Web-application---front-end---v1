import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PlaceholderPageComponent } from './placeholder-page.component';

function setup(title: string | undefined) {
  TestBed.configureTestingModule({
    imports: [PlaceholderPageComponent],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { data: of({ title }), snapshot: { data: { title } } }
      }
    ]
  });
  const fixture = TestBed.createComponent(PlaceholderPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('PlaceholderPageComponent', () => {
  it('renders the title from route data and an explicit not-built-yet empty state', () => {
    const fixture = setup('Departments');
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('Departments');
    expect(el.textContent).toContain('Not built yet');
  });

  it('falls back to a generic title when route data has none', () => {
    const fixture = setup(undefined);
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Coming soon');
  });
});
