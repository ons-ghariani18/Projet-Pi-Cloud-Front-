import { TestBed } from '@angular/core/testing';

import { ConseilsService } from './conseils.service';

describe('ConseilsService', () => {
  let service: ConseilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConseilsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
