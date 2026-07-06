import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SwotResponse {
  startup: string;
  score_bmc: number;
  swot: {
    forces: string[];
    faiblesses: string[];
    opportunites: string[];
    menaces: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class SwotService {
  private apiUrl = 'http://localhost:5000/swot/analyze';

  constructor(private http: HttpClient) { }

  analyzeSwot(bmcData: any): Observable<SwotResponse> {
    return this.http.post<SwotResponse>(this.apiUrl, bmcData);
  }
}
