import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardOrgComponent } from './dashboard-org.component';

describe('DashboardOrgComponent', () => {
  let component: DashboardOrgComponent;
  let fixture: ComponentFixture<DashboardOrgComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DashboardOrgComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardOrgComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
