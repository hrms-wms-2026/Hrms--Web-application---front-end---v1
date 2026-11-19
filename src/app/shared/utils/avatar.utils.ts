/**
 * Extracts initials from a user's full name.
 * - For 2 or more words: returns first letter of first word + first letter of last word.
 * - For 1 word: returns up to the first 2 letters.
 * - For empty or invalid input: returns empty string.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? '';
    const last = parts[parts.length - 1]?.[0] ?? '';
    return (first + last).toUpperCase();
  }

  if (parts.length === 1 && parts[0]) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return '';
}
