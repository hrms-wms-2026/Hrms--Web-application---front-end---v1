import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `<app-card title="Sign in"><p>body content</p></app-card>`
})
class HostComponent {}

describe('CardComponent', () => {
  it('renders the title and projected content', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Sign in');
    expect(el.textContent).toContain('body content');
  });

  it('omits the heading when no title is given', async () => {
    await TestBed.configureTestingModule({ imports: [CardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CardComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')).toBeFalsy();
  });
});
