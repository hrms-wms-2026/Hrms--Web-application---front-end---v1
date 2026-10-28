import DOMPurify from 'dompurify';

/**
 * Removes active content (scripts, event handlers, script URLs, embedded documents) from stored HTML
 * before it is written into a contenteditable with `innerHTML`, which bypasses Angular's sanitizer.
 * Unlike Angular's sanitizer it keeps the editor's own markup (data-* attributes, contenteditable
 * mention chips, checkbox inputs, inline colour styles), so loaded content still edits normally.
 */
export function sanitizeEditableHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['contenteditable'],
    // Mirrors the backend's ConversationRules list; none of these are produced by the editor.
    FORBID_TAGS: ['svg', 'math', 'style', 'form', 'template', 'iframe', 'object', 'embed'],
  });
}
