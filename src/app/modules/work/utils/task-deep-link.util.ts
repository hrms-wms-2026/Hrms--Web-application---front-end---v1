export function buildTaskDeepLink(
  origin: string,
  projectId: string,
  taskId: string,
  commentId?: string
): string {
  const base = `${origin}/work/${encodeURIComponent(projectId)}/board`;
  const url = `${base}?taskId=${encodeURIComponent(taskId)}`;
  return commentId ? `${url}#comment-${encodeURIComponent(commentId)}` : url;
}

/** Clipboard API requires a secure context; the textarea path keeps sharing usable otherwise. */
export async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy copy path.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
