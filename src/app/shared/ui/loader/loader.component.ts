import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `
    <div class="flex items-center justify-center gap-2 py-4" role="status" aria-busy="true" [attr.aria-label]="label() || null">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
      @if (label()) {
        <span class="text-sm text-slate-600">{{ label() }}</span>
      }
    </div>
  `
})
export class LoaderComponent {
  label = input<string>('');
}
