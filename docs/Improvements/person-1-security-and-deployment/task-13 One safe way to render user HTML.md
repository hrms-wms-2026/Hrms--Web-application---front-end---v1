# Task 13: One safe way to render user HTML

| | |
|---|---|
| Priority | 13 of 24 (lower number = build first) |
| Owner folder | person-1-security-and-deployment |
| Size | 1 person, 1 day |
| Area | Security |
| Depends on | nothing |

## What we found

Nine templates bind `[innerHTML]`:

- `accept-invitation.component.html:175` (legal document HTML)
- `conversation-panel.component.ts:248, 256, 331` (inbox messages)
- `meeting-occurrence-drawer.component.ts:173` (meeting notes)
- `task-comments.component.ts:113` (task comments)
- plus the rich text editor itself

DOMPurify is in `package.json` but used in only 2 files. The rest rely on Angular's built-in sanitiser, which is good but strips styles in ways the editor has to work around (comments in `rich-text-editor.component.ts` describe this). Two different sanitising paths mean the same content can render differently, and a future `bypassSecurityTrust` call added to "fix" formatting would open a hole. There are none today.

## What to do

1. Create one `safeHtml` pipe in `shared/` that runs DOMPurify with a single allow-list config (allowed tags, allowed attributes, links forced to `rel="noopener noreferrer"` and safe protocols only) and returns trusted HTML.
2. Use it at all nine sites. Remove per-component sanitising code.
3. Add an ESLint rule that forbids `[innerHTML]` without the pipe and forbids `bypassSecurityTrust*` outside the pipe.
4. Add tests with attack strings: script tags, `onerror` attributes, `javascript:` links, SVG with script, style-based tricks.
5. Check the editor's paste path cleans content with the same config before it is saved.
6. Confirm with the backend that it rejects active content on write (`RichTextRules.HasActiveContent`), so both sides protect.

## Done when

- A search for `[innerHTML]` finds only uses with the pipe.
- The attack-string tests pass.
- Saved content looks the same in comments, inbox and meeting notes.
