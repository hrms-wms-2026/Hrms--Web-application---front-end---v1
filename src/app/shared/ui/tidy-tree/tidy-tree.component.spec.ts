import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TidyTreeComponent } from './tidy-tree.component';

interface N { readonly id: string; readonly custom?: boolean; readonly children: readonly N[] }

@Component({
  standalone: true,
  imports: [TidyTreeComponent],
  template: `
    <app-tidy-tree [root]="root" [childrenOf]="children" [keyOf]="key" [nodeWidth]="100" [nodeHeight]="40" [dashedLink]="dashed">
      <ng-template let-node let-parent="parent" let-depth="depth">
        <span class="card" [attr.data-id]="node.id" [attr.data-parent]="parent?.id ?? 'none'" [attr.data-depth]="depth">{{ node.id }}</span>
      </ng-template>
    </app-tidy-tree>
  `
})
class HostComponent {
  root: N = { id: 'root', children: [{ id: 'a', children: [] }, { id: 'b', custom: true, children: [] }] };
  children = (n: N) => n.children;
  key = (n: N) => n.id;
  dashed = (n: N) => !!n.custom;
}

describe('TidyTreeComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders one fixed-size slot per node with the card template, its parent and depth', async () => {
    const el = await setup();
    const slots = el.querySelectorAll<HTMLElement>('.tt-slot');
    expect(slots.length).toBe(3);
    expect(slots[0].style.width).toBe('100px');
    expect(slots[0].style.height).toBe('40px');
    const b = el.querySelector('.card[data-id="b"]')!;
    expect(b.getAttribute('data-parent')).toBe('root');
    expect(b.getAttribute('data-depth')).toBe('1');
    expect(el.querySelector('.card[data-id="root"]')!.getAttribute('data-parent')).toBe('none');
  });

  it('draws one stem + bar per parent and one drop per child, dashed where asked', async () => {
    const el = await setup();
    const paths = el.querySelectorAll('svg.tt-links path');
    expect(paths.length).toBe(3);
    const dashed = el.querySelectorAll('path.tt-link--dashed');
    expect(dashed.length).toBe(1);
    // Root centre x = 116 (cards at 0 and 132, 100 wide); stem then bar between child centres 50..182.
    expect(paths[0].getAttribute('d')).toBe('M116,40 V64 M50,64 H182');
  });
});
