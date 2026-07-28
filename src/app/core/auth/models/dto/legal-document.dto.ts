export interface LegalDocumentDto {
  document_type: string;
  version: string;
  title: string;
  effective_at: string;
  content_url: string | null;
}
