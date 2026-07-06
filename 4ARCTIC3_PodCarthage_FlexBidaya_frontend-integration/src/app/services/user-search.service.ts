import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface UserSearchResult {
  id: number;
  username: string;
  email?: string;
  bio?: string;
  profileImage?: string | null;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserSearchService {
  private readonly apiUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  search(query: string, limit: number = 10, offset: number = 0): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(
      `${this.apiUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
      { headers: this.authHeaders() }
    );
  }
}

