import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Evenement } from '../models/evenement';

@Injectable({ providedIn: 'root' })
export class EventService {

  private api = 'http://localhost:8080/api/events';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getAll(): Observable<Evenement[]> {
    return this.http.get<Evenement[]>(this.api, { headers: this.getHeaders() });
  }

  create(event: Evenement): Observable<Evenement> {
    return this.http.post<Evenement>(this.api, event, { headers: this.getHeaders() });
  }

  update(id: number, event: Evenement): Observable<Evenement> {
    return this.http.put<Evenement>(`${this.api}/${id}`, event, { headers: this.getHeaders() });
  }

  getById(id: number): Observable<Evenement> {
    return this.http.get<Evenement>(`${this.api}/${id}`, { headers: this.getHeaders() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`, { headers: this.getHeaders() });
  }

  
}