import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { NewGroupChoice, NewGroupDialogComponent } from './new-group-dialog.component';

describe('NewGroupDialogComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render(caseTitle: string | null) {
    TestBed.configureTestingModule({
      imports: [NewGroupDialogComponent],
      providers: [{ provide: ConversationsApiService, useValue: { searchPeople: vi.fn(() => of([])) } }]
    });
    const fixture = TestBed.createComponent(NewGroupDialogComponent);
    fixture.componentRef.setInput('caseTitle', caseTitle);
    fixture.componentRef.setInput('initialPeople', [{ id: 'emp-ravi', name: 'Ravi' }]);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const created: NewGroupChoice[] = [];
    fixture.componentInstance.created.subscribe((c) => created.push(c));
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    return { fixture, q, created };
  }

  it('a case group starts named after its case, and the name can be changed', async () => {
    const { fixture, q, created } = await render('Attendance identity verification');

    const name = q('new-group-name') as HTMLInputElement;
    expect(name.value).toBe('Attendance identity verification');
    name.value = 'Priya clock-in review';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (q('new-group-create') as HTMLButtonElement).click();

    expect(created).toEqual([{ name: 'Priya clock-in review', employeeIds: ['emp-ravi'], photo: null }]);
  });

  it('the framed photo goes out with the group', async () => {
    const { fixture, q, created } = await render(null);
    const photo = new File(['x'], 'group-photo.jpg', { type: 'image/jpeg' });

    (fixture.componentInstance as unknown as { setPhoto(file: File | null): void }).setPhoto(photo);
    fixture.detectChanges();
    const name = q('new-group-name') as HTMLInputElement;
    name.value = 'Payroll review';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (q('new-group-create') as HTMLButtonElement).click();

    expect(q('new-group-photo').querySelector('img')?.getAttribute('src')).toBe('blob:photo');
    expect(created).toEqual([{ name: 'Payroll review', employeeIds: ['emp-ravi'], photo }]);
  });
});
