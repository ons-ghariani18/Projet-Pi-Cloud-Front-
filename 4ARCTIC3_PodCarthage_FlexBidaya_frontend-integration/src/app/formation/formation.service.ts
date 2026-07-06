import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Formation {
  id: number;
  titre: string;
  description: string;
  categorie: string;
  niveau: string;
  dureeHeures: number;
  cheminImage: string;
  statut?: 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE';
  motifRejet?: string;
  nombreInscrits?: number;
}


export interface Lecon {
  id: number;
  titre: string;
  type: 'VIDEO' | 'PPT';
  cheminFichier: string;
  ordre: number;
  dureeMinutes: number;
  isObligatoire: boolean;
}

export interface Quiz {
  id: number;
  question: string;
  choixA: string;
  choixB: string;
  choixC: string;
  choixD: string;
  bonneReponse?: string;
  points: number;
}

@Injectable({ providedIn: 'root' })
export class FormationService {
  private readonly api = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Lit l'userId depuis le JWT (fallback → localStorage 'userId') */
  getUserIdFromToken(): number {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const id = payload.id || payload.userId || payload.sub;
        if (id && !isNaN(Number(id))) return Number(id);
      }
    } catch {}
    return Number(localStorage.getItem('userId')) || 0;
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(categorie?: string, niveau?: string, dureeMax?: number): Observable<Formation[]> {
    let params = new HttpParams();
    if (categorie) params = params.set('categorie', categorie);
    if (niveau) params = params.set('niveau', niveau);
    if (dureeMax) params = params.set('dureeMax', dureeMax.toString());
    return this.http.get<Formation[]>(`${this.api}/formations`, { params });
  }

  getById(id: number): Observable<Formation> {
    return this.http.get<Formation>(`${this.api}/formations/${id}`);
  }

  create(data: FormData): Observable<Formation> {
    return this.http.post<Formation>(`${this.api}/formations`, data);
  }

  update(id: number, data: FormData): Observable<Formation> {
    return this.http.put<Formation>(`${this.api}/formations/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/formations/${id}`, { headers: this.authHeaders() });
  }

  // Workflow Approve/Reject
  getPending(): Observable<Formation[]> {
    return this.http.get<Formation[]>(`${this.api}/formations/pending`);
  }

  getMesFormations(): Observable<Formation[]> {
    const expertId = this.getUserIdFromToken();
    return this.http.get<Formation[]>(
      `${this.api}/formations/mes-formations?expertId=${expertId}`,
      { headers: this.authHeaders() }
    );
  }

  approuver(id: number): Observable<Formation> {
    return this.http.patch<Formation>(`${this.api}/formations/${id}/approuver`, {});
  }

  rejeter(id: number, motif: string): Observable<Formation> {
    return this.http.patch<Formation>(`${this.api}/formations/${id}/rejeter?motif=${encodeURIComponent(motif)}`, {});
  }

  getLecons(formationId: number): Observable<Lecon[]> {
    return this.http.get<Lecon[]>(`${this.api}/lecons/formation/${formationId}`);
  }

  getQuiz(leconId: number): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(`${this.api}/quiz/lecon/${leconId}`);
  }

  addLeconVideo(data: FormData): Observable<Lecon> {
    return this.http.post<Lecon>(`${this.api}/lecons/video`, data);
  }

  addLeconPPT(data: FormData): Observable<Lecon> {
    return this.http.post<Lecon>(`${this.api}/lecons/ppt`, data);
  }

  addQuiz(quiz: Partial<Quiz> & { leconId: number }): Observable<Quiz> {
    return this.http.post<Quiz>(`${this.api}/quiz/lecon/${quiz.leconId}`, quiz);
  }

  updateLecon(id: number, data: FormData): Observable<Lecon> {
    return this.http.put<Lecon>(`${this.api}/lecons/${id}`, data);
  }

  updateQuiz(id: number, quiz: Partial<Quiz>): Observable<Quiz> {
    return this.http.put<Quiz>(`${this.api}/quiz/${id}`, quiz);
  }

  deleteLecon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/lecons/${id}`, { headers: this.authHeaders() });
  }

  deleteQuiz(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/quiz/${id}`);
  }

  getMarketTrends(): Observable<any> {
    return this.http.get(`${this.api}/expert/market-trends`);
  }

  /**
   * Re-entraîne le modèle Flask sans redémarrer Spring Boot.
   */
  retrain(): Observable<any> {
    return this.http.post(`${this.api}/formations/retrain`, {});
  }

  /**
   * Recommande des formations à un entrepreneur (TF-IDF hybride).
   * Retourne { method, entrepreneurId, recommendations: [...] }
   */
  getRecommandations(entrepreneurId: number, topN: number = 5): Observable<RecommandationsResponse> {
    return this.http.get<RecommandationsResponse>(
      `${this.api}/formations/recommander/${entrepreneurId}?topN=${topN}`
    );
  }
}

export interface FormationRecommandee extends Formation {
  score:    string;   // ex : "87%"
  scoreRaw: number;   // ex : 0.87
}

export interface RecommandationsResponse {
  method:          string;   // "hybrid_tfidf_level_popularity" | "popularity" | "consolidation"
  entrepreneurId?: number;
  userLevel?:      string;   // "DEBUTANT" | "INTERMEDIAIRE" | "AVANCE"
  recommendations: FormationRecommandee[];
}
