import { Provider, inject } from '@angular/core';
import { RICH_TEXT_IMAGE_UPLOADER, RichTextImageUploader } from '../../../shared/ui/rich-text-editor/rich-text-image-uploader';
import { TaskApiService } from './task-api.service';

/** Inline editor images go through the Work Management pending-upload endpoint, as before the token existed. */
export function provideTaskImageUploader(): Provider {
  return {
    provide: RICH_TEXT_IMAGE_UPLOADER,
    useFactory: (): RichTextImageUploader => {
      const api = inject(TaskApiService);
      return {
        upload: (file, purpose) => api.uploadPendingFile(file, purpose),
        fileUrl: (fileId) => api.getFileUrl(fileId)
      };
    }
  };
}
