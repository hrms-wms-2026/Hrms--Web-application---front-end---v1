export interface PublishedLegalDocumentDto {
  document_type: string;
  version: string;
  title: string;
  content_html: string;
  content_text: string;
  effective_at: string | null;
  content_hash: string;
}
