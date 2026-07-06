import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { User } from '../models/user';

@Injectable({ providedIn: 'root' })
export class UserService {

  private readonly api = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  private getValidToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      return null;
    }
    return token;
  }

  private buildAuthHeaders(): HttpHeaders | null {
    const token = this.getValidToken();
    if (!token) {
      return null;
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ─── Auth ───────────────────────────────────────────────

  register(payload: any): Observable<any> {
    // payload = { username, email, password, roles, startupDescription, domaine, organisation }
    return this.http.post(`${this.api}/api/auth/signup`, payload);
  }

  login(username: string, password: string): Observable<{ id: number; jwt: string; roles: string[]; username: string }> {
    return this.http.post<{ id: number; jwt: string; roles: string[]; username: string }>(
      `${this.api}/api/auth/signin`,
      { username, password }
    );
  }

  logout(): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;
    return this.http.post(`${this.api}/logout`, {}, { headers });
  }

  // ─── Utilisateur courant ─────────────────────────────────

  getCurrentUser(): Observable<{ id: number; username: string; roles: string[] }> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const storedUsername = localStorage.getItem('username');

    const storedUserId   = localStorage.getItem('userId');
    const storedRoles    = localStorage.getItem('roles');

    if (storedUsername && storedUserId) {
      const roles = storedRoles ? (JSON.parse(storedRoles) as string[]) : [];
      return new Observable(observer => {
        observer.next({ id: Number(storedUserId), username: storedUsername, roles });
        observer.complete();
      });
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Observable(observer => {
        observer.next({
          id: Number(payload.id || 0),
          username: payload.sub || payload.username,
          roles: payload.roles || []
        });
        observer.complete();
      });
    } catch {
      throw new Error('Invalid token');
    }
  }

  // ─── CRUD utilisateurs ───────────────────────────────────

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.api);
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.api}/${id}`);
  }

  getUserById(id: number): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;
    return this.http.get(`${this.api}/users/${id}`, { headers }).pipe(
      map(user => this.normalizeProfileImage(user))
    );
  }

  create(user: User): Observable<User> {
    return this.http.post<User>(this.api, user);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }

  // ─── Profil ──────────────────────────────────────────────

  getMyProfile(): Observable<any> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get(`${this.api}/users/profile`, { headers }).pipe(
      map(user => this.normalizeProfileImage(user))
    );
  }

  updateProfile(profileData: { username?: string; email?: string; bio?: string; profileImage?: string }): Observable<any> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    return this.http.put(`${this.api}/users/profile`, profileData, { headers });
  }

  // ─── Modération ──────────────────────────────────────────

  blockUser(id: number): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.put(`${this.api}/users/${id}/block`, {}, { headers });
  }

  unblockUser(id: number): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.put(`${this.api}/users/${id}/unblock`, {}, { headers });
  }

  // ─── Localisation ────────────────────────────────────────

  updateLocation(latitude: number, longitude: number): Observable<any> {
    const headers = this.buildAuthHeaders();
    if (!headers) {
      return of(null);
    }
    return this.http.put(`${this.api}/users/location`, { latitude, longitude }, { headers });
  }

  getFriendsLocations(): Observable<any[]> {
    const headers = this.buildAuthHeaders();
    if (!headers) {
      return of([]);
    }
    return this.http.get<any[]>(`${this.api}/users/friends/locations`, { headers });
  }

  // ─── Divers ──────────────────────────────────────────────

  heartbeat(): Observable<any> {
    const headers = this.buildAuthHeaders();
    if (!headers) {
      return of(null);
    }
    return this.http.post(`${this.api}/users/heartbeat`, {}, { headers });
  }

  translate(text: string, targetLanguage: string): Observable<any> {
    const headers = this.buildAuthHeaders() ?? new HttpHeaders();
    return this.http.post(`${this.api}/api/translate`, { text, targetLanguage }, { headers });
  }

  private normalizeProfileImage(user: any): any {
    if (!user?.profileImage || typeof user.profileImage !== 'string') {
      return user;
    }

    if (user.profileImage.startsWith('http://') || user.profileImage.startsWith('https://') || user.profileImage.startsWith('data:')) {
      return user;
    }

    if (user.profileImage.startsWith('/uploads/')) {
      return {
        ...user,
        profileImage: `${this.api}/api/files${user.profileImage}`
      };
    }

    if (user.profileImage.startsWith('/')) {
      return {
        ...user,
        profileImage: `${this.api}${user.profileImage}`
      };
    }

    return user;
  }
}
