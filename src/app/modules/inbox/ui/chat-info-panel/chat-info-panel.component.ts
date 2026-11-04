import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Observable, Subject, catchError, debounceTime, firstValueFrom, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../../../core/services/notification.service';
import { safeServerDetail } from '../../../../core/services/error-handler.service';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ChangePhotoDialogComponent, PHOTO_ACCEPT } from '../../../../shared/ui/change-photo-dialog/change-photo-dialog.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { ChatMediaItemDto, ChatMediaKind, ChatMediaPageDto, ChatSearchResultDto, InboxChatRowDto } from '../../models/inbox-chat.dto';
import { ConversationParticipantDto } from '../../models/inbox.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { InboxStore } from '../../state/inbox.store';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';
import { IconPickerComponent } from '../../../../shared/ui/icon-picker/icon-picker.component';

/** Items shown before "View all" (files and members), and per page once opened. */
export const PREVIEW_COUNT = 5;
export const MEDIA_PAGE_SIZE = 20;
export const MEMBERS_PAGE_SIZE = 10;

type InfoView = 'info' | 'media' | 'members' | 'search';

const KIND_TABS: readonly { kind: ChatMediaKind | null; label: string }[] = [
  { kind: null, label: 'All' }, { kind: 'image', label: 'Images' }, { kind: 'video', label: 'Videos' },
  { kind: 'audio', label: 'Audio' }, { kind: 'document', label: 'Documents' }
];

/** "12 KB" / "3.4 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A chat's info in the inbox's details panel (WhatsApp-style): photo and name (editable for groups), Add / Search / Mute,
 * the group's description, every file posted in the chat (images, videos, audio, documents), Favorite, History, and the
 * members. Files and members show the first 5 here; "View all" opens them page by page.
 */
