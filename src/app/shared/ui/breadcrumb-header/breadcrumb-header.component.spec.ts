import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbHeaderComponent } from './breadcrumb-header.component';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [BreadcrumbHeaderComponent],
  template: `<app-breadcrumb-header parentLabel="Settings" currentLabel="General Settings" icon="settings" />`
})
class TestHostComponent {}

describe('BreadcrumbHeaderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders parent and current breadcrumb labels', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Settings');
    expect(text).toContain('General Settings');
  });
});
