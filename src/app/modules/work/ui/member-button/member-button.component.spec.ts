import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberButtonComponent } from './member-button.component';

describe('MemberButtonComponent', () => {
  let fixture: ComponentFixture<MemberButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MemberButtonComponent] }).compileComponents();
    fixture = TestBed.createComponent(MemberButtonComponent);
  });

  it('emits pressed when clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.pressed.subscribe(spy);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="member-button"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('shows the member count badge when memberCount is set', () => {
    fixture.componentRef.setInput('memberCount', 3);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="member-count-badge"]').textContent.trim()).toBe('3');
  });

  it('hides the badge when memberCount is 0', () => {
    fixture.componentRef.setInput('memberCount', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="member-count-badge"]')).toBeNull();
  });
});
