import { Injector, Provider, inject } from '@angular/core';
import { from, map, switchMap } from 'rxjs';
import { RICH_TEXT_IMAGE_UPLOADER, RichTextImageUploader } from '../../../shared/ui/rich-text-editor/rich-text-image-uploader';

/**
 * Inline editor images go through the Work Management pending-upload endpoint, as before the token
 * existed. TaskApiService is loaded on the first upload, so registering this app-wide keeps the
 * Work Management API out of the initial bundle.
 */
export function provideTaskImageUploader(): Provider {
  return {
    provide: RICH_TEXT_IMAGE_UPLOADER,
    useFactory: (): RichTextImageUploader => {
      const injector = inject(Injector);
      return {
        upload: (file, purpose) =>
          from(import('./task-api.service')).pipe(
            map((m) => injector.get(m.TaskApiService)),
            switchMap((api) => api.uploadPendingFile(file, purpose).pipe(map((u) => ({ fileId: u.fileId, url: api.getFileUrl(u.fileId) }))))
          )
      };
    }
  };
}
