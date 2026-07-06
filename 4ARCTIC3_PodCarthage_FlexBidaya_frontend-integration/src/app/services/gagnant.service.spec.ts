import { TestBed } from '@angular/core/testing';

import { GagnantService } from './gagnant.service';

describe('GagnantService', () => {
  let service: GagnantService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GagnantService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
