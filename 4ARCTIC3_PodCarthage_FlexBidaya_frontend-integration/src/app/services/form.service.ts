import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Form as CandidatureForm } from '../models/form';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FormService {

  private api = 'http://localhost:8080/api/forms';

  constructor(private http: HttpClient) {}

  save(form: CandidatureForm) {
    return this.http.post<CandidatureForm>(this.api, form);
  }

  getByUser(userId: number) {
    return this.http.get<CandidatureForm>(`${this.api}/user/${userId}`);
  }

   getByEvent(eventId: number): Observable<CandidatureForm[]> {
  return this.http.get<CandidatureForm[]>(`${this.api}/event/${eventId}`);
}
  getAll(): Observable<CandidatureForm[]> { return this.http.get<CandidatureForm[]>(this.api); }
  create(f: CandidatureForm): Observable<CandidatureForm> { return this.http.post<CandidatureForm>(this.api, f); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`); }
}