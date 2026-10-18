import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { firstValueFrom } from 'rxjs';

import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { RichTextEditorComponent } from '../../../work/ui/rich-text-editor/rich-text-editor.component';
import {
  AttachmentPill,
  TaskAttachmentListComponent
} from '../../../work/ui/task-attachment-list/task-attachment-list.component';
import { ChecklistApiService } from '../../data-access/checklist-api.service';
import { ChecklistTaskPriority } from '../../models/checklist-template.model';
import { ChecklistTaskCategory } from '../../models/offboarding.model';

type DetailPopover = 'priority' | 'category' | null;

interface PriorityOption {
  value: ChecklistTaskPriority;
  label: string;
  dotClass: string;
}

const PRIORITY_OPTIONS: readonly PriorityOption[] = [
  { value: 'low', label: 'Low', dotClass: 'ctd-dot--low' },
  { value: 'medium', label: 'Medium', dotClass: 'ctd-dot--med' },
  { value: 'high', label: 'High', dotClass: 'ctd-dot--high' },
  { value: 'critical', label: 'Critical', dotClass: 'ctd-dot--crit' }
];

/**
 * Task details for one checklist template row, laid out like the Work task detail screen.
 * Edits stay local until Save, which patches the row's FormGroup. Rendered in a global CDK
 * overlay so it stacks above the checklist builder dialog.
 */
