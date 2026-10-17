import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../button/button.component';

/** Size of the on-screen crop area (CSS px) and of the saved square image (px). */
const VIEW_SIZE = 250;
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const PAN_STEP = 10;

export const PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp';
const ACCEPTED_TYPES = PHOTO_ACCEPT.split(',');

export type ChangePhotoShape = 'circle' | 'square';

/**
 * "Change photo" popup: frame an image (drag to move, zoom, rotate), pick another one, or remove it.
 * Save emits the framed image as a square file. Used for the profile avatar (circle, cropped to fill,
 * JPEG) and the company logo (rounded square, can zoom out until the whole logo fits, PNG so
 * transparency survives).
 * The host is moved to <body> on render: inside another dialog its fixed positioning would be
 * relative to that dialog's transform.
 */
@Component({
  selector: 'app-change-photo-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './change-photo-dialog.component.html',
  styleUrl: './change-photo-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cpd-host',
    'animate.leave': 'ui-popup-leave',
    '(document:keydown.escape)': 'closed.emit()'
  }
})
export class ChangePhotoDialogComponent implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);

  readonly title = input('Change photo');
  readonly shape = input<ChangePhotoShape>('circle');
  /** Base name of the saved file; the extension follows the shape (circle .jpg, square .png). */
  readonly fileName = input('photo');
  /** An image the user just picked; framed and saved as the new one. */
  readonly initialFile = input<File | null>(null);
  /** The current image, fetched through HttpClient so auth applies, for re-framing when no file was
   * picked. Its presence also enables Remove. */
  readonly existingUrl = input<string | null>(null);

  readonly saved = output<File>();
  readonly removed = output<void>();
  readonly closed = output<void>();

  readonly accept = PHOTO_ACCEPT;
  readonly viewSize = VIEW_SIZE;
  readonly maxZoom = MAX_ZOOM;

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly image = signal<HTMLImageElement | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly zoom = signal(1);
  readonly rotation = signal(0);
  readonly offset = signal({ x: 0, y: 0 });
  /** Save stays disabled until the image or its framing changes. */
  readonly dirty = signal(false);

  readonly canRemove = computed(() => !!this.existingUrl());

  /** Zoom 1 fills the crop square. A square crop may zoom out until the whole image fits. */
  readonly minZoom = computed(() => {
    const image = this.image();
    if (this.shape() !== 'square' || !image) return 1;
    return Math.min(image.naturalWidth, image.naturalHeight) / Math.max(image.naturalWidth, image.naturalHeight);
  });

  private drag: { pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null = null;

  constructor() {
    afterNextRender(() => {
      this.document.body.appendChild(this.host.nativeElement);
      this.host.nativeElement.querySelector<HTMLElement>('.cpd')?.focus();
    });

    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      const image = this.image();
      if (!canvas || !image) return;
      const dpr = this.document.defaultView?.devicePixelRatio ?? 1;
      canvas.width = Math.round(VIEW_SIZE * dpr);
      canvas.height = Math.round(VIEW_SIZE * dpr);
      this.draw(canvas, image, dpr, this.zoom(), this.rotation(), this.offset());
    });
  }

  ngOnInit(): void {
    const file = this.initialFile();
    if (file) {
      void this.loadFile(file, true);
      return;
    }
    const url = this.existingUrl();
    if (url) void this.loadExisting(url);
  }

  // ── Loading ──────────────────────────────────────────────────────────

  onChangeFile(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (file) void this.loadFile(file, true);
  }

  private async loadExisting(url: string): Promise<void> {
    this.loading.set(true);
    try {
      // Separate cache key: the same URL loaded by an <img> may be cached without CORS headers,
      // which the browser would reuse for this request and then block.
      const corsUrl = `${url}${url.includes('?') ? '&' : '?'}_cors=1`;
      const blob = await firstValueFrom(this.http.get(corsUrl, { responseType: 'blob' }));
      await this.loadBlob(blob, false);
    } catch {
      this.error.set('Could not load the current image.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadFile(file: File, markDirty: boolean): Promise<void> {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.error.set('Choose a PNG, JPG or WebP image.');
      return;
    }
    this.loading.set(true);
    try {
      await this.loadBlob(file, markDirty);
    } catch {
      this.error.set('That image could not be opened. Try another one.');
    } finally {
      this.loading.set(false);
    }
  }

  private loadBlob(blob: Blob, markDirty: boolean): Promise<void> {
    const url = URL.createObjectURL(blob);
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        this.error.set(null);
        this.rotation.set(0);
        this.offset.set({ x: 0, y: 0 });
        this.image.set(img);
        // A logo starts fully visible; a photo starts filling the circle.
        this.zoom.set(this.minZoom());
        this.dirty.set(markDirty);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });
  }

  // ── Framing ──────────────────────────────────────────────────────────

  setZoom(value: number): void {
    const next = Math.min(MAX_ZOOM, Math.max(this.minZoom(), value));
    if (next === this.zoom()) return;
    this.zoom.set(next);
    this.offset.set(this.clamp(this.offset()));
    this.dirty.set(true);
  }

  zoomIn(): void {
    this.setZoom(Math.round((this.zoom() + ZOOM_STEP) * 100) / 100);
  }

  zoomOut(): void {
    this.setZoom(Math.round((this.zoom() - ZOOM_STEP) * 100) / 100);
  }

  onZoomInput(event: Event): void {
    this.setZoom(Number((event.target as HTMLInputElement).value));
  }

  rotate(): void {
    this.rotation.set((this.rotation() + 90) % 360);
    this.offset.set(this.clamp(this.offset()));
    this.dirty.set(true);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.image()) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: this.offset() };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    this.moveTo({
      x: this.drag.origin.x + event.clientX - this.drag.startX,
      y: this.drag.origin.y + event.clientY - this.drag.startY
    });
  }

  onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
  }

  onWheel(event: WheelEvent): void {
    if (!this.image()) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  onCanvasKeydown(event: KeyboardEvent): void {
    const { x, y } = this.offset();
    const moves: Record<string, { x: number; y: number } | undefined> = {
      ArrowLeft: { x: x - PAN_STEP, y },
      ArrowRight: { x: x + PAN_STEP, y },
      ArrowUp: { x, y: y - PAN_STEP },
      ArrowDown: { x, y: y + PAN_STEP }
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    this.moveTo(next);
  }

  private moveTo(next: { x: number; y: number }): void {
    const clamped = this.clamp(next);
    const current = this.offset();
    if (clamped.x === current.x && clamped.y === current.y) return;
    this.offset.set(clamped);
    this.dirty.set(true);
  }

  /** A larger-than-frame image must keep covering the frame; a smaller one must stay inside it. */
  private clamp(point: { x: number; y: number }): { x: number; y: number } {
    const image = this.image();
    if (!image) return { x: 0, y: 0 };
    const { width, height } = this.scaledSize(image, this.zoom(), this.rotation());
    const maxX = Math.abs(width - VIEW_SIZE) / 2;
    const maxY = Math.abs(height - VIEW_SIZE) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, point.x)),
      y: Math.min(maxY, Math.max(-maxY, point.y))
    };
  }

  /** On-screen size of the rotated image at this zoom; zoom 1 fills the crop square. */
  private scaledSize(image: HTMLImageElement, zoom: number, rotation: number): { width: number; height: number; scale: number } {
    const sideways = rotation % 180 !== 0;
    const w = sideways ? image.naturalHeight : image.naturalWidth;
    const h = sideways ? image.naturalWidth : image.naturalHeight;
    const scale = (VIEW_SIZE / Math.min(w, h)) * zoom;
    return { width: w * scale, height: h * scale, scale };
  }

  private draw(
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    factor: number,
    zoom: number,
    rotation: number,
    offset: { x: number; y: number }
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale } = this.scaledSize(image, zoom, rotation);
    const w = image.naturalWidth * scale * factor;
    const h = image.naturalHeight * scale * factor;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(canvas.width / 2 + offset.x * factor, canvas.height / 2 + offset.y * factor);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
  }

  // ── Actions ──────────────────────────────────────────────────────────

  save(): void {
    const image = this.image();
    if (!image || !this.dirty()) return;
    const out = this.document.createElement('canvas');
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    const square = this.shape() === 'square';
    if (!square) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    }
    this.draw(out, image, OUTPUT_SIZE / VIEW_SIZE, this.zoom(), this.rotation(), this.offset());
    const type = square ? 'image/png' : 'image/jpeg';
    out.toBlob(
      (blob) => {
        if (!blob) {
          this.error.set('Could not save the image. Try again.');
          return;
        }
        this.saved.emit(new File([blob], `${this.fileName()}.${square ? 'png' : 'jpg'}`, { type }));
      },
      type,
      0.92
    );
  }
}
