import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CommentComposerComponent } from './comment-composer.component';
import { By } from '@angular/platform-browser';
import { TaskApiService } from '../../data-access/task-api.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

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

  it('renders quick suggestion chips when showQuickChips is true and expands on selection', () => {
    fixture.componentRef.setInput('showQuickChips', true);
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.cc-quick-chip');
    expect(chips.length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Looks good!');

    component.selectQuickChip('🎉 Looks good!', new MouseEvent('click'));
    expect(component.isExpanded()).toBe(true);
  });

  it('uses the shared rich-text editor (with the "/" command palette) for comment input', () => {
    const rte = fixture.nativeElement.querySelector('app-rich-text-editor');
    expect(rte).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cc-editor')).toBeNull();

    const editable = rte.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable.getAttribute('data-placeholder')).toContain('Press / for commands');
  });

  it('syncs editor HTML into editorHtml and routes /attach files to comment attachments', async () => {
    const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as RichTextEditorComponent;

    editor.htmlChange.emit('<div>typed</div>');
    expect(component.editorHtml()).toBe('<div>typed</div>');

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    editor.filesAttached.emit([file]);
    await fixture.whenStable();
    expect(taskApi.uploadPendingFile).toHaveBeenCalledWith(file, 'comment_attachment');
  });

  it('seeds the editor with initialContent when editing an existing comment', () => {
    const editFixture = TestBed.createComponent(CommentComposerComponent);
    editFixture.componentRef.setInput('initialContent', '<div>existing</div>');
    editFixture.detectChanges();

    expect(editFixture.componentInstance.editorHtml()).toContain('existing');
    const editable = editFixture.nativeElement.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable.innerHTML).toContain('existing');
  });

  it('treats an image-only comment as non-empty', () => {
    component.editorHtml.set('<div><img src="/files/f1"></div>');
    expect(component.isEditorEmpty()).toBe(false);
  });

  it('expands editor when M is pressed on window and showProTip is true', () => {
    fixture.componentRef.setInput('showQuickChips', true);
    fixture.componentRef.setInput('showProTip', true);
    fixture.detectChanges();

    expect(component.isExpanded()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    expect(component.isExpanded()).toBe(true);
  });
});
