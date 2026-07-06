import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppNotification {
  id: number;
  type: 'MESSAGE_RECEIVED' | 'POST_REACTION' | 'COMMENT_REACTION' | 'POST_SHARED';
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  actorId?: number | null;
  actorUsername?: string | null;
  actorProfileImage?: string | null;
  postId?: number | null;
  commentId?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.http.get<{ unreadCount: number }>(`${this.apiUrl}/unread-count`, { headers: this.getHeaders() });
  }

  markAsRead(notificationId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${notificationId}/read`, {}, { headers: this.getHeaders() });
  }

  markAllAsRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/read-all`, {}, { headers: this.getHeaders() });
  }
}
