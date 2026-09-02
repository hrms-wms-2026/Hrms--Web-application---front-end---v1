import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrowserReloadService {
  reloadCurrentUrl(): void {
    window.location.reload();
  }
}
