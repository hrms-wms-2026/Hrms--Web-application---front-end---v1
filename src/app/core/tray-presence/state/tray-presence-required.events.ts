import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrayPresenceRequiredEvents {
  readonly required$ = new Subject<void>();

  publish(): void {
    this.required$.next();
  }
}
