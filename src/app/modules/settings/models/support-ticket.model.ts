/** Settings → Support: tickets the tenant raises with CROWNUS support (backend SupportTicketsController). */

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  readonly id: string;
  readonly subject: string;
  readonly description: string;
  readonly status: SupportTicketStatus;
  readonly priority: SupportTicketPriority;
  readonly category: string | null;
  readonly createdByName: string;
  /** True when CROWNUS support opened the ticket for this company. */
  readonly raisedBySupport: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly resolvedAt: string | null;
}

export interface SupportTicketComment {
  readonly id: string;
  readonly ticketId: string;
  readonly authorName: string;
  readonly isFromSupport: boolean;
  readonly body: string;
  readonly createdAt: string;
}

export interface SupportTicketAttachment {
  readonly id: string;
  readonly ticketId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedByName: string;
  readonly isFromSupport: boolean;
  readonly createdAt: string;
}

export interface SupportTicketDetail {
  readonly ticket: SupportTicket;
  readonly comments: readonly SupportTicketComment[];
  readonly attachments: readonly SupportTicketAttachment[];
}

export interface SupportTicketPage {
  readonly items: readonly SupportTicket[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface CreateSupportTicketRequest {
  readonly subject: string;
  readonly description: string;
  readonly priority: SupportTicketPriority;
  readonly category: string | null;
}

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed'
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

export const SUPPORT_PRIORITIES: readonly SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];
export const SUPPORT_STATUSES: readonly SupportTicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

/** Matches the backend upload purpose support_ticket_attachment. */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.zip';
export const SUPPORT_SUBJECT_MAX = 200;
export const SUPPORT_TEXT_MAX = 10000;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
