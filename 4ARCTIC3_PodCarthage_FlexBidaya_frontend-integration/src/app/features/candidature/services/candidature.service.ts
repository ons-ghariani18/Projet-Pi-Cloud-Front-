// src/app/features/candidature/services/candidature.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CandidatureRequest {
    motivation: string;
    lettreMotivation?: string;
    portfolio?: string;
    opportuniteId: number;
    userId: number;
}

export interface CandidatureResponse {
    id: number;
    dateCandidature: string;
    statut: 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';
    motivation: string;
    noteAdmin?: string;
    cv?: string;
    lettreMotivation?: string;
    portfolio?: string;
    opportuniteId: number;
    titreOpportunite: string;
    userId: number;
    dataHash?: string;
    validIntegrity?: boolean;
    scoreIA?: number;
    forcesIA?: string;
    faiblessesIA?: string;
    recommandationIA?: string;
    sentiment?: string;
    scoreEnthousiasme?: number;
    scoreTechnique?: number;
    scoreSoftSkills?: number;
    scoreMotivation?: number;
    rangClassement?: number;
    categorieClassement?: string;
    blockchainStatus?: 'CERTIFIED' | 'CHAINED' | 'FRAUD' | 'ORPHAN';
}

@Injectable({
    providedIn: 'root'
})
export class CandidatureService {

    // ✅ Port correct : 8080
    private apiUrl = 'http://localhost:8080/api/candidatures';

    constructor(private http: HttpClient) { }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        let headers = new HttpHeaders();
        if (token) {
            headers = headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
    }

    postuler(request: CandidatureRequest): Observable<CandidatureResponse> {
        return this.http.post<CandidatureResponse>(this.apiUrl, request, { headers: this.getHeaders() });
    }

    hasUserApplied(userId: number, opportuniteId: number): Observable<boolean> {
        return this.http.get<boolean>(`${this.apiUrl}/check/${userId}/${opportuniteId}`, { headers: this.getHeaders() });
    }

    getMesCandidatures(userId: number): Observable<CandidatureResponse[]> {
        return this.http.get<CandidatureResponse[]>(`${this.apiUrl}/user/${userId}`, { headers: this.getHeaders() });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
    }

    uploadCv(id: number, file: File): Observable<{ cv: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ cv: string }>(`${this.apiUrl}/${id}/upload-cv`, formData, { headers: this.getHeaders() });
    }

    uploadMotivation(id: number, file: File): Observable<{ lettreMotivation: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ lettreMotivation: string }>(`${this.apiUrl}/${id}/upload-motivation`, formData, { headers: this.getHeaders() });
    }

    uploadPortfolio(id: number, file: File): Observable<{ portfolio: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ portfolio: string }>(`${this.apiUrl}/${id}/upload-portfolio`, formData, { headers: this.getHeaders() });
    }

    downloadCv(id: number): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/${id}/download-cv`, { headers: this.getHeaders(), responseType: 'blob' });
    }

    downloadMotivation(id: number): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/${id}/download-motivation`, { headers: this.getHeaders(), responseType: 'blob' });
    }

    downloadPortfolio(id: number): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/${id}/download-portfolio`, { headers: this.getHeaders(), responseType: 'blob' });
    }

    getClassement(opportuniteId: number): Observable<CandidatureResponse[]> {
        return this.http.get<CandidatureResponse[]>(`${this.apiUrl}/classement/${opportuniteId}`, { headers: this.getHeaders() });
    }

    getPredictions(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/predictions`, { headers: this.getHeaders() });
    }
}