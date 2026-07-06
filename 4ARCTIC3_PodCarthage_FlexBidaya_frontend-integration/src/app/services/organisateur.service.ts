import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OrganisateurStat } from '../models/organisateur';

@Injectable({ providedIn: 'root' })
export class OrganisateurService {

  private api = 'http://localhost:8080/api/organisateurs';

  constructor(private http: HttpClient) {}

  getAll(): Observable<OrganisateurStat[]> {
    return this.http.get<OrganisateurStat[]>(this.api);
  }

  toggleTrust(orgId: number): Observable<OrganisateurStat> {
    return this.http.patch<OrganisateurStat>(
      `http://localhost:8080/api/pending-updates/organisateurs/${orgId}/trust`, {}
    );
  }
}
