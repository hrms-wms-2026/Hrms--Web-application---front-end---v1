import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComingSoonPanelComponent } from './coming-soon-panel.component';

describe('ComingSoonPanelComponent', () => {
  let fixture: ComponentFixture<ComingSoonPanelComponent>;

  it('renders the given title with a Coming soon suffix', () => {
    fixture = TestBed.createComponent(ComingSoonPanelComponent);
    fixture.componentRef.setInput('title', 'Board');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Board — Coming soon');
  });

  it('renders a different title for a different tab', () => {
    fixture = TestBed.createComponent(ComingSoonPanelComponent);
    fixture.componentRef.setInput('title', 'Backlog');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Backlog — Coming soon');
  });
});
