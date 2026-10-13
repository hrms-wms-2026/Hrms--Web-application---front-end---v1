import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { TaskApiService } from '../../../modules/work/data-access/task-api.service';

describe('RichTextEditorComponent', () => {
  let fixture: ComponentFixture<RichTextEditorComponent>;
  let comp: RichTextEditorComponent;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let emitted: string[];
  let failures: string[];

  beforeEach(async () => {
    api = {
      uploadPendingFile: vi.fn().mockReturnValue(of({ fileId: 'f1', originalFileName: 'a.png', fileSizeBytes: 100, contentType: 'image/png' })),
      getFileUrl: vi.fn((fileId: string) => `http://test/api/v1/work/tasks/files/${fileId}`)
    };
    await TestBed.configureTestingModule({
      imports: [RichTextEditorComponent],
      providers: [{ provide: TaskApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(RichTextEditorComponent);
    comp = fixture.componentInstance;
    emitted = [];
    failures = [];
    comp.htmlChange.subscribe((html) => emitted.push(html));
    comp.uploadFailed.subscribe((msg) => failures.push(msg));
    fixture.detectChanges();
  });

  it('seeds initialHtml into an empty editor and emits it', () => {
    fixture.componentRef.setInput('initialHtml', '<div>Hello</div>');
    fixture.detectChanges();
    expect(comp.contentEditor()?.nativeElement.innerHTML).toContain('Hello');
    expect(emitted.at(-1)).toContain('Hello');
  });

  it('hides the attach command when allowAttachments is false', () => {
    fixture.componentRef.setInput('allowAttachments', false);
    expect(comp.allSlashCommands().some((c) => c.id === 'attach')).toBe(false);
  });

  it('applies the borderless host class when borderless mode is enabled', () => {
    fixture.componentRef.setInput('borderless', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('rte--borderless');
  });

  it('starts with the toolbar hidden and activates editing when its content is clicked', async () => {
    const content = comp.contentEditor()!.nativeElement;
    const toolbar = fixture.nativeElement.querySelector('.tfm-editor__toolbar') as HTMLElement;

    expect(comp.isReadOnlyMode()).toBe(true);
    expect(content.getAttribute('contenteditable')).toBe('false');
    expect(getComputedStyle(toolbar).display).toBe('none');

    content.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.editorActive()).toBe(true);
    expect(comp.isReadOnlyMode()).toBe(false);
    expect(content.getAttribute('contenteditable')).toBe('true');
    expect(getComputedStyle(toolbar).display).not.toBe('none');
  });

  it('keeps the placeholder visible after an empty editor is activated', async () => {
    const content = comp.contentEditor()!.nativeElement;
    content.innerHTML = '<div><br></div>';
    comp.onEditorInput();

    content.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.editorActive()).toBe(true);
    expect(comp.contentEmpty()).toBe(true);
    expect(content.classList).toContain('tfm-editor__content--empty');
    expect(emitted.at(-1)).toBe('');
  });

  it('keeps formatted content visible but hides editing controls in read-only mode', () => {
    comp.setHtml('<div><span style="color: red; font-style: italic;">Formatted</span></div>');
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();

    const content = comp.contentEditor()!.nativeElement;
    const formatted = content.querySelector('span') as HTMLElement;
    const toolbar = fixture.nativeElement.querySelector('.tfm-editor__toolbar') as HTMLElement;

    expect(content.getAttribute('contenteditable')).toBe('false');
    expect(getComputedStyle(toolbar).display).toBe('none');
    expect(getComputedStyle(formatted).fontStyle).toBe('italic');
    expect(getComputedStyle(formatted).color).toBe('rgb(255, 0, 0)');
  });

  it('uploads inline images with the host-provided purpose', async () => {
    fixture.componentRef.setInput('imageUploadPurpose', 'comment_description_image');
    (document as unknown as { execCommand: () => boolean }).execCommand = vi.fn().mockReturnValue(true);
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await comp.onImageFileSelected({ target: input } as unknown as Event);

    expect(api['uploadPendingFile']).toHaveBeenCalledWith(file, 'comment_description_image');
  });

  it('applyTextColor runs execCommand foreColor and syncs description', async () => {
        // jsdom does not implement document.execCommand, so vi.spyOn (which requires the property to
    // already exist) cannot be used here - stub it directly instead.
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    comp.applyTextColor('#e03131');
    expect(execSpy).toHaveBeenCalledWith('foreColor', false, '#e03131');
    expect(comp.showTextColorPopover()).toBe(false);
  });

  it('applyHighlight runs execCommand hiliteColor', async () => {
        const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    comp.applyHighlight('#fff3bf');
    expect(execSpy).toHaveBeenCalledWith('hiliteColor', false, '#fff3bf');
  });

  it('insertImage uploads the file and inserts an <img> at the saved selection', async () => {
        const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await comp.onImageFileSelected({ target: input } as unknown as Event);

    expect(api['uploadPendingFile']).toHaveBeenCalledWith(file, 'task_description_image');
    expect(execSpy).toHaveBeenCalledWith('insertImage', false, expect.stringContaining('/tasks/files/f1'));
  });

  it('a failed image upload does not touch the editor and surfaces an error', async () => {
        api['uploadPendingFile'] = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await comp.onImageFileSelected({ target: input } as unknown as Event);

    expect(execSpy).not.toHaveBeenCalledWith('insertImage', expect.anything(), expect.anything());
    expect(failures.length).toBe(1);
  });

  it('filteredSlashCommands filters by keyword, label, and description', () => {
    expect(comp.allSlashCommands().length).toBe(15);

    comp.slashQuery.set('');
    expect(comp.filteredSlashCommands().length).toBe(15);

    comp.slashQuery.set('bold');
    expect(comp.filteredSlashCommands().some((c) => c.id === 'bold')).toBe(true);

    comp.slashQuery.set('h1');
    expect(comp.filteredSlashCommands().some((c) => c.id === 'h1')).toBe(true);

    comp.slashQuery.set('todo');
    expect(comp.filteredSlashCommands().some((c) => c.id === 'checklist')).toBe(true);

    comp.slashQuery.set('xyznotfound123');
    expect(comp.filteredSlashCommands().length).toBe(0);
  });

  it('ArrowDown and ArrowUp navigate the filtered commands with wrap-around', () => {
    comp.showSlashMenu.set(true);
    comp.slashQuery.set('');
    comp.slashSelectedIndex.set(0);

    const total = comp.filteredSlashCommands().length;

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(comp.slashSelectedIndex()).toBe(1);

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(comp.slashSelectedIndex()).toBe(0);

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(comp.slashSelectedIndex()).toBe(total - 1);
  });

  it('Escape closes the slash menu and stops the event reaching the host (so the modal stays open)', () => {
    comp.showSlashMenu.set(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    const stopSpy = vi.spyOn(event, 'stopPropagation');

    comp.onEditorKeydown(event);

    expect(comp.showSlashMenu()).toBe(false);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('Enter executes the selected slash command and closes menu', () => {
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.showSlashMenu.set(true);
    comp.slashQuery.set('bold');
    comp.slashSelectedIndex.set(0);

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(comp.showSlashMenu()).toBe(false);
    expect(execSpy).toHaveBeenCalledWith('bold', false, undefined);
  });

  it('executeSlashCommand for link opens the link popover', () => {
    comp.showSlashMenu.set(true);

    comp.executeSlashCommand('link');

    expect(comp.showSlashMenu()).toBe(false);
    expect(comp.showLinkPopover()).toBe(true);
  });

  it('executeSlashCommand for highlight applies highlight color', () => {
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.executeSlashCommand('highlight');

    expect(execSpy).toHaveBeenCalledWith('hiliteColor', false, '#fff3bf');
  });

  it('executeSlashCommand for divider inserts horizontal rule', () => {
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.executeSlashCommand('divider');

    expect(execSpy).toHaveBeenCalledWith('insertHorizontalRule', false, undefined);
  });

  it('onEditorFocus calls execCommand defaultParagraphSeparator div', () => {
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.onEditorFocus();
    expect(execSpy).toHaveBeenCalledWith('defaultParagraphSeparator', false, 'div');
  });

  it('Enter inside a checklist item with text creates a new checklist item below', () => {
    const editor = comp.contentEditor()?.nativeElement;
    expect(editor).toBeTruthy();
    if (!editor) return;

    const item = comp.createChecklistItem('Buy groceries');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan.firstChild ?? textSpan, 13);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    const checkItems = editor.querySelectorAll('.tfm-check-item');
    expect(checkItems.length).toBe(2);
  });

  it('Enter inside an empty checklist item exits checklist to a normal div line', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan, 0);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.querySelector('.tfm-check-item')).toBeNull();
    const div = editor.querySelector('div');
    expect(div).toBeTruthy();
    expect(div?.querySelector('br')).toBeTruthy();
  });

  it('Backspace at the start of a checklist item converts it to a normal line', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('Some item');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan.firstChild ?? textSpan, 0);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.querySelector('.tfm-check-item')).toBeNull();
    expect(editor.textContent).toContain('Some item');
  });

  it('Enter inside a heading exits to a normal div line below it', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const h2 = document.createElement('h2');
    h2.textContent = 'Section Title';
    editor.appendChild(h2);

    const range = document.createRange();
    range.setStart(h2.firstChild!, 13);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.children.length).toBe(2);
    expect(editor.children[0].tagName).toBe('H2');
    expect(editor.children[1].tagName).toBe('DIV');
  });

  it('toolbar H1 formats only the selected text and does not activate explicit Bold', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div>First second third</div>';
    const text = editor.querySelector('div')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 12);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.formatSelectedHeading('h1');

    const headingText = editor.querySelector('.tfm-inline-h1') as HTMLElement;
    expect(headingText.textContent).toBe('second');
    expect(editor.textContent).toBe('First second third');
    expect(editor.querySelector('h1')).toBeNull();
    expect(comp.activeFormats().h1).toBe(true);
    expect(comp.activeFormats().bold).toBe(false);
  });

  it('slash H1 changes the current line so following text is entered as a block heading', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div>/h1</div>';
    const text = editor.querySelector('div')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.executeSlashCommand('h1');

    const heading = editor.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('');
  });

  it('Ctrl+Z restores the previous editor state and Ctrl+Shift+Z reapplies it', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div>Before</div>';
    comp.onEditorInput();
    editor.innerHTML = '<div>After</div>';
    comp.onEditorInput();

    const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    comp.onEditorKeydown(undoEvent);
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(editor.textContent).toBe('Before');

    const redoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, cancelable: true });
    comp.onEditorKeydown(redoEvent);
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(editor.textContent).toBe('After');
  });

  it('toggling checkbox marks item with is-checked and updates description', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('Do homework');
    editor.appendChild(item);

    const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;

    comp.onEditorChange({ target: checkbox } as unknown as Event);

    expect(item.classList.contains('is-checked')).toBe(true);
    expect(checkbox.hasAttribute('checked')).toBe(true);
    expect(emitted.at(-1)).toContain('is-checked');
  });

  it('toggleHeading(h1) turns H1 on, and clicking it again turns it OFF back to a normal div', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const div = document.createElement('div');
    div.textContent = 'My Title';
    editor.appendChild(div);

    const range = document.createRange();
    range.setStart(div.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.toggleHeading('h1');
    const h1 = editor.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toContain('My Title');

    const h1Range = document.createRange();
    h1Range.setStart(h1!.firstChild!, 2);
    h1Range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(h1Range);

    comp.toggleHeading('h1');
    expect(editor.querySelector('h1')).toBeNull();
    const turnedOffDiv = editor.querySelector('div');
    expect(turnedOffDiv).toBeTruthy();
    expect(turnedOffDiv?.textContent).toContain('My Title');
  });

  it('toggleChecklist turns checklist OFF when currently on a checklist item', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('Checklist task');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan.firstChild ?? textSpan, 4);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    expect(editor.querySelector('.tfm-check-item')).toBeTruthy();

    comp.toggleChecklist();

    expect(editor.querySelector('.tfm-check-item')).toBeNull();
    expect(editor.textContent).toContain('Checklist task');
  });

  it('toggleCode turns code OFF when selection is inside a code tag', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const code = document.createElement('code');
    code.textContent = 'const x = 1;';
    editor.appendChild(code);

    const range = document.createRange();
    range.setStart(code.firstChild!, 3);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    expect(editor.querySelector('code')).toBeTruthy();

    comp.toggleCode();

    expect(editor.querySelector('code')).toBeNull();
    expect(editor.textContent).toContain('const x = 1;');
  });

  it('updateActiveFormats accurately detects active formats at cursor position', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    const h1 = document.createElement('h1');
    const bold = document.createElement('b');
    bold.textContent = 'Bold Title';
    h1.appendChild(bold);
    editor.appendChild(h1);

    const range = document.createRange();
    range.setStart(bold.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.activeFormats().h1).toBe(true);
    expect(comp.activeFormats().bold).toBe(true);
    expect(comp.activeFormats().italic).toBe(false);
  });

  it('does not mark Bold active for a heading unless bold was explicitly applied', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<h1>Heading only</h1>';
    const headingText = editor.querySelector('h1')!.firstChild!;
    const range = document.createRange();
    range.setStart(headingText, 3);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.activeFormats().h1).toBe(true);
    expect(comp.activeFormats().bold).toBe(false);
  });

  it('toggleHeading on one line leaves sibling lines untouched', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div>Line 1</div><div>Line 2</div><div>Line 3</div>';
    comp.normalizeBlockLines(editor);

    const line2 = editor.children[1] as HTMLElement;
    const range = document.createRange();
    range.setStart(line2.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.toggleHeading('h1');

    expect(editor.children.length).toBe(3);
    expect(editor.children[0].tagName.toLowerCase()).toBe('div');
    expect(editor.children[0].textContent).toContain('Line 1');
    expect(editor.children[1].tagName.toLowerCase()).toBe('h1');
    expect(editor.children[1].textContent).toContain('Line 2');
    expect(editor.children[2].tagName.toLowerCase()).toBe('div');
    expect(editor.children[2].textContent).toContain('Line 3');
  });

  it('formatNormalText converts only targeted heading leaving other headings untouched', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<h1>Heading 1</h1><h1>Heading 2</h1>';
    comp.normalizeBlockLines(editor);

    const firstH1 = editor.children[0] as HTMLElement;
    const range = document.createRange();
    range.setStart(firstH1.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.formatNormalText();

    expect(editor.children[0].tagName.toLowerCase()).toBe('div');
    expect(editor.children[0].textContent).toContain('Heading 1');
    expect(editor.children[1].tagName.toLowerCase()).toBe('h1');
    expect(editor.children[1].textContent).toContain('Heading 2');
  });

  it('isSlashCommandActive indicates current active formatting correctly', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<h2>Subtitle</h2>';
    comp.normalizeBlockLines(editor);

    const h2 = editor.children[0] as HTMLElement;
    const range = document.createRange();
    range.setStart(h2.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.isSlashCommandActive('h2')).toBe(true);
    expect(comp.isSlashCommandActive('h1')).toBe(false);
    expect(comp.isSlashCommandActive('p')).toBe(false);
  });

  it('detects link format and does not falsely mark underline on a link', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div><a href="https://angular.io" class="tfm-preview-link">Angular</a></div>';
    comp.normalizeBlockLines(editor);

    const a = editor.querySelector('a') as HTMLAnchorElement;
    expect(a).toBeTruthy();

    const range = document.createRange();
    range.setStart(a.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.activeFormats().link).toBe(true);
    expect(comp.activeFormats().underline).toBe(false);
    expect(comp.isSlashCommandActive('link')).toBe(true);
    expect(comp.isSlashCommandActive('underline')).toBe(false);
  });

  it('removeLink unwraps an existing anchor tag back to plain text', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div><a href="https://angular.io" class="tfm-preview-link">Angular</a></div>';
    comp.normalizeBlockLines(editor);

    const a = editor.querySelector('a') as HTMLAnchorElement;
    const range = document.createRange();
    range.setStart(a.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.removeLink();

    expect(editor.querySelector('a')).toBeNull();
    expect(editor.textContent).toContain('Angular');
    expect(comp.activeFormats().link).toBe(false);
  });

  it('writes text color without inline CSS when cssStyles is false (comment rendering keeps <font color>)', () => {
    fixture.componentRef.setInput('cssStyles', false);
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.applyTextColor('#e03131');

    expect(execSpy).toHaveBeenCalledWith('styleWithCSS', false, 'false');
    expect(execSpy).toHaveBeenCalledWith('foreColor', false, '#e03131');
  });

  it('opens slash menu upward when vertical space below is constrained', () => {
    const editor = comp.contentEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div>/test</div>';
    comp.normalizeBlockLines(editor);

    const range = document.createRange();
    const textNode = editor.querySelector('div')!.firstChild!;
    range.setStart(textNode, 5);
    range.collapse(true);

    range.getBoundingClientRect = () => ({
      top: 730,
      bottom: 750,
      left: 100,
      right: 100,
      width: 0,
      height: 20,
      x: 100,
      y: 730,
      toJSON: () => {}
    } as DOMRect);

    comp.updateSlashMenuPosition(range);

    const coords = comp.slashMenuCoords();
    expect(coords).not.toBeNull();
    expect(coords?.openUpward).toBe(true);
    expect(coords?.top).toBeNull();
    expect(coords?.bottom).toBeGreaterThanOrEqual(0);
    expect(coords?.maxHeight).toBeLessThanOrEqual(310);
  });

  it('renders .tfm-slash-menu--upward and applies bottom positioning style when openUpward is true', () => {
    comp.slashMenuCoords.set({
      top: null,
      bottom: 42,
      left: 20,
      openUpward: true,
      maxHeight: 280
    });
    comp.showSlashMenu.set(true);
    comp.slashQuery.set('');
    fixture.detectChanges();

    const menuEl = fixture.nativeElement.querySelector('.tfm-slash-menu') as HTMLElement;
    expect(menuEl).toBeTruthy();
    expect(menuEl.classList.contains('tfm-slash-menu--upward')).toBe(true);
    expect(menuEl.style.bottom).toBe('42px');
    expect(menuEl.style.top).toBe('auto');
    expect(menuEl.style.maxHeight).toBe('280px');
  });

  function placeCaret(html: string, offset: number): HTMLElement {
    const editor = comp.contentEditor()!.nativeElement;
    editor.innerHTML = html;
    const text = editor.querySelector('div')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, offset);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    return editor;
  }

  describe('host slash commands', () => {
    const actions = [
      { id: 'approve', label: 'Approve', category: 'ACTIONS', icon: '✓' },
      { id: 'reject', label: 'Reject', category: 'ACTIONS', icon: '✕' }
    ];

    it('lists host commands ahead of the formatting commands', () => {
      fixture.componentRef.setInput('extraSlashCommands', actions);
      const ids = comp.allSlashCommands().map((c) => c.id);
      expect(ids.slice(0, 2)).toEqual(['approve', 'reject']);
      expect(ids).toContain('bold');
    });

    it('filters host commands by label', () => {
      fixture.componentRef.setInput('extraSlashCommands', actions);
      comp.slashQuery.set('appr');
      expect(comp.filteredSlashCommands().map((c) => c.id)).toEqual(['approve']);
    });

    it('emits slashCommand for a host command, removes the "/" token and does not format the text', () => {
      fixture.componentRef.setInput('extraSlashCommands', actions);
      const execSpy = vi.fn().mockReturnValue(true);
      (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
      const picked: string[] = [];
      comp.slashCommand.subscribe((id) => picked.push(id));
      const editor = placeCaret('<div>hi /appr</div>', 8);

      comp.executeSlashCommand('approve');

      expect(picked).toEqual(['approve']);
      expect(editor.textContent).toBe('hi ');
      const formattingCalls = execSpy.mock.calls.filter(([cmd]) => cmd !== 'defaultParagraphSeparator');
      expect(formattingCalls).toEqual([]);
    });
  });

  describe('@mentions', () => {
    const people = [
      { id: 'e1', name: 'Priya Raj', avatarUrl: null },
      { id: 'e2', name: 'Kajan Siva', avatarUrl: null }
    ];

    it('does not open the mention menu when mentions are not enabled', () => {
      placeCaret('<div>@pr</div>', 3);
      comp.onEditorInput();
      expect(comp.showMentionMenu()).toBe(false);
    });

    it('opens the mention menu on "@" and filters participants by the typed query', () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      placeCaret('<div>hey @pr</div>', 7);
      comp.onEditorInput();

      expect(comp.showMentionMenu()).toBe(true);
      expect(comp.filteredMentionCandidates().map((p) => p.id)).toEqual(['e1']);
    });

    it('ignores an "@" that is part of a word (e.g. an email address)', () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      placeCaret('<div>a@pr</div>', 4);
      comp.onEditorInput();
      expect(comp.showMentionMenu()).toBe(false);
    });

    it('picking a participant replaces the "@query" with a mention span and emits mentionsChange', () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      const mentions: string[][] = [];
      comp.mentionsChange.subscribe((ids) => mentions.push(ids));
      const editor = placeCaret('<div>hey @pr</div>', 7);
      comp.onEditorInput();

      comp.pickMention(people[0]);

      const span = editor.querySelector('span.mention') as HTMLElement;
      expect(span).toBeTruthy();
      expect(span.getAttribute('data-employee-id')).toBe('e1');
      expect(span.getAttribute('contenteditable')).toBe('false');
      expect(span.textContent).toBe('@Priya Raj');
      expect(editor.textContent).not.toContain('@pr ');
      expect(comp.showMentionMenu()).toBe(false);
      expect(mentions.at(-1)).toEqual(['e1']);
    });

    it('Enter picks the highlighted mention instead of inserting a new line', () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      const editor = placeCaret('<div>@ka</div>', 3);
      comp.onEditorInput();
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

      comp.onEditorKeydown(event);

      expect(event.defaultPrevented).toBe(true);
      expect(editor.querySelector('span.mention')?.getAttribute('data-employee-id')).toBe('e2');
    });

    it('mentionsChange drops an id once its span is deleted and de-duplicates repeats', () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      const mentions: string[][] = [];
      comp.mentionsChange.subscribe((ids) => mentions.push(ids));
      const editor = comp.contentEditor()!.nativeElement;

      editor.innerHTML = '<div><span class="mention" data-employee-id="e1">@Priya Raj</span> and <span class="mention" data-employee-id="e1">@Priya Raj</span></div>';
      comp.onEditorInput();
      expect(mentions.at(-1)).toEqual(['e1']);

      editor.innerHTML = '<div>nobody</div>';
      comp.onEditorInput();
      expect(mentions.at(-1)).toEqual([]);
    });

    it('offers "add and tag" search results that are not participants and emits addAndTag', async () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      fixture.componentRef.setInput('allowAddAndTag', true);
      fixture.componentRef.setInput('mentionSearch', (q: string) =>
        of([{ id: 'e1', name: 'Priya Raj', avatarUrl: null }, { id: 'e9', name: 'Priyanka New', avatarUrl: null }].filter((p) => p.name.toLowerCase().startsWith(q))));
      const added: string[] = [];
      comp.addAndTag.subscribe((c) => added.push(c.id));
      placeCaret('<div>@pri</div>', 4);
      comp.onEditorInput();
      await fixture.whenStable();

      expect(comp.addAndTagResults().map((p) => p.id)).toEqual(['e9']);

      comp.pickAddAndTag(comp.addAndTagResults()[0]);
      expect(added).toEqual(['e9']);
    });

    it('insertMention after add-and-tag places the span where the "@query" was typed', async () => {
      fixture.componentRef.setInput('mentionCandidates', people);
      fixture.componentRef.setInput('allowAddAndTag', true);
      fixture.componentRef.setInput('mentionSearch', () => of([{ id: 'e9', name: 'Priyanka New', avatarUrl: null }]));
      const editor = placeCaret('<div>hi @pri</div>', 7);
      comp.onEditorInput();
      await fixture.whenStable();
      comp.pickAddAndTag(comp.addAndTagResults()[0]);

      comp.insertMention({ id: 'e9', name: 'Priyanka New', avatarUrl: null });

      expect(editor.querySelector('span.mention')?.getAttribute('data-employee-id')).toBe('e9');
      expect(editor.textContent?.startsWith('hi @Priyanka New')).toBe(true);
    });
  });
});
