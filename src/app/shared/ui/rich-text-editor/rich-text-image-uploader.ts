import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** What an inline image upload is for; the host app maps it to its own upload purpose. */
export type RichTextImagePurpose = 'task_description_image' | 'comment_description_image';

/**
 * Uploads inline images for the rich text editor. The editor injects it optionally: when no app
 * provides one, the image tool is not shown. Keeps the editor free of any feature module.
 */
export interface RichTextImageUploader {
  upload(file: File, purpose: RichTextImagePurpose): Observable<{ fileId: string }>;
  fileUrl(fileId: string): string;
}

export const RICH_TEXT_IMAGE_UPLOADER = new InjectionToken<RichTextImageUploader>('RICH_TEXT_IMAGE_UPLOADER');