@Component({
  selector: 'app-checklist-task-detail-dialog',
  standalone: true,
  imports: [CdkTrapFocus, ButtonComponent, RichTextEditorComponent, TaskAttachmentListComponent],
  templateUrl: './checklist-task-detail-dialog.component.html',
  styleUrl: './checklist-task-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistTaskDetailDialogComponent implements AfterViewInit, OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);
  private readonly taskApi = inject(TaskApiService);
  private readonly checklistApi = inject(ChecklistApiService);

  readonly taskGroup = input.required<FormGroup>();
  readonly taskNumber = input<number>(1);
  readonly assigneeLabel = input<string>('');
  readonly templateId = input<string | null>(null);
  /** Category and bypass rules only apply to offboarding checklists. */
  readonly offboarding = input<boolean>(false);
  readonly categoryOptions = input<readonly SelectOption[]>([]);

  readonly closed = output<void>();

  readonly priorityOptions = PRIORITY_OPTIONS;

  readonly title = signal('');
  readonly description = signal('');
  readonly priority = signal<ChecklistTaskPriority>('medium');
  readonly isRequired = signal(true);
  readonly isBypassable = signal(false);
  readonly bypassPenaltyDescription = signal('');
  readonly category = signal<ChecklistTaskCategory | ''>('');
  readonly attachments = signal<AttachmentPill[]>([]);
  readonly activePopover = signal<DetailPopover>(null);
  readonly titleError = signal(false);
  readonly errorMessage = signal('');

  readonly priorityDetails = computed(
    () => PRIORITY_OPTIONS.find((opt) => opt.value === this.priority()) ?? PRIORITY_OPTIONS[1]
  );
  readonly categoryLabel = computed(() => {
    const value = this.category();
    return value ? (this.categoryOptions().find((opt) => opt.value === value)?.label ?? value) : '';
  });
  readonly uploading = computed(() => this.attachments().some((file) => file.uploading));

  private readonly panelTpl = viewChild.required<TemplateRef<unknown>>('panel');
  private overlayRef: OverlayRef | null = null;
  /** Uploaded during this dialog session: deleted again on Cancel or when removed. */
  private readonly newUploads = new Set<string>();

  ngAfterViewInit(): void {
    const value = this.taskGroup().getRawValue() as Record<string, unknown>;
    this.title.set(String(value['title'] ?? ''));
    this.description.set(String(value['description'] ?? ''));
    this.priority.set((value['priority'] as ChecklistTaskPriority | null) || 'medium');
    this.isRequired.set(value['isRequired'] !== false);
    this.isBypassable.set(!!value['isBypassable']);
    this.bypassPenaltyDescription.set(String(value['bypassPenaltyDescription'] ?? ''));
    this.category.set((value['category'] as ChecklistTaskCategory | '' | null) || '');
    this.attachments.set([...((value['attachments'] as AttachmentPill[] | null) ?? [])]);

    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: false,
      width: '100%',
      height: '100%'
    });
    this.overlayRef.attach(new TemplatePortal(this.panelTpl(), this.vcr));
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  togglePopover(name: Exclude<DetailPopover, null>, event: Event): void {
    event.stopPropagation();
    this.activePopover.update((current) => (current === name ? null : name));
  }

  closePopover(): void {
    this.activePopover.set(null);
  }

  setPriority(value: ChecklistTaskPriority): void {
    this.priority.set(value);
    this.activePopover.set(null);
  }

  setCategory(value: string): void {
    this.category.set(value as ChecklistTaskCategory | '');
    this.activePopover.set(null);
  }

  onTitleInput(value: string): void {
    this.title.set(value);
    if (value.trim()) this.titleError.set(false);
  }

  async onFilesSelected(files: FileList | File[]): Promise<void> {
    this.errorMessage.set('');
    for (const file of Array.from(files)) {
      const placeholderId = `uploading-${crypto.randomUUID()}`;
      this.attachments.update((curr) => [...curr, { fileId: placeholderId, name: file.name, sizeBytes: file.size, uploading: true }]);
      try {
        const uploaded = await firstValueFrom(this.taskApi.uploadPendingFile(file, 'task_attachment'));
        this.newUploads.add(uploaded.fileId);
        this.attachments.update((curr) =>
          curr.map((pill) =>
            pill.fileId === placeholderId
              ? { fileId: uploaded.fileId, name: uploaded.originalFileName, sizeBytes: uploaded.fileSizeBytes }
              : pill
          )
        );
      } catch {
        this.attachments.update((curr) => curr.filter((pill) => pill.fileId !== placeholderId));
        this.errorMessage.set(`Failed to upload ${file.name}.`);
      }
    }
  }

  removeAttachment(fileId: string): void {
    this.attachments.update((curr) => curr.filter((pill) => pill.fileId !== fileId));
    if (this.newUploads.delete(fileId)) {
      firstValueFrom(this.taskApi.deletePendingFile(fileId)).catch(() => undefined);
    }
  }

  async downloadAttachment(file: AttachmentPill): Promise<void> {
    const templateId = this.templateId();
    try {
      const blob = await firstValueFrom(
        templateId && !this.newUploads.has(file.fileId) && !this.isPendingInBuilder(file.fileId)
          ? this.checklistApi.downloadTemplateFile(templateId, file.fileId)
          : this.taskApi.downloadFile(file.fileId)
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.name || 'attachment';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      this.errorMessage.set(`Failed to download ${file.name}.`);
    }
  }

  cancel(): void {
    for (const fileId of this.newUploads) {
      firstValueFrom(this.taskApi.deletePendingFile(fileId)).catch(() => undefined);
    }
    this.newUploads.clear();
    this.closed.emit();
  }

  save(): void {
    if (!this.title().trim()) {
      this.titleError.set(true);
      return;
    }
    if (this.uploading()) return;

    const bypassable = this.offboarding() && this.isBypassable();
    const keptIds = new Set(this.attachments().map((pill) => pill.fileId));
    const pendingFileIds = [
      ...this.pendingInBuilder().filter((id) => keptIds.has(id)),
      ...[...this.newUploads].filter((id) => keptIds.has(id))
    ];
    this.taskGroup().patchValue({
      title: this.title(),
      description: this.description(),
      priority: this.priority(),
      isRequired: this.isRequired(),
      isBypassable: bypassable,
      bypassPenaltyDescription: bypassable ? this.bypassPenaltyDescription() : '',
      category: this.offboarding() ? this.category() : '',
      attachments: this.attachments(),
      pendingFileIds
    });
    this.taskGroup().markAsDirty();
    this.newUploads.clear();
    this.closed.emit();
  }

  /** Files uploaded in an earlier dialog session but not yet saved on the template. */
  private pendingInBuilder(): string[] {
    return (this.taskGroup().get('pendingFileIds')?.value as string[] | null | undefined) ?? [];
  }

  private isPendingInBuilder(fileId: string): boolean {
    return this.pendingInBuilder().includes(fileId);
  }
}
