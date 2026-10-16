import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentsPanelComponent } from './documents-panel.component';
import { EmployeeDocument } from '../../models/profile.model';

const docs: EmployeeDocument[] = [
  {
    id: 'a', fileId: 'fa', name: 'My Resume', documentType: 'cv', fileName: 'resume.pdf',
    contentType: 'application/pdf', fileSizeBytes: 245 * 1024, uploadedAt: '2026-09-12T10:00:00Z'
  },
  {
    id: 'b', fileId: 'fb', name: 'National ID', documentType: 'identity', fileName: 'id.png',
    contentType: 'image/png', fileSizeBytes: 1.2 * 1024 * 1024, uploadedAt: '2026-08-20T10:00:00Z'
  }
];

describe('DocumentsPanelComponent', () => {
  let fixture: ComponentFixture<DocumentsPanelComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(DocumentsPanelComponent);
    fixture.componentRef.setInput('documents', docs);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('renders a row per document with type chip, date and size', () => {
    const row = el.querySelector('[data-testid="doc-row-a"]')!;
    expect(row.textContent).toContain('My Resume.pdf');
    expect(row.textContent).toContain('CV / Resume');
    expect(row.textContent).toContain('2026-09-12');
    expect(row.textContent).toContain('245 KB');
    expect(el.querySelector('[data-testid="doc-row-b"]')!.textContent).toContain('1.2 MB');
  });

  it('emits the category type when a category card is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.uploadRequested.subscribe(spy);

    (el.querySelector('[data-testid="doc-category-certificate"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('certificate');
  });

  it('filters by search text and by type', () => {
    const cmp = fixture.componentInstance;
    cmp.search.set('national');
    expect(cmp.filtered().map((d) => d.id)).toEqual(['b']);

    cmp.search.set('');
    cmp.onTypeFilter('cv');
    expect(cmp.filtered().map((d) => d.id)).toEqual(['a']);
  });

  it('asks for confirmation before emitting a delete', () => {
    const spy = vi.fn();
    fixture.componentInstance.deleteRequested.subscribe(spy);

    (el.querySelector('[data-testid="doc-row-a"] [data-testid="doc-delete"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(spy).not.toHaveBeenCalled();

    (el.querySelector('[data-testid="doc-confirm-delete"]') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith('a');
  });

  it('opens the document when the row is clicked, and downloads from the icon without viewing', () => {
    const spy = vi.fn();
    fixture.componentInstance.rowAction.subscribe(spy);

    (el.querySelector('[data-testid="doc-row-a"]') as HTMLElement).click();
    expect(spy).toHaveBeenLastCalledWith({ action: 'view', document: docs[0] });

    (el.querySelector('[data-testid="doc-row-a"] [data-testid="doc-download"]') as HTMLButtonElement).click();
    expect(spy).toHaveBeenLastCalledWith({ action: 'download', document: docs[0] });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when there are no documents', () => {
    fixture.componentRef.setInput('documents', []);
    fixture.detectChanges();
    expect(el.textContent).toContain('No documents yet.');
  });
});
