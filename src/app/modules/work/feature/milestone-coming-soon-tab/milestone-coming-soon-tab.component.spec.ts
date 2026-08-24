import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MilestoneComingSoonTabComponent } from './milestone-coming-soon-tab.component';

describe('MilestoneComingSoonTabComponent', () => {
  function setup(title: string | undefined): ComponentFixture<MilestoneComingSoonTabComponent> {
    TestBed.configureTestingModule({
      imports: [MilestoneComingSoonTabComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: title === undefined ? {} : { title } } } }
      ]
    });
    const fixture = TestBed.createComponent(MilestoneComingSoonTabComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('reads the title from route data and shows it as Coming soon', () => {
    const fixture = setup('Board');
    expect(fixture.nativeElement.textContent).toContain('Board — Coming soon');
  });

  it('reflects a different route data title', () => {
    const fixture = setup('Backlog');
    expect(fixture.nativeElement.textContent).toContain('Backlog — Coming soon');
  });

  it('falls back to a generic title when route data has none', () => {
    const fixture = setup(undefined);
    expect(fixture.nativeElement.textContent).toContain('This view — Coming soon');
  });
});
