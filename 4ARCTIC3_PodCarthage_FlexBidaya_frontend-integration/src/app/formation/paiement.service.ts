import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PaymentRequest {
  inscriptionId: number;
  cardNumber: string;
  expiryMM: string;
  expiryYY: string;
  cvv: string;
  cardHolder: string;
  amount: number;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  cardType?: string;
  maskedCard?: string;
  amount?: number;
  message?: string;
  examInfo?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaiementService {
  private apiUrl = 'http://localhost:8080/api/payments';

  constructor(private http: HttpClient) { }

  /** Traitement du paiement custom (sans Stripe) */
  payer(req: PaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/pay`, req);
  }
}
