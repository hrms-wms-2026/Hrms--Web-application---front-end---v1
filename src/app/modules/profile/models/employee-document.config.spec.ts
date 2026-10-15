import { toViewableBlob } from './employee-document.config';

describe('toViewableBlob', () => {
  it('re-types PDFs and images from the extension, ignoring the reported type', () => {
    const blob = new Blob(['x'], { type: 'text/html' });

    expect(toViewableBlob(blob, 'resume.PDF')?.type).toBe('application/pdf');
    expect(toViewableBlob(blob, 'id.jpg')?.type).toBe('image/jpeg');
  });

  it('refuses anything that is not a PDF or raster image', () => {
    const blob = new Blob(['x'], { type: 'image/png' });

    expect(toViewableBlob(blob, 'letter.docx')).toBeNull();
    expect(toViewableBlob(blob, 'evil.svg')).toBeNull();
    expect(toViewableBlob(blob, 'page.html')).toBeNull();
  });
});
