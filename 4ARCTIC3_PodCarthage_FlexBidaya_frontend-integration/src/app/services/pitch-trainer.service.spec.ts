import { TestBed } from '@angular/core/testing';

import { PitchTrainerService } from './pitch-trainer.service';

describe('PitchTrainerService', () => {
  let service: PitchTrainerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PitchTrainerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
