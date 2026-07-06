import { TestBed } from '@angular/core/testing';

import { FinancialSimulationService } from './financial-simulation.service';

describe('FinancialSimulationService', () => {
  let service: FinancialSimulationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FinancialSimulationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
