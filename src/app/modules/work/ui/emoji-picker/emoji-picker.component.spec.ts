import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EmojiPickerComponent } from './emoji-picker.component';

describe('EmojiPickerComponent', () => {
  it('emits emojiSelected when a grid emoji is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [EmojiPickerComponent] }).compileComponents();
    const fixture = TestBed.createComponent(EmojiPickerComponent);
    const component = fixture.componentInstance;
    const selected = vi.fn();
    component.emojiSelected.subscribe(selected);
    fixture.detectChanges();

    const firstButton: HTMLButtonElement = fixture.nativeElement.querySelector('.ep-emoji');
    firstButton.click();

    expect(selected).toHaveBeenCalledWith(component.emojis[0]);
  });
});
