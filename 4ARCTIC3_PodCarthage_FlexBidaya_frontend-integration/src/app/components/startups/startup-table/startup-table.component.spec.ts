import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartupTableComponent } from './startup-table.component';

describe('StartupTableComponent', () => {
  let component: StartupTableComponent;
  let fixture: ComponentFixture<StartupTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StartupTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartupTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
