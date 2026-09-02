import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-locked-workspace-preview',
  standalone: true,
  templateUrl: './locked-workspace-preview.component.html',
  styleUrl: './locked-workspace-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LockedWorkspacePreviewComponent {}
