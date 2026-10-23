import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectApiService } from '../../../data-access/project-api.service';
import { MeetingMoveChoice, MeetingMoveDialogComponent } from './meeting-move-dialog.component';

describe('MeetingMoveDialogComponent', () => {
  let fixture: ComponentFixture<MeetingMoveDialogComponent>;
  let dialog: MeetingMoveDialogComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{
        provide: ProjectApiService,
        useValue: {
          listMine: () => of({ items: [{ id: 'p1', name: 'Acme' }], totalCount: 1 }),
          getProjectTree: () => of([{ id: 'o1', title: 'Delivery' }, { id: 'o2', title: 'Design' }]),
        },
      }],
    });
    TestBed.overrideComponent(MeetingMoveDialogComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
    fixture = TestBed.createComponent(MeetingMoveDialogComponent);
    dialog = fixture.componentInstance;
    fixture.componentRef.setInput('currentObjectiveId', 'o1');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('emits the destination module and scope, and leaves out the module the meeting is already in', async () => {
    await dialog.selectProject('p1');
    expect(dialog.modules().map((m) => m.id)).toEqual(['o2']);

    let chosen: MeetingMoveChoice | undefined;
    dialog.chosen.subscribe((c) => (chosen = c));
    dialog.objectiveId.set('o2');
    dialog.confirm();

    expect(chosen).toEqual({ scope: 'this', projectId: 'p1', objectiveId: 'o2' });
  });

  it('offers "this and following" only for a recurring meeting', () => {
    expect(dialog.scopes()).toEqual(['this']);
    fixture.componentRef.setInput('recurring', true);
    expect(dialog.scopes()).toEqual(['this', 'following']);
  });
});
