import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Hackathon } from '../models/hackathon';

@Injectable({ providedIn: 'root' })
export class HackathonService {

  private api = 'http://localhost:8080/api/hackathons';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getAll(): Observable<Hackathon[]> {
    return this.http.get<Hackathon[]>(this.api, { headers: this.getHeaders() });
  }
 
  getById(id: number): Observable<Hackathon> {
    return this.http.get<Hackathon>(`${this.api}/${id}`, { headers: this.getHeaders() });
  }
 
  create(h: Hackathon): Observable<Hackathon> {
    return this.http.post<Hackathon>(this.api, h, { headers: this.getHeaders() });
  }
 
  update(id: number, h: Hackathon): Observable<Hackathon> {
    return this.http.put<Hackathon>(`${this.api}/${id}`, h, { headers: this.getHeaders() });
  }
 
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`, { headers: this.getHeaders() });
  }

  
}
