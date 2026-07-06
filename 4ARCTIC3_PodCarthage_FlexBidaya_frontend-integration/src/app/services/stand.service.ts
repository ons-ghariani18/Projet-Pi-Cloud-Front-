import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Stand } from '../models/stand';
@Injectable({ providedIn: 'root' })
export class StandService {

  private api = 'http://localhost:8080/api/stands';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getAll(): Observable<Stand[]> {
    return this.http.get<Stand[]>(this.api, { headers: this.getHeaders() });
  }

  getByEvent(eventId: number): Observable<Stand[]> {
    return this.http.get<Stand[]>(`${this.api}/event/${eventId}`, { headers: this.getHeaders() });
  }

  create(stand: Stand) {
    return this.http.post<Stand>(this.api, stand, { headers: this.getHeaders() });
  }

  getById(id: number): Observable<Stand> { return this.http.get<Stand>(`${this.api}/${id}`, { headers: this.getHeaders() }); }
  getByEventId(eventId: number): Observable<Stand[]> { return this.http.get<Stand[]>(`${this.api}/event/${eventId}`, { headers: this.getHeaders() }); }
  update(id: number, s: Stand): Observable<Stand> { return this.http.put<Stand>(`${this.api}/${id}`, s, { headers: this.getHeaders() }); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`, { headers: this.getHeaders() }); }


  
}
