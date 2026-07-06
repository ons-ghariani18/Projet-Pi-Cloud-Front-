import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepInfosComponent } from './step-infos.component';

describe('StepInfosComponent', () => {
  let component: StepInfosComponent;
  let fixture: ComponentFixture<StepInfosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StepInfosComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepInfosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
