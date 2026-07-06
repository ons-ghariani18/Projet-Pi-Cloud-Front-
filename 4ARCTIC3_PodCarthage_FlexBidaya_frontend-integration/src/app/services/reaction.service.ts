import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Reaction {
  id: number;
  userId: number;
  postId?: number;
  commentId?: number;
  type: string;
}

export interface ReactionRequest {
  type: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReactionService {
  private readonly apiUrl = `${environment.apiUrl.replace(/\/api$/, '')}/forum`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Réagir à un post
  reactToPost(postId: number, type: string): Observable<Reaction | null> {
    return this.http.post<Reaction>(
      `${this.apiUrl}/posts/${postId}/reactions`,
      { type },
      { headers: this.authHeaders(), observe: 'response' }
    ).pipe(
      map(response => response.status === 204 ? null : response.body)
    );
  }

  // Obtenir la réaction de l'utilisateur actuel sur un post
  getMyPostReaction(postId: number): Observable<Reaction | null> {
    return this.http.get<Reaction>(
      `${this.apiUrl}/posts/${postId}/my-reaction`,
      { headers: this.authHeaders() }
    );
  }

  // Réagir à un commentaire
  reactToComment(commentId: number, type: string): Observable<Reaction | null> {
    return this.http.post<Reaction>(
      `${this.apiUrl}/comments/${commentId}/reactions`,
      { type },
      { headers: this.authHeaders(), observe: 'response' }
    ).pipe(
      map(response => response.status === 204 ? null : response.body)
    );
  }

  // Obtenir la réaction de l'utilisateur à un commentaire
  getMyCommentReaction(commentId: number): Observable<Reaction | null> {
    return this.http.get<Reaction>(
      `${this.apiUrl}/comments/${commentId}/my-reaction`,
      { headers: this.authHeaders() }
    );
  }

  // Compter les réactions par type pour un post
  countPostReactionsByType(postId: number, type: string): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/posts/${postId}/reactions/count?type=${type}`,
      { headers: this.authHeaders() }
    );
  }

  // Compter les réactions par type pour un commentaire
  countCommentReactionsByType(commentId: number, type: string): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/comments/${commentId}/reactions/count?type=${type}`,
      { headers: this.authHeaders() }
    );
  }
}
