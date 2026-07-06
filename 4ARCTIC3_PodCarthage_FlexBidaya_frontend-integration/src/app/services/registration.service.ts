import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HackathonRegistration } from '../models/hackathon-registration';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RegistrationService {

  private api = 'http://localhost:8080/api/registrations';

  constructor(private http: HttpClient) {}

  register(data: HackathonRegistration) {
    return this.http.post(this.api, data);
  }

  /*getByHackathon(id: number) {
    return this.http.get<HackathonRegistration[]>(`${this.api}/hackathon/${id}`);
  }*/

  getByHackathonn(hackathonId: number): Observable<HackathonRegistration[]> {
    return this.http.get<HackathonRegistration[]>(`${this.api}/hackathonn/${hackathonId}`);
  }

    getAll(): Observable<HackathonRegistration[]> { return this.http.get<HackathonRegistration[]>(this.api); }
  create(r: HackathonRegistration): Observable<HackathonRegistration> { return this.http.post<HackathonRegistration>(this.api, r); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`); }
  // Vérifier que getByHackathon retourne bien la liste complète avec teamFolderLink


getByHackathon(hackathonId: number): Observable<HackathonRegistration[]> {
  return this.http.get<HackathonRegistration[]>(
    `${this.api}/hackathon/${hackathonId}`);
}
getByUserId(userId: number): Observable<HackathonRegistration[]> {
  return this.http.get<HackathonRegistration[]>(`${this.api}/user/${userId}`);
}
}
