import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Credit {
  id?: string;
  montant: number;
  tauxInteret: number;
  dureeMois: number;
  source: 'BANQUE' | 'INVESTISSEUR' | 'AUTOFINANCEMENT';
}

export interface SimulationPayload {
  moisProjection: number;
  chargesFixesMensuelles: number;
  investissementMensuel: number;
  credits: Credit[];
}

export interface AiAnalysisResult {
  diagnostic: string;
  pointsForts: string;
  pointsFaibles: string;
  conseil: string;
  alertes: string;
  resumeSimple: string;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FinancialSimulationService {

  private apiUrl = `${environment.apiUrl}/simulation`;

  constructor(private http: HttpClient) { }

  getKpis(startupId: number, credits: Credit[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/kpis/${startupId}`, credits);
  }

  getAmortissement(startupId: number, credits: Credit[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/amortissement/${startupId}`, credits);
  }

  getProjection(startupId: number, payload: SimulationPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/projection/${startupId}`, payload);
  }

  getAiAnalysis(payload: any): Observable<AiAnalysisResult> {
    return this.http.post<AiAnalysisResult>(`${this.apiUrl}/analyser-ia`, payload);
  }
}
