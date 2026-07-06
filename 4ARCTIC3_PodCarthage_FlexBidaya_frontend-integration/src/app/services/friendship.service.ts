import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserSummary {
  id: number;
  username: string;
  profileImage?: string | null;
  isOnline?: boolean;
  lastActivity?: string | Date;
  unreadCount?: number;
}

export interface Friendship {
  id: number;
  requester: UserSummary;
  addressee: UserSummary;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FriendshipService {
  private readonly apiUrl = `${environment.apiUrl}/friendships`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    if (!token) {
      console.warn('FriendshipService: no auth token found in localStorage');
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  sendFriendRequest(addresseeId: number): Observable<Friendship> {
    return this.http.post<Friendship>(`${this.apiUrl}/request/${addresseeId}`, {}, { headers: this.authHeaders() });
  }

  getReceivedRequests(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(`${this.apiUrl}/received-requests`, { headers: this.authHeaders() });
  }

  getSentRequests(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(`${this.apiUrl}/sent-requests`, { headers: this.authHeaders() });
  }

  acceptRequest(friendshipId: number): Observable<Friendship> {
    return this.http.put<Friendship>(`${this.apiUrl}/accept/${friendshipId}`, {}, { headers: this.authHeaders() });
  }

  rejectRequest(friendshipId: number): Observable<Friendship> {
    return this.http.put<Friendship>(`${this.apiUrl}/reject/${friendshipId}`, {}, { headers: this.authHeaders() });
  }

  getFriends(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.apiUrl}/friends`, { headers: this.authHeaders() });
  }

  removeFriend(friendId: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/remove/${friendId}`, { headers: this.authHeaders() });
  }
}
