import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { DraftListItemResponse } from '../../models/onboarding-draft.model';
import { DraftTableComponent } from './draft-table.component';

describe('DraftTableComponent', () => {
  let fixture: ComponentFixture<DraftTableComponent>;

  const draft: DraftListItemResponse = {
    id: 'draft-1',
    employeeName: 'Ada Lovelace',
    positionName: 'Software Engineer',
    departmentName: 'Engineering',
    status: 'waiting_for_seat',
    draftReason: 'waiting_for_seat',
    lastSavedStep: 'employee_details',
    startedByName: 'HR Starter'
  };

  async function setup(drafts: readonly DraftListItemResponse[], hasPermission: boolean) {
    await TestBed.configureTestingModule({
      imports: [DraftTableComponent],
      providers: [{ provide: PermissionService, useValue: { hasPermission: () => hasPermission, hasAnyPermission: () => hasPermission } }]
    }).compileComponents();

    fixture = TestBed.createComponent(DraftTableComponent);
    fixture.componentRef.setInput('drafts', drafts);
    fixture.detectChanges();
  }

  it('renders the empty state when there are no drafts', async () => {
    await setup([], true);
    expect(fixture.nativeElement.textContent).toContain('No drafts');
  });

  it('translates draft status and reason codes to display text, never rendering the raw snake_case code', async () => {
    await setup([draft], true);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Waiting for seat');
    expect(text).not.toContain('waiting_for_seat');
  });

  it('shows the Continue Draft action when the caller holds employees:write', async () => {
    await setup([draft], true);
    const button = fixture.nativeElement.querySelector('button');
    expect(button?.textContent).toContain('Continue Draft');
  });

  it('hides the Continue Draft action without employees:write', async () => {
    await setup([draft], false);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('emits continueDraft with the draft id when clicked', async () => {
    await setup([draft], true);
    const emitted: string[] = [];
    fixture.componentInstance.continueDraft.subscribe((id) => emitted.push(id));

    fixture.nativeElement.querySelector('button')?.click();

    expect(emitted).toEqual(['draft-1']);
  });
});
