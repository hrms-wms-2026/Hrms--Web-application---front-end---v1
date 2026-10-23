/** Shared look of the inbox action dialogs (same as the comment dialog). */
export const INBOX_DIALOG_STYLES = `
  .idlg { display: flex; flex-direction: column; gap: 12px; }
  .idlg__hint { margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
  .idlg__target { margin: 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: color-mix(in srgb, var(--color-surface-secondary) 40%, transparent); font-size: 13px; }
  .idlg__label { color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .idlg__choices { display: flex; flex-wrap: wrap; gap: 8px; }
  .idlg__choice { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .idlg__choice[aria-pressed="true"] { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); }
  .idlg__choice:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
  .idlg__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
`;
