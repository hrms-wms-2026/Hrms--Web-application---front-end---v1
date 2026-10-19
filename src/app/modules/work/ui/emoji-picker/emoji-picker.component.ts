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
      <div class="ep-grid scroll-fade">
        @for (emoji of emojis; track emoji) {
          <button type="button" class="ep-emoji" (mousedown)="$event.preventDefault()" (click)="emojiSelected.emit(emoji)">{{ emoji }}</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .ep-popover { padding: 8px; border-radius: 8px; background: var(--color-surface); box-shadow: 0 8px 24px rgb(15 23 42 / .18); border: 1px solid var(--color-border); box-sizing: border-box; width: 260px; max-width: calc(100vw - 32px); }
    .ep-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; max-height: 200px; overflow-x: hidden; overflow-y: auto; }
    .ep-emoji { min-width: 0; border: none; background: none; cursor: pointer; font-size: 18px; line-height: 1.4; padding: 4px 0; border-radius: 6px; }
    .ep-emoji:hover { background: var(--color-surface-secondary); }
  `]
})
export class EmojiPickerComponent {
  readonly emojis = CURATED_EMOJI;
  emojiSelected = output<string>();
}
