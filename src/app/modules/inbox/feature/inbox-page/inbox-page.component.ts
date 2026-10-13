import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { InboxStore } from '../../state/inbox.store';

/** The Inbox page (filled in by F3: toolbar, list, detail card and conversation). */
@Component({
  selector: 'app-inbox-page',
  standalone: true,
  template: `<h1 class="inbox-page__title">Inbox</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InboxPageComponent implements OnInit {
  private readonly store = inject(InboxStore);

  ngOnInit(): void {
    void this.store.load();
  }
}
