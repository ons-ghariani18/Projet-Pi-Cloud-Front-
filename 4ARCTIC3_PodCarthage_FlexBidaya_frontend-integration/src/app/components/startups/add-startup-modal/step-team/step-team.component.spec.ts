import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepTeamComponent } from './step-team.component';

describe('StepTeamComponent', () => {
  let component: StepTeamComponent;
  let fixture: ComponentFixture<StepTeamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StepTeamComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepTeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
