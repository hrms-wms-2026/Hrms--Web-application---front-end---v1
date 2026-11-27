import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PersonalInfoFormComponent } from './personal-info-form.component';
import { PersonalInformation } from '../../models/profile.model';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from '../../../../core/errors/api-error';

const samplePersonalInfo: PersonalInformation = {
  firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1111',
  dateOfBirth: null, gender: null, nationalityId: null, countryName: null,
  displayTimezone: null, legalEntityTimezone: 'Asia/Colombo', avatarFileId: null, addresses: [], version: '1'
};

const fileApiMockProvider = {
  provide: FileApiService,
  useValue: { getFileUrl: (fileId: string) => `https://api.test/files/${fileId}` }
};

describe('PersonalInfoFormComponent', () => {
  it('pre-fills the form from the personalInformation input', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value.firstName).toBe('Jane');
    expect(fixture.componentInstance.form.value.displayTimezone).toBe('Asia/Colombo');
  });

  it('emits save with the form value and current version when submitted', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    let emitted: unknown;
    fixture.componentInstance.save.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmit();

    expect((emitted as { version: string }).version).toBe('1');
    expect((emitted as { displayTimezone: string | null }).displayTimezone).toBeNull();
  });

  it('emits a personal timezone override when different from the company default', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.form.controls.displayTimezone.setValue('Europe/London');

    let emitted: unknown;
    fixture.componentInstance.save.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmit();

    expect((emitted as { displayTimezone: string | null }).displayTimezone).toBe('Europe/London');
  });

  it('renders the avatar image src built from avatarFileId via FileApiService.getFileUrl', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', { ...samplePersonalInfo, avatarFileId: 'file-9' });
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.avatar__image');
    expect(img.src).toBe('https://api.test/files/file-9');
  });

  it('shows no avatar image when avatarFileId is null', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.avatar__image')).toBeNull();
  });

  it('opens the file picker when the photo circle is clicked and there is no photo', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('.pif-photo-input');
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fixture.nativeElement.querySelector('.pif-avatar-wrap').click();

    expect(clickSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.photoDialogOpen()).toBe(false);
  });

  it('opens the Change photo popup when the photo circle is clicked and a photo exists', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', { ...samplePersonalInfo, avatarFileId: 'file-9' });
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('.pif-photo-input');
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fixture.componentInstance.onAvatarClick(input);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.photoDialogOpen()).toBe(true);
    expect(fixture.componentInstance.pickedPhoto()).toBeNull();
  });

  it('opens the Change photo popup with the picked file after choosing a photo', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.detectChanges();

    const file = new File(['x'], 'me.png', { type: 'image/png' });
    fixture.componentInstance.onAvatarFileSelected({ target: { files: [file], value: 'me.png' } } as unknown as Event);

    expect(fixture.componentInstance.photoDialogOpen()).toBe(true);
    expect(fixture.componentInstance.pickedPhoto()).toBe(file);
  });

  it('emits avatarSelected and closes the popup when the framed photo is saved', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [fileApiMockProvider]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.detectChanges();
    const emitted: File[] = [];
    fixture.componentInstance.avatarSelected.subscribe((f) => emitted.push(f));
    fixture.componentInstance.photoDialogOpen.set(true);

    const file = new File(['x'], 'avatar.jpg', { type: 'image/jpeg' });
    fixture.componentInstance.onPhotoSaved(file);

    expect(emitted).toEqual([file]);
    expect(fixture.componentInstance.photoDialogOpen()).toBe(false);
  });

  describe('server errors (task 20 follow-up)', () => {
    const refused = (errors: Record<string, string[]>) => toApiError(new HttpErrorResponse({ status: 400, error: { errors } }));

    it('shows a refused field message and keeps it when another input changes', () => {
      const fixture = TestBed.createComponent(PersonalInfoFormComponent);
      fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
      fixture.detectChanges();
      fixture.componentRef.setInput('serverError', refused({ FirstName: ['First name must be 100 characters or fewer.'] }));
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('First name must be 100 characters or fewer.');

      fixture.componentRef.setInput('saving', false);
      fixture.detectChanges();
      expect(fixture.componentInstance.form.controls.firstName.errors?.['server']).toEqual({ message: 'First name must be 100 characters or fewer.' });
    });

    it('shows a message with no field on this form inside the form', () => {
      const fixture = TestBed.createComponent(PersonalInfoFormComponent);
      fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
      fixture.componentRef.setInput('serverError', refused({ Version: ['A concurrency version token is required.'] }));
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('A concurrency version token is required.');
    });
  });
});
