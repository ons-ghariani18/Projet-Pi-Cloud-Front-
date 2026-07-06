import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PendingUpdate } from '../models/pending-update';

@Injectable({ providedIn: 'root' })
export class PendingUpdateService {

  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  getAll(): Observable<PendingUpdate[]> {
    return this.http.get<PendingUpdate[]>(`${this.apiUrl}/pending-updates`);
  }

  approve(id: number): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/pending-updates/${id}/approve`,
      {}
    );
  }

  reject(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/pending-updates/${id}/reject`
    );
  }

  toggleTrust(orgId: number): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/pending-updates/organisateurs/${orgId}/trust`,
      {}
    );
  }

  submitUpdate(
    entityType: 'EVENT' | 'HACKATHON',
    entityId: number,
    payload: any,
    organisateurName: string
  ): Observable<PendingUpdate> {

    const endpoint = entityType === 'EVENT'
      ? `${this.apiUrl}/pending-updates/event/${entityId}`
      : `${this.apiUrl}/pending-updates/hackathon/${entityId}`;

    return this.http.post<PendingUpdate>(
      `${endpoint}?organisateurName=${encodeURIComponent(organisateurName)}`,
      payload
    );
  }
}
