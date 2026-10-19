import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExceptionEvidencePanelComponent } from '../../../shared/ui/exception-evidence-panel/exception-evidence-panel.component';
import { InboxItemDetailDto } from '../models/inbox.dto';
import { ExceptionEvidenceRendererComponent } from './exception-evidence-renderer.component';
import { DEFAULT_INBOX_DETAIL_RENDERERS } from './inbox-detail-renderers';

@Component({ selector: 'app-exception-evidence-panel', standalone: true, template: '' })
class PanelStub { evidence = input<unknown>(null); }

function detail(extra: Partial<InboxItemDetailDto> = {}): InboxItemDetailDto {
  return {
    item: {
      source: 'monitoring', kind: 'exception_case', id: 'x1', category: 'alert', actionType: 'IdentityAnomaly', title: 'Identity check - Pat',
      subtitle: null, status: 'Open', direction: 'received', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
      requestedBy: null, requestedTo: null, createdAt: '', updatedAt: '', availableActions: [], unreadMessages: 0, isPending: true, facets: {}
    },
    steps: [], summary: null, changeSet: [], target: null, editablePayloadJson: null,
    explanation: 'The clock-in photo did not match.', explanationDetails: { Detected: '13 Oct 2026', Severity: 'high' }, ...extra
  };
}

describe('ExceptionEvidenceRendererComponent', () => {
  function render(extra: Record<string, unknown> | null, d = detail()) {
    TestBed.configureTestingModule({ imports: [ExceptionEvidenceRendererComponent] })
      .overrideComponent(ExceptionEvidenceRendererComponent, { remove: { imports: [ExceptionEvidencePanelComponent] }, add: { imports: [PanelStub] } });
    const fixture = TestBed.createComponent(ExceptionEvidenceRendererComponent);
    fixture.componentRef.setInput('extra', extra);
    fixture.componentRef.setInput('detail', d);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const panel = fixture.debugElement.query((n) => n.componentInstance instanceof PanelStub)?.componentInstance as PanelStub | undefined;
    return { el, panel };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('is registered as the "exception-evidence" renderer', () => {
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['exception-evidence']).toBe(ExceptionEvidenceRendererComponent);
  });

  it('shows only the evidence panel for a reviewer - no reason or facts box', () => {
    const evidence = { exceptionId: 'x1', type: 'IdentityAnomaly', workDate: '2026-10-13', timezone: 'UTC', faceChecks: [], checkInScans: [] };
    const { el, panel } = render(evidence);

    expect(panel?.evidence()).toEqual(evidence);
    expect(el.textContent).not.toContain('did not match');
    expect(el.textContent).not.toContain('13 Oct 2026');
  });

  it('shows the employee it is about no evidence panel', () => {
    const { panel } = render(null);

    expect(panel).toBeUndefined();
  });
});
