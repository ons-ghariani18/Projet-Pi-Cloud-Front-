import { TestBed } from '@angular/core/testing';

import { ActiveTimerService } from './active-timer.service';

describe('ActiveTimerService', () => {
  let service: ActiveTimerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActiveTimerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
