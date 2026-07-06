import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Matching, MatchResult, StandMatchResult } from '../models/matching';

@Injectable({ providedIn: 'root' })
export class MatchingService {

  private api = 'http://localhost:8080/api/match';
  private api2 = 'http://localhost:8080/api/matching';

  constructor(private http: HttpClient) {}

 

  getByUser(userId: number): Observable<Matching[]> {
    return this.http.get<Matching[]>(`${this.api}/${userId}`);
  }
    getAll(): Observable<Matching[]> { return this.http.get<Matching[]>(this.api); }
  getByUserId(userId: number): Observable<Matching[]> { return this.http.get<Matching[]>(`${this.api}/user/${userId}`); }
  create(m: Matching): Observable<Matching> { return this.http.post<Matching>(this.api, m); }



  generate(userId: number): Observable<string> {
    return this.http.post(
      `${this.api}/generate/${userId}`, {},
      { responseType: 'text' }
    );
  }


 
 
  /**
   * ✅ CORRECTION : sauvegarde un résultat de matching en base de données
   * Appelé après chaque analyse CV pour persister les scores dans la table matching
   */
  save(matching: Partial<Matching>): Observable<Matching> {
    return this.http.post<Matching>(this.api, matching);
  }

 

  /**
   * Analyse un CV contre tous les stands d'un événement
   * Retourne la liste des résultats par stand (triés par score côté serveur)
   */
  analyzeCv(cvFile: File, eventId: number): Observable<StandMatchResult[]> {
    const formData = new FormData();
    formData.append('cv', cvFile);
    formData.append('eventId', String(eventId));
    return this.http.post<StandMatchResult[]>(`${this.api}/analyze?eventId=${eventId}`, formData);
  }



  detectDomain(skills: string[], availableDomains: string[]): Observable<string> {
  return this.http.post<string>(
    `${this.api2}/detect-domain`,
    { skills, availableDomains },
    { responseType: 'text' as 'json' }
  );
}
}
