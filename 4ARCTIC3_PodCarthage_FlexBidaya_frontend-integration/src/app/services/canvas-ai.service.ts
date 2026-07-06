import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CanvasSuggestionsResponse {
  suggestions: { [key: string]: string[] };
}

@Injectable({
  providedIn: 'root'
})
export class CanvasAiService {
  private apiUrl = `${environment.apiUrl}/canvas`;

  constructor(private http: HttpClient) {}

  getSuggestions(bmcData: any): Observable<CanvasSuggestionsResponse> {
    return this.http.post<CanvasSuggestionsResponse>(`${this.apiUrl}/suggestions`, bmcData);
  }
}
