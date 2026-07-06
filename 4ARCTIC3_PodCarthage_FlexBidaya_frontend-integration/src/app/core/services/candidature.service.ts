import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Candidature {
  id: number;
  dateCandidature: string;
  statut: string;
  motivation: string;
  noteAdmin: string | null;
  cv: string | null;
  lettreMotivation: string | null;
  portfolio: string | null;
  opportuniteId: number;
  titreOpportunite: string;
  userId: number;
}

@Injectable({
  providedIn: 'root'
})
export class CandidatureService {
  private apiUrl = 'http://localhost:8080/api/candidatures';

  constructor(private http: HttpClient) {}

  getAll(page: number = 0, size: number = 10): Observable<any> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<any>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Candidature> {
    return this.http.get<Candidature>(`${this.apiUrl}/${id}`);
  }

  getByOpportunite(opportuniteId: number): Observable<Candidature[]> {
    return this.http.get<Candidature[]>(`${this.apiUrl}/opportunite/${opportuniteId}`);
  }

  getByUser(userId: number): Observable<Candidature[]> {
    return this.http.get<Candidature[]>(`${this.apiUrl}/user/${userId}`);
  }

  postuler(data: any): Observable<Candidature> {
    return this.http.post<Candidature>(this.apiUrl, data);
  }

  updateStatut(id: number, statut: string, noteAdmin?: string): Observable<Candidature> {
    return this.http.put<Candidature>(`${this.apiUrl}/${id}/statut`, { statut, noteAdmin });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadCv(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-cv`, formData);
  }

  uploadMotivation(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-motivation`, formData);
  }

  uploadPortfolio(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-portfolio`, formData);
  }

  downloadCv(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download-cv`, { responseType: 'blob' });
  }
}