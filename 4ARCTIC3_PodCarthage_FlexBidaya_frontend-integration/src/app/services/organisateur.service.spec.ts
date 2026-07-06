import { TestBed } from '@angular/core/testing';

import { OrganisateurService } from './organisateur.service';

describe('OrganisateurService', () => {
  let service: OrganisateurService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrganisateurService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
