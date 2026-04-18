import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BusinessPlanDTO {
  id?: number;
  startupId: number;
  startup_id?: number; // Version Snake Case
  
  partenairesCles: string;
  partenaires_cles?: string;
  
  activitesCles: string;
  activites_cles?: string;
  
  ressourcesCles: string;
  ressources_cles?: string;
  
  propositionValeurs: string;
  proposition_valeurs?: string;
  
  relationsClients: string;
  relations_clients?: string;
  
  canauxDistribution: string;
  canaux_distribution?: string;
  
  segmentsClients: string;
  segments_clients?: string;
  
  structuresCouts: string;
  structures_couts?: string;
  
  fluxRevenus: string;
  flux_revenus?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessPlanService {
  private apiUrl = 'http://localhost:8080/api/business-plans';

  constructor(private http: HttpClient) { }

  getByStartupId(startupId: number): Observable<BusinessPlanDTO[]> {
    return this.http.get<BusinessPlanDTO[]>(`${this.apiUrl}/startup/${startupId}`);
  }

  create(dto: any): Observable<BusinessPlanDTO> {
    return this.http.post<BusinessPlanDTO>(this.apiUrl, dto);
  }

  update(id: number, dto: any): Observable<BusinessPlanDTO> {
    return this.http.put<BusinessPlanDTO>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
