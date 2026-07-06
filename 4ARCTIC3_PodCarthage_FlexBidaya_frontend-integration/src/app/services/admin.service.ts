import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiUrl = 'http://localhost:8080/api/admin';

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`, { headers: this.authHeaders() });
  }

  createUser(user: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users`, user, { headers: this.authHeaders() });
  }

  deleteUser(userId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`, {
      headers: this.authHeaders(),
      responseType: 'text'
    });
  }

  blockUser(userId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/block`, {}, { headers: this.authHeaders() });
  }

  unblockUser(userId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/unblock`, {}, { headers: this.authHeaders() });
  }

  getUserFriends(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users/${userId}/friends`, { headers: this.authHeaders() });
  }

  getAllPostsWithDetails(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/posts`, { headers: this.authHeaders() });
  }

  getPostLikes(postId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/posts/${postId}/likes`, { headers: this.authHeaders() });
  }

  getPostDislikes(postId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/posts/${postId}/dislikes`, { headers: this.authHeaders() });
  }

  getPostLoves(postId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/posts/${postId}/loves`, { headers: this.authHeaders() });
  }

  deletePost(postId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/posts/${postId}`, {
      headers: this.authHeaders(),
      responseType: 'text'
    });
  }

  // Statistiques
  getLoginStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/logins`, { headers: this.authHeaders() });
  }

  getRegistrationStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/registrations`, { headers: this.authHeaders() });
  }

  uploadStatsToDrive(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    
    return this.http.post<any>(`${this.apiUrl}/stats/upload-drive`, formData, { headers });
  }
}
