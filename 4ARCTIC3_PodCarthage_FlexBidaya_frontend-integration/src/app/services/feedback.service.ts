
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FeedbackForm } from '../models/feedback-form';
import { FeedbackResponse } from '../models/feedback-response';
import { EventScore } from '../models/event-score';

@Injectable({ providedIn: 'root' })
export class FeedbackService {

  private API = 'http://localhost:8080/api/feedback';

  constructor(private http: HttpClient) {}

  saveForm(form: FeedbackForm): Observable<FeedbackForm> {
    return this.http.post<FeedbackForm>(`${this.API}/forms`, form);
  }

  getForm(targetType: string, targetId: number): Observable<FeedbackForm> {
    const token = localStorage.getItem('token');
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get<FeedbackForm>(
      `${this.API}/forms/${targetType}/${targetId}`,{ headers });
  }

  deleteForm(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/forms/${id}`);
  }

  /*submitResponse(response: FeedbackResponse): Observable<any> {
    return this.http.post(`${this.API}/responses`, response);
  }
*/
  getStats(formId: number): Observable<any> {
    return this.http.get(`${this.API}/stats/${formId}`);
  }

  getResponses(formId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/responses/form/${formId}`);
  }

submitResponse(response: any): Observable<any> {
  const token = localStorage.getItem('token');
  
  // ─── Log pour confirmer ───
  console.log('🔑 Token envoyé:', token?.substring(0, 50));
  
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  return this.http.post(
    `${this.API}/responses`, 
    response, 
    { headers }
  );
}

getEventScore(eventId: number): Observable<EventScore> {
  return this.http.get<EventScore>(
    `${this.API}/event/${eventId}/score`
  );
}

}