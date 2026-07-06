import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Opportunite {
  id: number;
  titre: string;
  description: string;
  type: string;
  secteur: string;
  dateLimite: string;
  datePublication: string;
  statut: string;
  lienExterne: string;
  nombrePlaces: number;
  nbreVues: number;
  imageConverture: string | null;
  fichierDocument: string | null;
  nbreCandidatures: number;
}

@Injectable({
  providedIn: 'root'
})
export class OpportuniteService {
  private apiUrl = 'http://localhost:8080/api/opportunites';

  constructor(private http: HttpClient) {}

  getAll(page: number = 0, size: number = 10): Observable<any> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<any>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Opportunite> {
    return this.http.get<Opportunite>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<Opportunite> {
    return this.http.post<Opportunite>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<Opportunite> {
    return this.http.put<Opportunite>(`${this.apiUrl}/${id}`, data);
  }

  updateStatut(id: number, statut: string): Observable<Opportunite> {
    const params = new HttpParams().set('statut', statut);
    return this.http.put<Opportunite>(`${this.apiUrl}/${id}/statut`, null, { params });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadImage(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-image`, formData);
  }

  uploadDocument(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-document`, formData);
  }

  downloadDocument(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download-document`, { responseType: 'blob' });
  }
}