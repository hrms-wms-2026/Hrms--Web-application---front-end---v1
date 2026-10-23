import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../../models/work-graph.model';
import { EmployeeDirectoryStore } from '../../../../work/state/employee-directory.store';
import { WorkNetworkExplorerComponent } from './work-network-explorer.component';

describe('WorkNetworkExplorerComponent', () => {
  const stats = (total: number, completed: number) => ({
    totalTasks: total, notStarted: total - completed - 1, inProgress: 1, completed, overdue: 1, allocatedHours: 100, completedHours: 40
  });
  const graph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Kiru Balachandran', sublabel: 'Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Hardware Integration', sublabel: 'HWI', projectId: 'p1', stats: stats(12, 4), logoFileId: 'logo-1' },
      {
        id: 'module:m1', kind: 'module', label: 'Protocol Adapters', role: 'owner', projectId: 'p1', objectiveId: 'o1', stats: stats(5, 1),
        module: {
          owner: { employeeId: 'e1', name: 'Kiru Balachandran', avatarFileId: null },
          startDate: '2026-09-01', endDate: '2026-09-30',
          members: [{ employeeId: 'x1', name: 'Alex Tan', avatarFileId: null }], memberCount: 3
        }
      },
      { id: 'module:m2', kind: 'module', label: 'Device Pairing', role: 'member', projectId: 'p1', objectiveId: 'o2', stats: stats(2, 0) },
      {
        id: 'task:t1', kind: 'task', label: 'Fix device timeout', sublabel: 'ONX-124', status: 'active', projectId: 'p1', objectiveId: 'o1', taskId: 't1',
        task: { dueDate: '2026-10-10', statusName: 'In Progress', priority: 'high', isOverdue: false }
      },
      {
        id: 'task:t2', kind: 'task', label: 'Write unit tests', sublabel: 'ONX-128', status: 'not_started', projectId: 'p1', objectiveId: 'o1', taskId: 't2',
        task: { dueDate: '2026-09-20', statusName: 'To Do', priority: 'low', isOverdue: true }
      },
      { id: 'task:t3', kind: 'task', label: 'Pair over BLE', sublabel: 'ONX-130', status: 'not_started', projectId: 'p1', objectiveId: 'o2', taskId: 't3' }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'project:p1', target: 'module:m2', kind: 'contains' },
      { source: 'employee:e1', target: 'module:m1', kind: 'owns' },
      { source: 'employee:e1', target: 'module:m2', kind: 'member_of' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' },
      { source: 'module:m1', target: 'task:t2', kind: 'has_task' },
      { source: 'module:m2', target: 'task:t3', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  const directory = {
    get: vi.fn((id: string) => (id === 'e1' ? { id, name: 'Kiru', initials: 'KB', avatarUrl: 'https://files.test/kiru.jpg' } : undefined)),
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    seed: vi.fn()
  };

  function setup() {
    TestBed.configureTestingModule({
      imports: [WorkNetworkExplorerComponent],
      providers: [provideHttpClient(), { provide: EmployeeDirectoryStore, useValue: directory }]
    });
    const fixture = TestBed.createComponent(WorkNetworkExplorerComponent);
    fixture.componentRef.setInput('graph', graph);
    const navigated: WorkGraphNode[] = [];
    fixture.componentInstance.navigate.subscribe((n) => navigated.push(n));
    fixture.detectChanges();
    return { fixture, navigated, el: fixture.nativeElement as HTMLElement };
  }

  const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node-id="${id}"]`) as SVGGElement;
  const cards = (el: HTMLElement) => Array.from(el.querySelectorAll('[data-task-id]')).map((c) => c.getAttribute('data-task-id'));
  const panel = (el: HTMLElement) => el.querySelector('[data-testid="work-network-panel"]') as HTMLElement | null;

  afterEach(() => vi.useRealTimers());

  it('starts at the overview: employee, projects and modules with codes and counts, no task cards', () => {
    const { el } = setup();

    // P1 has a logo, so its code gives way to the image (see the image tests below).
    expect(node(el, 'project:p1').textContent).toContain('12 tasks • 2 modules');
    expect(node(el, 'project:p1').textContent).toContain('40%');
    expect(node(el, 'module:m1').textContent).toContain('M1');
    expect(node(el, 'task:t1')).toBeNull();
    expect(cards(el)).toEqual([]);
    expect(el.textContent).toContain('Projects (1)');
    expect(el.textContent).toContain('Modules (2)');
    expect(el.textContent).toContain('Open tasks (3)');
  });

  it('previews a module’s tasks on hover and hides them shortly after the pointer leaves', () => {
    vi.useFakeTimers();
    const { fixture, el } = setup();

    node(el, 'module:m1').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(cards(el)).toEqual(['task:t1', 'task:t2']);
    expect(panel(el)).toBeNull();

    node(el, 'module:m1').dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(cards(el)).toEqual([]);
  });

  it('locks a module on click (no hover needed), shows its cards and the details panel; clicking again unlocks', () => {
    const { fixture, el } = setup();

    node(el, 'module:m1').dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(cards(el)).toEqual(['task:t1', 'task:t2']);
    expect(node(el, 'module:m1').getAttribute('aria-pressed')).toBe('true');
    const details = panel(el)!;
    expect(details.textContent).toContain('Protocol Adapters');
    expect(details.querySelector('[data-testid="panel-stats"]')?.textContent).toContain('5');
    expect(details.textContent).toContain('Kiru Balachandran (You)');
    // 3 members, 1 sent with an avatar: the other 2 still count.
    expect(details.querySelector('.wgp-more')?.textContent).toContain('+2');
    expect(details.textContent).toContain('Sep 1, 2026');
    expect(details.textContent).toContain('Assigned to Kiru (open)');

    node(el, 'module:m1').dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(panel(el)).toBeNull();
    expect(cards(el)).toEqual([]);
  });

  it('marks an overdue task card red', () => {
    const { fixture, el } = setup();
    node(el, 'module:m1').dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(el.querySelector('[data-task-id="task:t2"] .wgx-tone--overdue')).toBeTruthy();
    expect(el.querySelector('[data-task-id="task:t1"] .wgx-tone--progress')).toBeTruthy();
  });

  it('emits navigate from a task card and from "Open module in Work Management"', () => {
    const { fixture, el, navigated } = setup();
    node(el, 'module:m1').dispatchEvent(new Event('click'));
    fixture.detectChanges();

    (el.querySelector('[data-task-id="task:t1"]') as SVGGElement).dispatchEvent(new Event('click'));
    (panel(el)!.querySelector('[data-testid="panel-open"]') as HTMLButtonElement).click();

    expect(navigated.map((n) => n.id)).toEqual(['task:t1', 'module:m1']);
  });

  it('opens a project panel listing its modules; picking one locks that module', () => {
    const { fixture, el } = setup();
    node(el, 'project:p1').dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(panel(el)!.textContent).toContain('Modules (2)');

    const moduleButtons = Array.from(panel(el)!.querySelectorAll('.wgp-item')) as HTMLButtonElement[];
    moduleButtons.find((b) => b.textContent?.includes('Device Pairing'))!.click();
    fixture.detectChanges();

    expect(panel(el)!.textContent).toContain('Device Pairing');
    expect(cards(el)).toEqual(['task:t3']);
  });

  it('search finds a task and locks the module it belongs to', () => {
    const { fixture, el } = setup();
    const input = el.querySelector('[data-testid="work-network-search"]') as HTMLInputElement;
    input.value = 'ble';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="work-network-results"]')?.textContent).toContain('Pair over BLE');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(panel(el)!.textContent).toContain('Device Pairing');
    expect(cards(el)).toEqual(['task:t3']);
    expect(node(el, 'module:m2').classList.contains('wgx-node--focus')).toBe(true);
  });

  it('a click on the empty canvas unlocks', () => {
    const { fixture, el } = setup();
    node(el, 'module:m1').dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const svg = el.querySelector('.wgx-svg') as SVGSVGElement;
    svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    svg.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 5 }));
    fixture.detectChanges();

    expect(panel(el)).toBeNull();
  });

  it('shows the employee photo from the directory cache and the project logo, each clipped to its circle', () => {
    const { el } = setup();

    expect(directory.ensureLoaded).toHaveBeenCalledWith(['e1']);
    expect(node(el, 'employee:e1').querySelector('image')?.getAttribute('href')).toBe('https://files.test/kiru.jpg');
    expect(node(el, 'project:p1').querySelector('image')?.getAttribute('href')).toContain('/work/projects/p1/logo?v=logo-1');
    // The initials / code placeholder is not drawn over a photo.
    expect(node(el, 'employee:e1').querySelector('.wgx-code')).toBeNull();
    // Modules have no image: they keep their code.
    expect(node(el, 'module:m1').querySelector('image')).toBeNull();
  });

  it('falls back to the placeholder when an image fails to load', () => {
    const { fixture, el } = setup();

    node(el, 'project:p1').querySelector('image')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(node(el, 'project:p1').querySelector('image')).toBeNull();
    expect(node(el, 'project:p1').textContent).toContain('P1');
  });

  describe('view controls', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] });
    });

    function canvasOf(fixture: ReturnType<typeof setup>['fixture']) {
      return fixture.componentInstance.canvas()!;
    }
    const click = (el: HTMLElement, selector: string) => (el.querySelector(selector) as HTMLButtonElement).click();

    it('Fit to screen glides back to the framing that fills the canvas after zooming and panning', () => {
      const { fixture, el } = setup();
      const fitted = canvasOf(fixture).camera();

      click(el, '[aria-label="Zoom in"]');
      click(el, '[aria-label="Zoom in"]');
      expect(canvasOf(fixture).camera().scale).toBeGreaterThan(fitted.scale);

      click(el, '[data-testid="work-network-fit"]');
      vi.advanceTimersByTime(100);
      // Mid-glide: moving, not jumped.
      expect(canvasOf(fixture).camera().scale).toBeGreaterThan(fitted.scale);
      vi.advanceTimersByTime(1000);

      const after = canvasOf(fixture).camera();
      expect(after.scale).toBeCloseTo(fitted.scale, 5);
      expect(after.x).toBeCloseTo(fitted.x, 5);
      expect(after.y).toBeCloseTo(fitted.y, 5);
    });

    it('Reset unlocks, clears the search, replays the layout from the centre and fits it', () => {
      const { fixture, el } = setup();
      const settled = node(el, 'project:p1').getAttribute('transform');
      const fitted = canvasOf(fixture).camera();

      node(el, 'module:m1').dispatchEvent(new Event('click'));
      const input = el.querySelector('[data-testid="work-network-search"]') as HTMLInputElement;
      input.value = 'pair';
      input.dispatchEvent(new Event('input'));
      click(el, '[aria-label="Zoom in"]');
      fixture.detectChanges();
      expect(panel(el)).toBeTruthy();

      click(el, '[data-testid="work-network-reset"]');
      vi.advanceTimersByTime(16);
      fixture.detectChanges();
      // Early in the replay the project is still close to the employee at the centre.
      expect(node(el, 'project:p1').getAttribute('transform')).not.toBe(settled);

      vi.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(panel(el)).toBeNull();
      expect(input.value).toBe('');
      expect(node(el, 'project:p1').getAttribute('transform')).toBe(settled);
      expect(canvasOf(fixture).camera().scale).toBeCloseTo(fitted.scale, 5);
    });
  });

  describe('project-mode chrome', () => {
    it('renders the Work Network heading, the close button and the employee legend when no new inputs are passed', () => {
      const { el } = setup();

      expect(el.querySelector('h2')!.textContent).toBe('Work Network');
      expect(el.querySelector('[aria-label="Close full work network"]')).not.toBeNull();
      const legend = Array.from(el.querySelectorAll('.wge-legend li')).map((li) => li.textContent!.trim());
      expect(legend).toEqual(['Project', 'Module you own', 'Module member', 'In progress', 'Not started', 'Overdue']);
    });

    it('renders the given heading and hides the close button when showClose is false', () => {
      const { fixture, el } = setup();
      fixture.componentRef.setInput('heading', 'Project Network');
      fixture.componentRef.setInput('description', 'Modules and tasks of this project.');
      fixture.componentRef.setInput('showClose', false);
      fixture.detectChanges();

      expect(el.querySelector('h2')!.textContent).toBe('Project Network');
      expect(el.querySelector('.wge-title p')!.textContent).toContain('Modules and tasks of this project.');
      expect(el.querySelector('[aria-label="Close full work network"]')).toBeNull();
    });

    it('renders the given legend items instead of the default legend', () => {
      const { fixture, el } = setup();
      fixture.componentRef.setInput('legend', [
        { key: 'module', label: 'Module' },
        { key: 'overdue', label: 'Needs attention' }
      ]);
      fixture.detectChanges();

      const legend = Array.from(el.querySelectorAll('.wge-legend li')).map((li) => li.textContent!.trim());
      expect(legend).toEqual(['Module', 'Needs attention']);
    });
  });

  describe('sprints', () => {
    it('locks a sprint on click and opens its details', () => {
      const { fixture, el } = setup();
      fixture.componentRef.setInput('graph', {
        ...graph,
        nodes: [...graph.nodes, { id: 'sprint:s1', kind: 'sprint', label: 'Sprint 7', status: 'active', projectId: 'p1' }],
        links: [...graph.links, { source: 'module:m1', target: 'sprint:s1', kind: 'contains' }]
      });
      fixture.detectChanges();

      fixture.componentInstance.toggleLock({ id: 'sprint:s1', kind: 'sprint', label: 'Sprint 7', status: 'active', projectId: 'p1' });
      fixture.detectChanges();

      expect(fixture.componentInstance.locked()).toBe('sprint:s1');
      expect(panel(el)).not.toBeNull();
    });
  });
});
