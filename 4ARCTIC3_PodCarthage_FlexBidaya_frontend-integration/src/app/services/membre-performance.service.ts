import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MembrePerformance {
  membreId: number;
  nomPrenom: string;
  role: string;
  totalPropositions: number;
  totalApproved: number;
  totalRejected: number;
  tauxApprobation: number | null;
  tempsAvantPremiereAction: number | null;
  fenetreTotaleHeures: number | null;
  pctFenetreUtilisee: number | null;
  scoreGlobal: number;
  niveauEngagement: string;
}

@Injectable({
  providedIn: 'root'
})
export class MembrePerformanceService {
  private apiUrl = `${environment.apiUrl}/membres`;

  constructor(private http: HttpClient) {}

  getPerformance(startupId: number): Observable<MembrePerformance[]> {
    return this.http.get<MembrePerformance[]>(`${this.apiUrl}/performance/${startupId}`);
  }

  suspendre(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/suspendre`, {});
  }

  revoquer(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/revoquer`, {});
  }

  relancer(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/relancer`, {});
  }
}
