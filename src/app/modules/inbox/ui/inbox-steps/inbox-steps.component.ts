import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { InboxStepDto } from '../../models/inbox.dto';

/** The request/alert steps timeline: done steps filled, the current one highlighted, upcoming ones hollow. */
@Component({
  selector: 'app-inbox-steps',
  standalone: true,
  imports: [DatePipe],
  template: `
    <ol class="steps" data-testid="inbox-steps">
      @for (step of steps(); track step.key) {
        <li [class]="'steps__step steps__step--' + step.state" data-testid="inbox-step" [attr.data-state]="step.state">
          <span class="steps__dot" aria-hidden="true"></span>
          <div class="steps__body">
            <span class="steps__label">{{ step.label }}@if (step.actor && step.state !== 'current') { <span class="steps__actor"> · {{ step.actor.name }}</span> }</span>
            @if (step.at) { <time class="steps__time">{{ step.at | date: 'MMM d, y h:mm a' }}</time> }
            @if (step.note) { <p class="steps__note">{{ step.note }}</p> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: [`
    .steps { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    .steps__step { --tone: var(--color-text-secondary); position: relative; display: grid; grid-template-columns: 14px minmax(0, 1fr); column-gap: 10px; padding-bottom: 12px; font-size: 12px; }
    .steps__step:not(:last-child)::before { content: ''; position: absolute; top: 12px; bottom: 0; left: 6px; width: 2px; background: var(--color-border); }
    .steps__step--done { --tone: var(--color-accent); }
    .steps__step--current { --tone: var(--color-accent); }
    .steps__dot { position: relative; z-index: 1; width: 14px; height: 14px; margin-top: 1px; border: 2px solid var(--tone); border-radius: 999px; background: var(--color-surface); box-sizing: border-box; }
    .steps__step--done .steps__dot { background: var(--tone); }
    .steps__step--current .steps__dot { box-shadow: 0 0 0 4px color-mix(in srgb, var(--tone) 18%, transparent); }
    .steps__step--upcoming { color: var(--color-text-secondary); }
    .steps__body { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
    .steps__label { font-weight: 600; overflow-wrap: anywhere; }
    .steps__actor { font-weight: 500; color: var(--color-text-secondary); }
    .steps__time { color: var(--color-text-secondary); font-size: 11px; }
    .steps__note { margin: 2px 0 0; color: var(--color-text-secondary); font-size: 11px; overflow-wrap: anywhere; }
  `]
})
export class InboxStepsComponent {
  steps = input.required<readonly InboxStepDto[]>();
}
