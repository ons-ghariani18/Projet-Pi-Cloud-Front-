import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Conseils } from '../models/conseils';



@Injectable({ providedIn: 'root' })
export class ConseilsService {

  private api = 'http://localhost:8080/api/advice';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Conseils[]> {
    return this.http.get<Conseils[]>(this.api);
  }
 
  getById(id: number): Observable<Conseils> {
    return this.http.get<Conseils>(`${this.api}/${id}`);
  }
 
  create(c: Conseils): Observable<Conseils> {
    return this.http.post<Conseils>(this.api, c);
  }
 
  update(id: number, c: Conseils): Observable<Conseils> {
    return this.http.put<Conseils>(`${this.api}/${id}`, c);
  }
 
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

}