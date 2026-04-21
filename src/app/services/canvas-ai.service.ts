import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CanvasSuggestionsResponse {
  partenairesCles?: string[];
  activitesCles?: string[];
  ressourcesCles?: string[];
  propositionValeurs?: string[];
  relationsClients?: string[];
  canauxDistribution?: string[];
  segmentsClients?: string[];
  structuresCouts?: string[];
  fluxRevenus?: string[];
  secteur?: string;
  stade?: string;
  typeClient?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CanvasAiService {
  private apiUrl = `${environment.apiUrl}/canvas`;

  constructor(private http: HttpClient) {}

  getSuggestions(startupId: number): Observable<CanvasSuggestionsResponse> {
    const params = new HttpParams().set('startupId', startupId);
    return this.http.post<CanvasSuggestionsResponse>(`${this.apiUrl}/suggestions`, null, { params });
  }
}
