import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PositionTemplateDrawerComponent } from './position-template-drawer.component';
import { POSITION_TEMPLATE_DRAG_MIME_TYPE, PositionTemplatePackResponse } from '../../models/position.model';

describe('PositionTemplateDrawerComponent', () => {
  let component: PositionTemplateDrawerComponent;
  let fixture: ComponentFixture<PositionTemplateDrawerComponent>;

  const mockTemplatePacks: readonly PositionTemplatePackResponse[] = [
    {
      id: 'pack-1',
      templateKey: 'exec-pack',
      name: 'Executive Leadership Template',
      description: 'Exec pack description',
      industryProfileTag: null,
      employeeCountRangeKey: '101-500',
      employeeCountMin: 101,
      employeeCountMax: 500,
      positions: [
        {
          positionKey: 'ceo',
          positionName: 'Chief Executive Officer',
          departmentName: 'Executive',
          reportsToPositionKey: null,
          linkedRoleTemplateId: null
        },
        {
          positionKey: 'cto',
          positionName: 'Chief Technology Officer',
          departmentName: 'Engineering',
          reportsToPositionKey: 'ceo',
          linkedRoleTemplateId: 'role-tpl-1'
        }
      ]
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PositionTemplateDrawerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PositionTemplateDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('renders loading skeleton when loading is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('.ptd-loading-skeletons');
    expect(skeleton).not.toBeNull();
  });

  it('renders safe error state and triggers retry event on click', () => {
    fixture.componentRef.setInput('error', 'Position templates could not be loaded. Try again.');
    fixture.detectChanges();

    const errorMsg = fixture.nativeElement.querySelector('.ptd-error-msg');
    expect(errorMsg).not.toBeNull();
    expect(errorMsg.textContent).toContain('Position templates could not be loaded');

    const retrySpy = vi.spyOn(component.retry, 'emit');
    const retryBtn = fixture.nativeElement.querySelector('.ptd-error-state button');
    retryBtn.click();
    expect(retrySpy).toHaveBeenCalled();
  });

  it('renders empty state when templatePacks list is empty', () => {
    fixture.componentRef.setInput('templatePacks', []);
    fixture.detectChanges();

    const emptyTitle = fixture.nativeElement.querySelector('.ptd-empty-title');
    expect(emptyTitle.textContent).toContain('No template packs found');
  });

  it('renders pack names, position cards, and role template badge if present', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.detectChanges();

    const packName = fixture.nativeElement.querySelector('.ptd-pack-name');
    expect(packName).not.toBeNull();
    expect(packName.textContent).toContain('Executive Leadership Template');

    const cardNames = fixture.nativeElement.querySelectorAll('.ptd-pos-name');
    expect(cardNames.length).toBe(2);
    expect(cardNames[0].textContent).toContain('Chief Executive Officer');
    expect(cardNames[1].textContent).toContain('Chief Technology Officer');

    const badge = fixture.nativeElement.querySelector('.ptd-role-template-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Role template included');
  });

  it('remains usable without drag/drop: every card renders visible "Use" button and emits event on click', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.componentRef.setInput('canCreate', true);
    fixture.detectChanges();

    const selectSpy = vi.spyOn(component.templatePositionSelected, 'emit');
    const useButtons = fixture.nativeElement.querySelectorAll('.ptd-pos-card-actions button');
    expect(useButtons.length).toBe(2);

    useButtons[1].click();

    expect(selectSpy).toHaveBeenCalledWith({
      position: mockTemplatePacks[0].positions[1],
      packName: 'Executive Leadership Template'
    });
  });

  it('no longer renders "Reports to:" or raw reportsToPositionKey machine keys in position template cards', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    expect(textContent).not.toContain('Reports to:');
    expect(textContent).not.toContain('Reports to: ceo');
    expect(textContent).not.toContain('ceo');

    const reportsChip = fixture.nativeElement.querySelector('.ptd-pos-reports-chip');
    expect(reportsChip).toBeNull();
  });

  it('no longer renders employee count range labels (e.g. 101-500 emp) in pack headers', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    expect(textContent).not.toContain('101-500 emp');
    expect(textContent).not.toContain('101-500');

    const rangeBadge = fixture.nativeElement.querySelector('.ptd-pack-range-badge');
    expect(rangeBadge).toBeNull();
  });

  it('renders position count badge next to pack name', () => {
    const packsWithSingular: readonly PositionTemplatePackResponse[] = [
      {
        ...mockTemplatePacks[0],
        id: 'pack-single',
        name: 'Single Position Pack',
        positions: [mockTemplatePacks[0].positions[0]]
      },
      mockTemplatePacks[0]
    ];

    fixture.componentRef.setInput('templatePacks', packsWithSingular);
    fixture.detectChanges();

    const countBadges = fixture.nativeElement.querySelectorAll('.ptd-pack-count-chip');
    expect(countBadges.length).toBe(2);
    expect(countBadges[0].textContent.trim()).toBe('1');
    expect(countBadges[1].textContent.trim()).toBe('2');
  });

  it('expanding and collapsing template pack toggle position card visibility', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.detectChanges();

    let cards = fixture.nativeElement.querySelectorAll('.ptd-pos-card');
    expect(cards.length).toBe(2);

    const headerBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ptd-pack-header');
    headerBtn.click(); // collapse
    fixture.detectChanges();

    cards = fixture.nativeElement.querySelectorAll('.ptd-pos-card');
    expect(cards.length).toBe(0);

    headerBtn.click(); // expand
    fixture.detectChanges();

    cards = fixture.nativeElement.querySelectorAll('.ptd-pos-card');
    expect(cards.length).toBe(2);
  });

  it('does not render a footer "Close panel" button', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('.ptd-footer');
    expect(footer).toBeNull();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const closePanelButton = buttons.find((btn) => btn.textContent?.trim() === 'Close panel');
    expect(closePanelButton).toBeUndefined();
  });

  it('closes via the header X button', () => {
    const closeSpy = vi.spyOn(component.closed, 'emit');
    const headerCloseBtn = fixture.nativeElement.querySelector('[aria-label="Close template panel"]');
    expect(headerCloseBtn).not.toBeNull();

    headerCloseBtn.click();

    expect(closeSpy).toHaveBeenCalled();
  });

  describe('Native drag/drop payload', () => {
    it('dragstart sets the internal template payload on the safe custom MIME type, not just text/plain', () => {
      fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
      fixture.componentRef.setInput('canCreate', true);
      fixture.detectChanges();

      const setData = vi.fn();
      const dragEvent = {
        dataTransfer: { setData, effectAllowed: '' }
      } as unknown as DragEvent;

      component.onDragStart(dragEvent, mockTemplatePacks[0].positions[1], mockTemplatePacks[0].name);

      expect(setData).toHaveBeenCalledWith(
        POSITION_TEMPLATE_DRAG_MIME_TYPE,
        JSON.stringify({ position: mockTemplatePacks[0].positions[1], packName: mockTemplatePacks[0].name })
      );
      // text/plain kept only as a human-readable fallback label, not the parsed payload
      expect(setData).toHaveBeenCalledWith('text/plain', mockTemplatePacks[0].positions[1].positionName);
      expect((dragEvent.dataTransfer as DataTransfer).effectAllowed).toBe('copy');
    });

    it('template cards remain draggable via the accessible "Use template" button path too (dragstart is not the only way in)', () => {
      fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
      fixture.componentRef.setInput('canCreate', true);
      fixture.detectChanges();

      const selectSpy = vi.spyOn(component.templatePositionSelected, 'emit');
      const useButtons = fixture.nativeElement.querySelectorAll('.ptd-pos-card-actions button');
      useButtons[0].click();

      expect(selectSpy).toHaveBeenCalledWith({
        position: mockTemplatePacks[0].positions[0],
        packName: 'Executive Leadership Template'
      });
    });

    it('dragstart does nothing when canCreate is false', () => {
      fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
      fixture.componentRef.setInput('canCreate', false);
      fixture.detectChanges();

      const setData = vi.fn();
      const dragEvent = {
        dataTransfer: { setData, effectAllowed: '' }
      } as unknown as DragEvent;

      component.onDragStart(dragEvent, mockTemplatePacks[0].positions[0], mockTemplatePacks[0].name);

      expect(setData).not.toHaveBeenCalled();
    });
  });

  it('disables "Use template" buttons and drag attributes when canCreate is false', () => {
    fixture.componentRef.setInput('templatePacks', mockTemplatePacks);
    fixture.componentRef.setInput('canCreate', false);
    fixture.detectChanges();

    const warningBanner = fixture.nativeElement.querySelector('.ptd-perm-warning');
    expect(warningBanner).not.toBeNull();
    expect(warningBanner.textContent).toContain('You need organization management access');

    const useButtons = fixture.nativeElement.querySelectorAll('.ptd-pos-card-actions button');
    expect(useButtons[0].disabled).toBe(true);

    const cards = fixture.nativeElement.querySelectorAll('.ptd-pos-card');
    expect(cards[0].getAttribute('draggable')).toBeNull();
  });
});

