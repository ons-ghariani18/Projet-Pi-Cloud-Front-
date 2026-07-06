// submit.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SubmitService {
  private apiUrl = 'http://localhost:8080/api/submit';

  constructor(private http: HttpClient) {}

  uploadFile(registrationId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/${registrationId}`, formData);
  }
}