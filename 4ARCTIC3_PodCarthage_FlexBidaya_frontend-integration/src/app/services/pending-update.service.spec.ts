import { TestBed } from '@angular/core/testing';

import { PendingUpdateService } from './pending-update.service';

describe('PendingUpdateService', () => {
  let service: PendingUpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingUpdateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
