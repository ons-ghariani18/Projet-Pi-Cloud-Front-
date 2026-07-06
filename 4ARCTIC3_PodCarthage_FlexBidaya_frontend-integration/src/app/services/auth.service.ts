import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../models/login-request';
import { RegisterRequest } from '../models/register-request';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`; 

  constructor(private http: HttpClient) {}

  signin(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/signin`, credentials).pipe(
      tap((res: any) => {
        const jwt = res.jwt || res.token;
        if (jwt) {
          this.saveToken(jwt);
          this.saveUser(res);
        }
      })
    );
  }

  signup(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup`, user);
  }

  saveToken(token: string): void {
    localStorage.setItem('token', token);
  }

  saveMembreToken(token: string): void {
    localStorage.setItem('membreToken', token);
  }

  getToken(): string | null {
    // Try both keys for backward compatibility or migration
    let token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token || token === 'undefined' || token === 'null') return null;
    return token;
  }

  getMembreToken(): string | null {
    return localStorage.getItem('membreToken');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  saveUser(user: any): void {
    const jwt = user.jwt || user.token;
    const { jwt: _, token: __, ...userWithoutToken } = user;
    localStorage.setItem('currentUser', JSON.stringify(userWithoutToken));
  }


  getUser(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('membreToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentStartupId');
  }

  saveCurrentStartupId(id: number): void {
    localStorage.setItem('currentStartupId', id.toString());
  }

  getCurrentStartupId(): number | null {
    const id = localStorage.getItem('currentStartupId');
    return id ? +id : null;
  }
}