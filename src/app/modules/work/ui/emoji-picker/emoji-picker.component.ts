import { Component, output } from '@angular/core';

const CURATED_EMOJI = [
  '😀', '😂', '😅', '😊', '😍', '🥳', '😎', '🤔', '😢', '😮', '😡', '🥺', '👀', '🙌',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '🤞', '👌', '🤟', '🫡',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨', '⭐', '🎉', '🎊',
  '✅', '❌', '⚠️', '❓', '❗', '💡', '📌', '🚀', '🐛', '🛠️', '📎', '🕐', '📅',
  '☕', '🍕', '🎂', '🍾', '🍻', '🐶', '🐱', '🦄', '🌟', '🌈', '☀️', '🌙', '💤',
  '👋', '🙋', '🤦', '🤷', '💀', '👻', '🤖', '🎯'
];

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  template: `
    <div class="ep-popover" role="dialog" (click)="$event.stopPropagation()">
      <div class="ep-grid">
        @for (emoji of emojis; track emoji) {
          <button type="button" class="ep-emoji" (mousedown)="$event.preventDefault()" (click)="emojiSelected.emit(emoji)">{{ emoji }}</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .ep-popover { padding: 8px; border-radius: 8px; background: var(--color-surface); box-shadow: 0 8px 24px rgb(15 23 42 / .18); border: 1px solid var(--color-border); max-width: 260px; }
    .ep-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; max-height: 200px; overflow-y: auto; }
    .ep-emoji { border: none; background: none; cursor: pointer; font-size: 18px; padding: 4px; border-radius: 6px; }
    .ep-emoji:hover { background: var(--color-surface-secondary); }
  `]
})
export class EmojiPickerComponent {
  readonly emojis = CURATED_EMOJI;
  emojiSelected = output<string>();
}