@Component({
  selector: 'app-chat-info-panel',
  standalone: true,
  imports: [AvatarComponent, ChangePhotoDialogComponent, DatePipe, EntityIconComponent, IconPickerComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-info-panel.component.html',
  styleUrl: './chat-info-panel.component.css'
})
export class ChatInfoPanelComponent {
  private readonly api = inject(InboxChatsApiService);
  private readonly conversations = inject(ConversationsApiService);
  private readonly chats = inject(InboxChatsStore);
  private readonly inbox = inject(InboxStore);
  private readonly notifications = inject(NotificationService);

  row = input.required<InboxChatRowDto>();
  members = input<readonly ConversationParticipantDto[]>([]);
  myEmployeeId = input<string | null>(null);

  closed = output<void>();
  addPeople = output<void>();
  openHistory = output<void>();
  /** A search result was picked: the chat scrolls to it. */
  jump = output<string>();

  protected readonly kindTabs = KIND_TABS;
  protected readonly photoAccept = PHOTO_ACCEPT;
  protected readonly fileSize = fileSize;
  protected readonly view = signal<InfoView>('info');
  protected readonly membersPageSize = MEMBERS_PAGE_SIZE;
  /** The pager's page changes (bound, since the pager template calls them without `this`). */
  protected readonly goMedia = (page: number): void => void this.loadMedia(this.mediaKind(), page);
  protected readonly goMembers = (page: number): void => this.membersPage.set(page);

  protected readonly isDirect = computed(() => this.row().type === 'direct');
  protected readonly title = computed(() => (this.isDirect() ? 'Contact info' : this.row().type === 'case' ? 'Case group info' : 'Group info'));
  protected readonly typeLabel = computed(() => (this.isDirect() ? 'Direct message' : this.row().type === 'case' ? 'Case group' : 'Group'));
  protected readonly isFavorite = computed(() => this.chats.favorites().has(this.row().conversationId));
  protected readonly isMuted = computed(() => !!this.row().isMuted);
  protected readonly photoUrl = computed(() => (this.row().avatarFileId ? buildFileUrl(this.row().avatarFileId!) : null));

  // ── Name, description, photo ──
  protected readonly editingName = signal(false);
  protected readonly nameDraft = signal('');
  protected readonly editingDescription = signal(false);
  protected readonly descriptionDraft = signal('');
  protected readonly saving = signal(false);
  protected readonly framing = signal(false);
  protected readonly pickedPhoto = signal<File | null>(null);

  // ── Files ──
  protected readonly preview = signal<ChatMediaPageDto | null>(null);
  protected readonly mediaKind = signal<ChatMediaKind | null>(null);
  protected readonly mediaPage = signal(1);
  protected readonly media = signal<ChatMediaPageDto | null>(null);
  protected readonly mediaLoading = signal(false);
  /** Image thumbnails (attachment id → object URL), fetched through the chat's access check. */
  protected readonly thumbs = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly mediaTotal = computed(() => {
    const counts = this.preview()?.counts ?? {};
    return Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);
  });

  // ── Members ──
  protected readonly memberFilterOpen = signal(false);
  protected readonly memberFilter = signal('');
  protected readonly membersPage = signal(1);
  protected readonly filteredMembers = computed(() => {
    const term = this.memberFilter().trim().toLowerCase();
    const me = this.myEmployeeId();
    // You first, then everyone else in the order they joined.
    const sorted = [...this.members()].sort((a, b) => Number(b.employeeId === me) - Number(a.employeeId === me));
    return term ? sorted.filter((p) => p.name.toLowerCase().includes(term)) : sorted;
  });
  protected readonly membersPageItems = computed(() => {
    const start = (this.membersPage() - 1) * MEMBERS_PAGE_SIZE;
    return this.filteredMembers().slice(start, start + MEMBERS_PAGE_SIZE);
  });

  // ── Search ──
  protected readonly query = signal('');
  protected readonly results = signal<ChatSearchResultDto[]>([]);
  protected readonly searching = signal(false);
  private readonly searches = new Subject<string>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Keyed on the chat's id: a refreshed row (same chat) must not reload or reset anything.
    let current: string | null = null;
    let lastMessageAt: string | null = null;
    effect(() => {
      const id = this.row().conversationId;
      const latest = this.row().lastMessageAt;
      if (id !== current) {
        current = id;
        lastMessageAt = latest;
        untracked(() => this.reset());
      } else if (latest !== lastMessageAt) {
        // A new message may carry files: the preview catches up without leaving the current view.
        lastMessageAt = latest;
        untracked(() => void this.loadPreview());
      }
    });
    this.searches.pipe(
      debounceTime(300),
      switchMap((text) => {
        if (!text.trim()) return of([] as ChatSearchResultDto[]);
        this.searching.set(true);
        return this.api.search(this.row().conversationId, text.trim()).pipe(catchError(() => of([] as ChatSearchResultDto[])));
      }),
      takeUntilDestroyed(destroyRef)
    ).subscribe((found) => {
      this.searching.set(false);
      this.results.set(found);
    });
    destroyRef.onDestroy(() => this.revokeThumbs());
  }

  private reset(): void {
    this.view.set('info');
    this.editingName.set(false);
    this.editingDescription.set(false);
    this.memberFilterOpen.set(false);
    this.memberFilter.set('');
    this.membersPage.set(1);
    this.query.set('');
    this.results.set([]);
    this.media.set(null);
    this.preview.set(null);
    this.revokeThumbs();
    void this.loadPreview();
  }

  private async loadPreview(): Promise<void> {
    const id = this.row().conversationId;
    try {
      const page = await firstValueFrom(this.api.media(id, null, 1, PREVIEW_COUNT));
      if (id !== this.row().conversationId) return;
      this.preview.set(page);
      this.loadThumbs(page.items);
    } catch {
      this.preview.set({ items: [], total: 0, page: 1, pageSize: PREVIEW_COUNT, counts: {} });
    }
  }

  // ── Views ──

  protected show(view: InfoView): void {
    this.view.set(view);
    if (view === 'media' && !this.media()) void this.loadMedia(null, 1);
    if (view === 'members') this.membersPage.set(1);
  }

  protected back(): void {
    this.view.set('info');
  }

  // ── Name / description / photo ──

  protected startRename(): void {
    this.nameDraft.set(this.row().title);
    this.editingName.set(true);
  }

  protected async saveName(): Promise<void> {
    // Enter saves, then the input's blur would save again.
    if (this.saving()) return;
    const name = this.nameDraft().trim();
    if (!name || name === this.row().title) {
      this.editingName.set(false);
      return;
    }
    await this.save(() => this.api.renameGroup(this.row().conversationId, name), 'The name could not be changed.');
    this.editingName.set(false);
  }

  protected startDescription(): void {
    this.descriptionDraft.set(this.row().description ?? '');
    this.editingDescription.set(true);
  }

  protected async saveDescription(): Promise<void> {
    if (this.saving()) return;
    const text = this.descriptionDraft().trim();
    if (text !== (this.row().description ?? '')) {
      await this.save(() => this.api.setDescription(this.row().conversationId, text), 'The description could not be saved.');
    }
    this.editingDescription.set(false);
  }

  /** No photo yet opens the file picker; a photo opens the Change photo popup (re-frame, pick another, remove). */
  protected pickPhoto(fileInput: HTMLInputElement): void {
    if (this.photoUrl()) {
      this.pickedPhoto.set(null);
      this.framing.set(true);
    } else {
      fileInput.click();
    }
  }

  protected onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pickedPhoto.set(file);
    this.framing.set(true);
  }

  /** The swatch picked before an icon, kept until one is chosen (a tint alone is not saved). */
  protected readonly pendingColor = signal<string | null>(null);
  protected readonly iconColor = computed(() => this.pendingColor() ?? this.row().color ?? null);

  protected async saveIcon(icon: string | null): Promise<void> {
    const color = this.iconColor();
    this.pendingColor.set(null);
    await this.save(() => this.api.setIcon(this.row().conversationId, icon, icon ? color : null),
      icon ? 'The icon could not be saved.' : 'The icon could not be removed.');
  }

  protected async saveIconColor(color: string): Promise<void> {
    const icon = this.row().icon;
    if (!icon) {
      this.pendingColor.set(color);
      return;
    }
    await this.save(() => this.api.setIcon(this.row().conversationId, icon, color), 'The colour could not be saved.');
  }

  protected async savePhoto(file: File | null): Promise<void> {
    this.framing.set(false);
    this.pickedPhoto.set(null);
    const id = this.row().conversationId;
    await this.save(async () => {
      const fileId = file ? await firstValueFrom(this.api.uploadGroupPhoto(file)) : null;
      return this.api.setPhoto(id, fileId);
    }, file ? 'The photo could not be saved.' : 'The photo could not be removed.');
  }

  /** Runs a change, then reloads the chat list so the row (name, photo, description) shows it. */
  private async save(run: () => Observable<void> | Promise<Observable<void>>, failure: string): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(await run());
      await this.chats.load();
    } catch (err) {
      this.notifications.error(safeServerDetail(err) ?? failure);
    } finally {
      this.saving.set(false);
    }
  }

  // ── Actions ──

  protected async toggleMute(): Promise<void> {
    const ok = await this.chats.toggleMuted(this.row().conversationId);
    if (ok) void this.inbox.loadCounts();
    else this.notifications.error('Could not change notifications for this chat.');
  }

  protected toggleFavorite(): void {
    void this.chats.toggleFavorite(this.row().conversationId);
  }

  protected onQuery(text: string): void {
    this.query.set(text);
    this.searches.next(text);
  }

  protected pickResult(result: ChatSearchResultDto): void {
    this.jump.emit(result.messageId);
  }

  // ── Files ──

  protected async loadMedia(kind: ChatMediaKind | null, page: number): Promise<void> {
    const id = this.row().conversationId;
    this.mediaKind.set(kind);
    this.mediaPage.set(page);
    this.mediaLoading.set(true);
    try {
      const result = await firstValueFrom(this.api.media(id, kind, page, MEDIA_PAGE_SIZE));
      if (id !== this.row().conversationId) return;
      this.media.set(result);
      this.loadThumbs(result.items);
    } catch {
      this.notifications.error('Could not load the files of this chat.');
    } finally {
      this.mediaLoading.set(false);
    }
  }

  protected pageCount(total: number, size: number): number {
    return Math.max(1, Math.ceil(total / size));
  }

  protected countOf(kind: ChatMediaKind | null): number {
    const counts = this.media()?.counts ?? this.preview()?.counts ?? {};
    return kind ? counts[kind] ?? 0 : Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);
  }

  /** Downloads a file through the chat's access check. */
  protected async open(item: ChatMediaItemDto): Promise<void> {
    try {
      const blob = await firstValueFrom(this.conversations.attachment(this.row().conversationId, item.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.notifications.error(`Could not open ${item.fileName}.`);
    }
  }

  private loadThumbs(items: readonly ChatMediaItemDto[]): void {
    const id = this.row().conversationId;
    for (const item of items) {
      if (item.kind !== 'image' || this.thumbs().has(item.id)) continue;
      this.conversations.attachment(id, item.id).pipe(catchError(() => of(null))).subscribe((blob) => {
        if (!blob || id !== this.row().conversationId) return;
        const next = new Map(this.thumbs());
        next.set(item.id, URL.createObjectURL(blob));
        this.thumbs.set(next);
      });
    }
  }

  private revokeThumbs(): void {
    for (const url of this.thumbs().values()) URL.revokeObjectURL(url);
    this.thumbs.set(new Map());
  }

  protected isMe(p: ConversationParticipantDto): boolean {
    return p.employeeId === this.myEmployeeId();
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }
}
