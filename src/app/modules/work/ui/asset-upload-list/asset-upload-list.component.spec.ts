import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AssetUploadListComponent, AssetRowView } from './asset-upload-list.component';

describe('AssetUploadListComponent', () => {
  let fixture: ComponentFixture<AssetUploadListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AssetUploadListComponent] });
    fixture = TestBed.createComponent(AssetUploadListComponent);
  });

  it('renders one row per input row with its status', () => {
    const rows: AssetRowView[] = [
      { id: 'a1', fileName: 'plan.pdf', sizeBytes: 2048, status: 'uploaded' },
      { id: 'a2', fileName: 'huge.zip', sizeBytes: 30_000_000, status: 'error', errorMessage: 'File exceeds the maximum allowed size.' }
    ];
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();

    const renderedRows = fixture.nativeElement.querySelectorAll('[data-testid="asset-row"]');
    expect(renderedRows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('plan.pdf');
    expect(fixture.nativeElement.textContent).toContain('File exceeds the maximum allowed size.');
  });

  it('emits filesPicked with the selected files', () => {
    fixture.detectChanges();
    const picked = vi.fn();
    (fixture.componentInstance as any).filesPicked.subscribe(picked);
    const file = new File(['content'], 'plan.pdf', { type: 'application/pdf' });
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="asset-file-input"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    input.dispatchEvent(new Event('change'));

    expect(picked).toHaveBeenCalledWith([file]);
  });

  it('emits removeRequested with the row id when Remove is clicked', () => {
    fixture.componentRef.setInput('rows', [{ id: 'a1', fileName: 'plan.pdf', sizeBytes: 2048, status: 'uploaded' } as AssetRowView]);
    fixture.detectChanges();
    const removed = vi.fn();
    (fixture.componentInstance as any).removeRequested.subscribe(removed);

    (fixture.nativeElement.querySelector('[data-testid="asset-remove-button"]') as HTMLElement).click();

    expect(removed).toHaveBeenCalledWith('a1');
  });

  it('shows a retry control only for error rows, and emits retryRequested with the row id', () => {
    fixture.componentRef.setInput('rows', [{ id: 'a2', fileName: 'huge.zip', sizeBytes: 30_000_000, status: 'error', errorMessage: 'too big' } as AssetRowView]);
    fixture.detectChanges();
    const retried = vi.fn();
    (fixture.componentInstance as any).retryRequested.subscribe(retried);

    const retryButton = fixture.nativeElement.querySelector('[data-testid="asset-retry-button"]') as HTMLElement;
    expect(retryButton).not.toBeNull();
    retryButton.click();

    expect(retried).toHaveBeenCalledWith('a2');
  });
});
