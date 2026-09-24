import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CommentComposerComponent } from './comment-composer.component';
import { TaskApiService } from '../../data-access/task-api.service';

describe('CommentComposerComponent', () => {
  let fixture: ComponentFixture<CommentComposerComponent>;
  let component: CommentComposerComponent;
  let taskApi: { uploadPendingFile: ReturnType<typeof vi.fn>; deletePendingFile: ReturnType<typeof vi.fn>; getFileUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    taskApi = {
      uploadPendingFile: vi.fn(() => of({ fileId: 'f1', originalFileName: 'a.png', fileSizeBytes: 10, contentType: 'image/png' })),
      deletePendingFile: vi.fn(() => of(void 0)),
      getFileUrl: vi.fn((id: string) => `/files/${id}`)
    };

    await TestBed.configureTestingModule({
      imports: [CommentComposerComponent],
      providers: [{ provide: TaskApiService, useValue: taskApi }]
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComposerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits submitted with the current editor content and attachment ids', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.editorHtml.set('<p>hello</p>');
    component.attachedFiles.set([{ fileId: 'f1', name: 'a.png', sizeBytes: 10 }]);

    component.submit();

    expect(submitted).toHaveBeenCalledWith({ content: '<p>hello</p>', attachmentFileIds: ['f1'] });
  });

  it('does not emit submitted when the editor is empty', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.editorHtml.set('   ');

    component.submit();

    expect(submitted).not.toHaveBeenCalled();
  });

  it('onFilesSelected uploads each file as comment_attachment and appends the pill', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const fileList = { 0: file, length: 1, item: () => file } as unknown as FileList;

    await component.onFilesSelected(fileList);

    expect(taskApi.uploadPendingFile).toHaveBeenCalledWith(file, 'comment_attachment');
    expect(component.attachedFiles()).toEqual([{ fileId: 'f1', name: 'a.png', sizeBytes: 10 }]);
  });

  it('removeAttachedFile drops the pill and calls deletePendingFile', () => {
    component.attachedFiles.set([{ fileId: 'f1', name: 'a.png', sizeBytes: 10 }]);

    component.removeAttachedFile('f1');

    expect(taskApi.deletePendingFile).toHaveBeenCalledWith('f1');
    expect(component.attachedFiles()).toEqual([]);
  });
});
