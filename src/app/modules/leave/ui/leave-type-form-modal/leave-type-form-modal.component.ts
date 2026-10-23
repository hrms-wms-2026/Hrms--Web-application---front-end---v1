/** The kind of leave only: name, colour, paid, who it is for and the document rule. Amounts and
 * every other rule are set on the leave type's policies. */
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { CreateLeaveTypeRequest, LEAVE_TYPE_COLORS, LeaveTypeResponse } from '../../models/leave-type.model';

export type LeaveTypeFormValue = CreateLeaveTypeRequest;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round((h * 60 + 360) % 360), max ? d / max : 0, max];
}

@Component({ selector: 'app-leave-type-form-modal', host: { 'animate.leave': 'ui-popup-leave' }, standalone: true, imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent], templateUrl: './leave-type-form-modal.component.html', styleUrl: './leave-type-form-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveTypeFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  @Input() leaveType: LeaveTypeResponse | null = null;
  @Input() loading = false;
  @Output() save = new EventEmitter<LeaveTypeFormValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly colors = LEAVE_TYPE_COLORS;
  readonly descriptionMaxLength = 500;
  readonly genderOptions = [{ value: 'all', label: 'All employees' }, { value: 'male', label: 'Men only' }, { value: 'female', label: 'Women only' }];
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    description: ['', Validators.maxLength(500)],
    color: [LEAVE_TYPE_COLORS[0] as string, [Validators.required, Validators.pattern(HEX_COLOR)]],
    isPaid: [true],
    applicableGender: ['all', Validators.required],
    requiresDocument: [false],
    documentRequiredAfterHours: [null as number | null, Validators.min(0.5)]
  });

  get isEdit(): boolean { return !!this.leaveType; }

  ngOnInit(): void {
    if (!this.leaveType) return;
    this.form.patchValue({
      name: this.leaveType.name,
      code: this.leaveType.code,
      description: this.leaveType.description ?? '',
      color: this.leaveType.color,
      isPaid: this.leaveType.isPaid,
      applicableGender: this.leaveType.applicableGender,
      requiresDocument: this.leaveType.requiresDocument,
      documentRequiredAfterHours: this.leaveType.documentRequiredAfterHours
    });
    this.form.controls.code.disable();
  }

  /** True when the chosen colour is not one of the preset swatches. */
  get isCustomColor(): boolean {
    const color = this.form.controls.color.value?.toUpperCase() ?? '';
    return !!color && !(this.colors as readonly string[]).includes(color);
  }

  pickColor(color: string): void {
    this.form.controls.color.setValue(color.toUpperCase());
  }

  // Custom colour picker: hue 0-360, saturation and value 0-1.
  readonly pickerOpen = signal(false);
  readonly hue = signal(220);
  readonly sat = signal(0.8);
  readonly val = signal(0.9);

  togglePicker(): void {
    if (this.pickerOpen()) { this.pickerOpen.set(false); return; }
    const value = this.form.controls.color.value ?? '';
    if (HEX_COLOR.test(value)) {
      const [h, s, v] = hexToHsv(value);
      this.hue.set(h); this.sat.set(s); this.val.set(v);
    }
    this.pickerOpen.set(true);
  }

  setHue(hue: number): void {
    this.hue.set(hue);
    this.applyHsv();
  }

  onAreaPointer(event: PointerEvent, start: boolean): void {
    const area = event.currentTarget as HTMLElement;
    if (start) area.setPointerCapture?.(event.pointerId);
    else if (!area.hasPointerCapture?.(event.pointerId)) return;
    const rect = area.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    this.sat.set(clamp((event.clientX - rect.left) / rect.width));
    this.val.set(1 - clamp((event.clientY - rect.top) / rect.height));
    this.applyHsv();
  }

  @HostListener('document:pointerdown', ['$event'])
  closePickerOnOutsideClick(event: PointerEvent): void {
    if (this.pickerOpen() && !(event.target as HTMLElement | null)?.closest('.ltfm-custom')) this.pickerOpen.set(false);
  }

  private applyHsv(): void {
    this.pickColor(hsvToHex(this.hue(), this.sat(), this.val()));
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const requiresDocument = !!value.requiresDocument;
    const afterHours = value.documentRequiredAfterHours;
    this.save.emit({
      name: (value.name ?? '').trim(),
      code: (value.code ?? '').trim().toUpperCase(),
      description: value.description?.trim() || null,
      color: (value.color ?? LEAVE_TYPE_COLORS[0]).toUpperCase(),
      isPaid: !!value.isPaid,
      applicableGender: value.applicableGender as LeaveTypeFormValue['applicableGender'],
      requiresDocument,
      documentRequiredAfterHours: requiresDocument && afterHours != null && afterHours > 0 ? afterHours : null,
      acceptedDocumentTypes: requiresDocument ? ['pdf', 'image'] : []
    });
  }
}
