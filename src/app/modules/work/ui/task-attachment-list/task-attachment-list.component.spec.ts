import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskAttachmentListComponent } from './task-attachment-list.component';

describe('TaskAttachmentListComponent', () => {
  let fixture: ComponentFixture<TaskAttachmentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TaskAttachmentListComponent] }).compileComponents();
    fixture = TestBed.createComponent(TaskAttachmentListComponent);
    fixture.componentRef.setInput('files', [{ fileId: 'f1', name: 'spec.pdf', sizeBytes: 2048 }]);
    fixture.detectChanges();
  });

  it('renders a pill per file', () => {
    const pills = fixture.nativeElement.querySelectorAll('.tal-pill');
    expect(pills.length).toBe(1);
    expect(pills[0].textContent).toContain('spec.pdf');
  });

  it('emits removed with the fileId when a pill\'s remove button is clicked', () => {
    const emitted: string[] = [];
    fixture.componentInstance.removed.subscribe((id) => emitted.push(id));
    fixture.nativeElement.querySelector('.tal-pill-remove').click();
    expect(emitted).toEqual(['f1']);
  });

  it('emits the attachment when its file name is clicked', () => {
    const emitted: { fileId: string; name: string }[] = [];
    fixture.componentInstance.downloadRequested.subscribe((file) => emitted.push(file));
    fixture.nativeElement.querySelector('.tal-pill-download').click();
    expect(emitted).toEqual([{ fileId: 'f1', name: 'spec.pdf', sizeBytes: 2048 }]);
  });

  it('emits fileSelected with the chosen FileList', () => {
    let emitted: FileList | null = null;
    fixture.componentInstance.fileSelected.subscribe((f) => (emitted = f));
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.tal-file-input');
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(emitted).not.toBeNull();
  });
});
