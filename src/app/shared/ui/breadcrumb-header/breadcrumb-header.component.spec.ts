import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbHeaderComponent } from './breadcrumb-header.component';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [BreadcrumbHeaderComponent],
  template: `<app-breadcrumb-header parentLabel="Settings" currentLabel="General Settings" icon="settings" parentUrl="/settings" />`
})
class TestHostComponent {}

describe('BreadcrumbHeaderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders parent and current breadcrumb labels with router link when parentUrl is provided', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Settings');
    expect(text).toContain('General Settings');

    const link = fixture.nativeElement.querySelector('a.bh-breadcrumb__link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/settings');
  });
});
