import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeetingScope } from '../../models/meeting.models';
import { MeetingScopeDialogComponent } from './meeting-scope-dialog.component';

describe('MeetingScopeDialogComponent', () => {
  let fixture: ComponentFixture<MeetingScopeDialogComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MeetingScopeDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('offers this, this and following, and all occurrences', () => {
    const labels = [...fixture.nativeElement.querySelectorAll('[data-testid="meeting-scope-option"]')]
      .map((el: HTMLElement) => el.textContent?.trim());
    expect(labels).toEqual(['This occurrence', 'This and following', 'All occurrences']);
  });

  it('emits the chosen scope', () => {
    let chosen: MeetingScope | undefined;
    fixture.componentInstance.chosen.subscribe((s) => (chosen = s));
    fixture.nativeElement.querySelectorAll('[data-testid="meeting-scope-option"]')[1].click();
    expect(chosen).toBe('following');
  });

  it('can leave out "all" (a move offers this and following only)', () => {
    fixture.componentRef.setInput('scopes', ['this', 'following']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="meeting-scope-option"]').length).toBe(2);
  });
});
