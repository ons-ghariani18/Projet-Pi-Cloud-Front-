import { TestBed } from '@angular/core/testing';

import { BusinessPlanService } from './business-plan.service';

describe('BusinessPlanService', () => {
  let service: BusinessPlanService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BusinessPlanService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
