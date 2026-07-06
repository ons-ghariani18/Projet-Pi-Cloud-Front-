import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
 
@Injectable({ providedIn: 'root' })
export class RecommendationService {
 
  private BASE = 'http://localhost:5001';
 
  constructor(private http: HttpClient) {}
 
  // Envoie le profil utilisateur et reçoit les événements recommandés
  getRecommendations(skills: string, domain: string): Observable<any> {
    return this.http.post<any>(`${this.BASE}/recommend`, {
      skills,
      domain,
      topN: 5
    });
  }
}