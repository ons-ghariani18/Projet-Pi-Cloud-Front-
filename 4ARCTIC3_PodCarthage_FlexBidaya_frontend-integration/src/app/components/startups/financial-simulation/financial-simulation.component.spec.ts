import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancialSimulationComponent } from './financial-simulation.component';

describe('FinancialSimulationComponent', () => {
  let component: FinancialSimulationComponent;
  let fixture: ComponentFixture<FinancialSimulationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FinancialSimulationComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinancialSimulationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
