import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MessageDTO {
  id: number;
  senderId: number;
  senderUsername: string;
  receiverId: number;
  receiverUsername: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  timestamp: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessagingService {
  private apiUrl = `${environment.apiUrl}/messages`;
  private readonly backendBaseUrl = environment.apiUrl.replace(/\/api$/, '');

  constructor(private http: HttpClient) {}

  private getJsonHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // HTTP API methods
  sendMessage(receiverId: number, content: string): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(`${this.apiUrl}/send/${receiverId}`, { content }, { headers: this.getJsonHeaders() }).pipe(
      map(message => this.normalizeMessage(message))
    );
  }

  sendMessageWithMedia(receiverId: number, content: string, file: File): Observable<MessageDTO> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('content', content ?? '');
    // Ne pas définir Content-Type - le navigateur le fait automatiquement avec la bonne boundary
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post<MessageDTO>(`${this.apiUrl}/send-media/${receiverId}`, formData, { headers }).pipe(
      map(message => this.normalizeMessage(message))
    );
  }

  shareLocation(receiverId: number, latitude: number, longitude: number): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(`${this.apiUrl}/send-location/${receiverId}`, 
      { latitude, longitude }, { headers: this.getJsonHeaders() }).pipe(
        map(message => this.normalizeMessage(message))
      );
  }

  getConversation(otherUserId: number): Observable<MessageDTO[]> {
    return this.http.get<MessageDTO[]>(`${this.apiUrl}/conversation/${otherUserId}`, { headers: this.getAuthHeaders() }).pipe(
      map(messages => messages.map(message => this.normalizeMessage(message)))
    );
  }

  getUnreadMessageCount(): Observable<{ unreadCount: number }> {
    return this.http.get<{ unreadCount: number }>(`${this.apiUrl}/unread-count`, { headers: this.getAuthHeaders() });
  }

  getFriendsWithRecentMessages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/friends-with-messages`, { headers: this.getAuthHeaders() });
  }

  getUnreadCountsBySender(): Observable<{ [key: number]: number }> {
    return this.http.get<{ [key: number]: number }>(`${this.apiUrl}/unread-counts-by-sender`, { headers: this.getAuthHeaders() });
  }

  private normalizeMessage(message: MessageDTO): MessageDTO {
    return {
      ...message,
      mediaUrl: this.normalizeAssetUrl(message.mediaUrl)
    };
  }

  private normalizeAssetUrl(value?: string | null): string | null | undefined {
    if (!value) {
      return value;
    }

    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
      return value;
    }

    if (value.startsWith('/uploads/')) {
      return `${this.backendBaseUrl}/api/files${value}`;
    }

    if (value.startsWith('/')) {
      return `${this.backendBaseUrl}${value}`;
    }

    return value;
  }
}
