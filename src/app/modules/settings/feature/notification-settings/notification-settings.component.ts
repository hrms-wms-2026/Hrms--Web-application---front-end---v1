import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { UnsavedChangesService } from '../../../../shared/services/unsaved-changes.service';
import { NotificationSettingsStore } from '../../state/notification-settings.store';
import {
  CHANNEL_LABELS,
  MODULE_LABELS,
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  NotificationSetting
} from '../../models/notification-setting.model';

interface RowEdit {
  readonly channels: readonly NotificationChannel[];
  readonly templateId: string | null;
  readonly recipientRule: string;
}

interface ModuleGroup {
  readonly module: string;
  readonly label: string;
  readonly settings: readonly NotificationSetting[];
}

/**
 * Settings → Notification Settings. Each event row maps to In-app / Email / Tray, a published template and a
 * recipient rule. Edits stay local until that row is saved; a stale save (409) keeps the edits and offers a
 * reload. Wording is edited by the platform, not here - this screen only routes.
 */
@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, CardComponent, EmptyStateComponent, ErrorStateComponent, InputComponent, SelectComponent],
  templateUrl: './notification-settings.component.html',
  styleUrl: './notification-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationSettingsComponent implements OnInit {
  protected readonly store = inject(NotificationSettingsStore);
  private readonly unsaved = inject(UnsavedChangesService);

  readonly search = signal('');
  private readonly edits = signal<Readonly<Record<string, RowEdit>>>({});

  protected readonly channels = NOTIFICATION_CHANNELS;
  protected readonly channelLabels = CHANNEL_LABELS;

  readonly isDirty = computed(() => Object.keys(this.edits()).length > 0);

  protected readonly groups = computed<ModuleGroup[]>(() => {
    const term = this.search().trim().toLowerCase();
    const byModule = new Map<string, NotificationSetting[]>();
    for (const s of this.store.settings()) {
      if (term && !s.displayName.toLowerCase().includes(term) && !(MODULE_LABELS[s.module] ?? s.module).toLowerCase().includes(term)) {
        continue;
      }
      byModule.set(s.module, [...(byModule.get(s.module) ?? []), s]);
    }
    return [...byModule.entries()]
      .map(([module, settings]) => ({ module, label: MODULE_LABELS[module] ?? module, settings }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  constructor() {
    const unregister = this.unsaved.register({
      isDirty: () => this.isDirty(),
      canSaveDraft: () => false,
      saveDraft: async () => false,
      discard: () => this.edits.set({})
    });
    inject(DestroyRef).onDestroy(unregister);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.edits.set({});
    void this.store.load();
  }

  protected row(s: NotificationSetting): RowEdit {
    return this.edits()[s.eventKey] ?? { channels: s.enabledChannels, templateId: s.templateId, recipientRule: s.recipientRule };
  }

  protected isRowDirty(s: NotificationSetting): boolean {
    return this.edits()[s.eventKey] !== undefined;
  }

  protected isEnabled(s: NotificationSetting, channel: NotificationChannel): boolean {
    return this.row(s).channels.includes(channel);
  }

  protected isSupported(s: NotificationSetting, channel: NotificationChannel): boolean {
    return s.supportedChannels.includes(channel);
  }

  protected isRequired(s: NotificationSetting, channel: NotificationChannel): boolean {
    return s.requiredChannels.includes(channel);
  }

  protected isLocked(s: NotificationSetting, channel: NotificationChannel): boolean {
    return !s.configurable || !this.isSupported(s, channel) || this.isRequired(s, channel);
  }

  protected toggleTitle(s: NotificationSetting, channel: NotificationChannel): string {
    if (!this.isSupported(s, channel)) return 'Not available for this event';
    if (this.isRequired(s, channel)) return 'Required for this event';
    if (!s.configurable) return 'Uses built-in delivery for now';
    return `${CHANNEL_LABELS[channel]} on or off`;
  }

  protected toggle(s: NotificationSetting, channel: NotificationChannel): void {
    if (this.isLocked(s, channel)) return;
    const current = this.row(s);
    const channels = current.channels.includes(channel)
      ? current.channels.filter((c) => c !== channel)
      : NOTIFICATION_CHANNELS.filter((c) => c === channel || current.channels.includes(c));
    this.setEdit(s, { ...current, channels });
  }

  /** Select value: the chosen template, or the product default when none is chosen. */
  protected selectedTemplate(s: NotificationSetting): string {
    return this.row(s).templateId ?? s.templates.find((t) => t.isProductDefault)?.id ?? '';
  }

  protected templateOptions(s: NotificationSetting): SelectOption[] {
    return s.templates.map((t) => ({ value: t.id, label: t.name }));
  }

  protected recipientOptions(s: NotificationSetting): SelectOption[] {
    return s.recipientRules.map((rule) => ({ value: rule, label: this.recipientLabel(rule) }));
  }

  protected setTemplate(s: NotificationSetting, templateId: string): void {
    const option = s.templates.find((t) => t.id === templateId);
    this.setEdit(s, { ...this.row(s), templateId: !option || option.isProductDefault ? null : option.id });
  }

  protected setRecipientRule(s: NotificationSetting, recipientRule: string): void {
    this.setEdit(s, { ...this.row(s), recipientRule });
  }

  protected async save(s: NotificationSetting): Promise<void> {
    const edit = this.row(s);
    const saved = await this.store.save(s.eventKey, {
      enabledChannels: edit.channels,
      templateId: edit.templateId,
      recipientRule: edit.recipientRule,
      revision: s.revision
    });
    if (saved) this.clearEdit(s.eventKey);
  }

  protected async reset(s: NotificationSetting): Promise<void> {
    if (await this.store.reset(s.eventKey)) this.clearEdit(s.eventKey);
  }

  protected discard(s: NotificationSetting): void {
    this.clearEdit(s.eventKey);
  }

  protected recipientLabel(rule: string): string {
    return rule === 'default' ? 'Standard recipients' : rule.replace(/_/g, ' ');
  }

  private setEdit(s: NotificationSetting, edit: RowEdit): void {
    const unchanged =
      edit.templateId === s.templateId &&
      edit.recipientRule === s.recipientRule &&
      edit.channels.length === s.enabledChannels.length &&
      edit.channels.every((c) => s.enabledChannels.includes(c));
    if (unchanged) {
      this.clearEdit(s.eventKey);
    } else {
      this.edits.update((all) => ({ ...all, [s.eventKey]: edit }));
    }
  }

  private clearEdit(eventKey: string): void {
    this.edits.update(({ [eventKey]: _removed, ...rest }) => rest);
  }
}
