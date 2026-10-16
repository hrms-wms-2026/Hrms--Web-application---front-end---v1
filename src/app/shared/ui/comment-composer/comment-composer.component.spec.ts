import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CommentComposerComponent } from './comment-composer.component';
import { By } from '@angular/platform-browser';
import { TaskApiService } from '../../../modules/work/data-access/task-api.service';
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

    expect(submitted).toHaveBeenCalledWith({ content: '<p>hello</p>', attachmentFileIds: ['f1'], mentions: [] });
  });

  it('includes the mentioned employee ids in the submitted payload and resets them afterwards', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.editorHtml.set('<p>hi</p>');
    component.mentions.set(['e1', 'e2']);

    component.submit();

    expect(submitted).toHaveBeenCalledWith({ content: '<p>hi</p>', attachmentFileIds: [], mentions: ['e1', 'e2'] });
    expect(component.mentions()).toEqual([]);
  });

  it('chat variant: a + attach button and a round send button instead of the text actions', () => {
    fixture.componentRef.setInput('variant', 'chat');
    fixture.componentRef.setInput('submitLabel', 'Send');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const send = el.querySelector('[data-testid="composer-send"]') as HTMLButtonElement;

    expect(el.querySelector('.cc-chat')).not.toBeNull();
    expect(el.querySelector('.cc-submit-btn')).toBeNull();
    expect(el.querySelector('.tal-action-row')).toBeNull();
    expect(el.querySelector('[data-testid="composer-attach"] input[type="file"]')).not.toBeNull();
    expect(send.getAttribute('aria-label')).toBe('Send');
    expect(send.disabled).toBe(true);

    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.editorHtml.set('<p>hi</p>');
    fixture.detectChanges();
    expect(send.disabled).toBe(false);
    send.click();
    expect(submitted).toHaveBeenCalledWith({ content: '<p>hi</p>', attachmentFileIds: [], mentions: [] });
  });

  it('keeps the default comment layout (Attach file row and text button) unless the chat variant is asked for', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cc-chat')).toBeNull();
    expect(el.querySelector('.tal-action-row')).not.toBeNull();
    expect(el.querySelector('.cc-submit-btn')).not.toBeNull();
  });

  it('hides the attachment list and the editor attach command when attachments is false', () => {
    fixture.componentRef.setInput('attachments', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-task-attachment-list')).toBeNull();
    const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as RichTextEditorComponent;
    expect(editor.allSlashCommands().some((c) => c.id === 'attach')).toBe(false);
  });

  it('passes mention and slash inputs to the editor and re-emits its outputs', () => {
    const people = [{ id: 'e1', name: 'Priya Raj' }];
    const actions = [{ id: 'approve', label: 'Approve', category: 'ACTIONS' }];
    fixture.componentRef.setInput('mentionCandidates', people);
    fixture.componentRef.setInput('allowAddAndTag', true);
    fixture.componentRef.setInput('extraSlashCommands', actions);
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as RichTextEditorComponent;
    const slash = vi.fn();
    const addAndTag = vi.fn();
    component.slashCommand.subscribe(slash);
    component.addAndTag.subscribe(addAndTag);

    expect(editor.mentionCandidates()).toEqual(people);
    expect(editor.allowAddAndTag()).toBe(true);
    expect(editor.extraSlashCommands()).toEqual(actions);

    editor.slashCommand.emit('approve');
    editor.addAndTag.emit({ id: 'e9', name: 'New Person' });
    editor.mentionsChange.emit(['e1']);

    expect(slash).toHaveBeenCalledWith('approve');
    expect(addAndTag).toHaveBeenCalledWith({ id: 'e9', name: 'New Person' });
    expect(component.mentions()).toEqual(['e1']);
  });

  it('submits when the editor asks to (Enter to send)', () => {
    fixture.componentRef.setInput('enterToSend', true);
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as RichTextEditorComponent;
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.editorHtml.set('<p>hi</p>');

    expect(editor.submitOnEnter()).toBe(true);
    editor.submitRequested.emit();

    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('insertMention forwards to the editor', () => {
    const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as RichTextEditorComponent;
    const spy = vi.spyOn(editor, 'insertMention');

    component.insertMention({ id: 'e9', name: 'New Person' });

    expect(spy).toHaveBeenCalledWith({ id: 'e9', name: 'New Person' });
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

  it('renders a collapsed box without quick-comment chips and expands on click', () => {
    fixture.componentRef.setInput('collapsible', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cc-quick-chip')).toBeNull();
    const box = fixture.nativeElement.querySelector('.cc-collapsed-box') as HTMLElement;
    expect(box).toBeTruthy();

    box.click();
    expect(component.isExpanded()).toBe(true);
  });

  it('uses the shared rich-text editor (with the "/" command palette) for comment input', () => {
    const rte = fixture.nativeElement.querySelector('app-rich-text-editor');
    expect(rte).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cc-editor')).toBeNull();

    const editable = rte.querySelector('[contenteditable="false"]') as HTMLElement;
    expect(editable.getAttribute('data-placeholder')).toContain('Press / for commands');
    expect(getComputedStyle(rte.querySelector('.tfm-editor__toolbar')).display).toBe('none');

    editable.click();
    fixture.detectChanges();
    expect(editable.getAttribute('contenteditable')).toBe('true');
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
    const editable = editFixture.nativeElement.querySelector('[contenteditable="false"]') as HTMLElement;
    expect(editable.innerHTML).toContain('existing');
  });

  it('treats an image-only comment as non-empty', () => {
    component.editorHtml.set('<div><img src="/files/f1"></div>');
    expect(component.isEditorEmpty()).toBe(false);
  });

  it('expands editor when M is pressed on window and showProTip is true', () => {
    fixture.componentRef.setInput('collapsible', true);
    fixture.componentRef.setInput('showProTip', true);
    fixture.detectChanges();

    expect(component.isExpanded()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    expect(component.isExpanded()).toBe(true);
  });

  describe('with a host uploader (chat attachments)', () => {
    const file = (name: string, size: number) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });
    let upload: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      upload = vi.fn((f: File) => of({ fileId: `id-${f.name}`, originalFileName: f.name, fileSizeBytes: f.size }));
      fixture.componentRef.setInput('uploader', { upload, maxFiles: 2, maxBytes: 100 });
      fixture.detectChanges();
    });

    it('uploads through the host instead of task pending uploads, and removing does not delete a task file', async () => {
      await component.onFilesSelected([file('a.pdf', 10)]);
      component.removeAttachedFile('id-a.pdf');

      expect(upload).toHaveBeenCalledTimes(1);
      expect(taskApi.uploadPendingFile).not.toHaveBeenCalled();
      expect(taskApi.deletePendingFile).not.toHaveBeenCalled();
      expect(component.attachedFiles()).toEqual([]);
    });

    it('refuses a file over the size limit and files over the count limit, inline', async () => {
      await component.onFilesSelected([file('big.pdf', 101)]);
      expect(component.uploadError()).toBe('"big.pdf" is larger than the limit.');

      await component.onFilesSelected([file('a.pdf', 1), file('b.pdf', 1), file('c.pdf', 1)]);
      expect(upload).toHaveBeenCalledTimes(2);
      expect(component.uploadError()).toBe('You can attach up to 2 files.');
    });

    it('shows the server reason when an upload is refused (e.g. the file type)', async () => {
      upload.mockReturnValueOnce(throwError(() => ({ error: { detail: 'This file type is not allowed.' } })));
      await component.onFilesSelected([file('x.exe', 1)]);
      expect(component.uploadError()).toBe('This file type is not allowed.');
    });
  });
});
