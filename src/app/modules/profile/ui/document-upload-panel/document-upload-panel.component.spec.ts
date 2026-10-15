import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentUploadPanelComponent } from './document-upload-panel.component';

describe('DocumentUploadPanelComponent', () => {
  let fixture: ComponentFixture<DocumentUploadPanelComponent>;
  let cmp: DocumentUploadPanelComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(DocumentUploadPanelComponent);
    fixture.componentRef.setInput('initialType', 'identity');
    fixture.detectChanges();
    cmp = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  function pick(file: File): void {
    const input = fixture.nativeElement.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('preselects the requested type and moves itself to <body>', () => {
    expect(cmp.type()).toBe('identity');
    expect(fixture.nativeElement.parentElement).toBe(document.body);
  });

  it('defaults the name from the picked file and emits on submit', () => {
    const spy = vi.fn();
    cmp.submitted.subscribe(spy);
    const file = new File(['x'], 'Passport scan.pdf', { type: 'application/pdf' });

    pick(file);
    cmp.submit();

    expect(spy).toHaveBeenCalledWith({ file, type: 'identity', name: 'Passport scan' });
  });

  it('rejects unsupported formats', () => {
    pick(new File(['x'], 'archive.zip', { type: 'application/zip' }));

    expect(cmp.file()).toBeNull();
    expect(cmp.fileError()).toContain('Unsupported format');
  });

  it('rejects files over 10 MB', () => {
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    pick(big);

    expect(cmp.fileError()).toBe('File is larger than 10 MB.');
  });

  it('requires a file before submitting', () => {
    const spy = vi.fn();
    cmp.submitted.subscribe(spy);

    cmp.submit();

    expect(spy).not.toHaveBeenCalled();
    expect(cmp.fileError()).toBe('Choose a file to upload.');
  });
});
