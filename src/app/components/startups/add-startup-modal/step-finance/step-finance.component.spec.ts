import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepFinanceComponent } from './step-finance.component';

describe('StepFinanceComponent', () => {
  let component: StepFinanceComponent;
  let fixture: ComponentFixture<StepFinanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StepFinanceComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepFinanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
