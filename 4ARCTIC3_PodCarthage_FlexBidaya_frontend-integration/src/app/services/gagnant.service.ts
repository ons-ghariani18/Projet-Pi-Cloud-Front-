import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Gagnant } from '../models/gagnant';



@Injectable({ providedIn: 'root' })
export class GagnantService {

  private api = 'http://localhost:8080/api/winners';

  constructor(private http: HttpClient) {}

  getByHackathon(id: number): Observable<Gagnant[]> {
    return this.http.get<Gagnant[]>(`${this.api}/hackathon/${id}`);
  }

  add(winner: Gagnant) {
    return this.http.post<Gagnant>(this.api, winner);
  }
    /** Supprime un gagnant par son id */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
