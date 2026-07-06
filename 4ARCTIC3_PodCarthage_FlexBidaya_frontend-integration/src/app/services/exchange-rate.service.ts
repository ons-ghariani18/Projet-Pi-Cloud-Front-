import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExchangeRateResponse {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  date: string;
  source: string;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateService {
  private apiUrl = `${environment.apiUrl}/exchange-rate/eur-tnd`;

  constructor(private http: HttpClient) { }

  getExchangeRate(): Observable<ExchangeRateResponse> {
    return this.http.get<ExchangeRateResponse>(this.apiUrl);
  }
}
