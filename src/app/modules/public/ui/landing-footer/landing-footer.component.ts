import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './landing-footer.component.html',
  styleUrl: './landing-footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingFooterComponent {
  readonly currentYear = new Date().getFullYear();
}
