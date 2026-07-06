import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ForumPost {
  id: number;
  titre: string;
  contenu: string;
  mediaUrl?: string;  // Image or video base64 or URL
  mediaType?: string; // "image" or "video"
  dateCreation: string;
  userId: number;
  username: string;
  userProfileImage?: string; // User profile picture
  likeCount: number;
  dislikeCount: number;
  loveCount: number;
  userReaction?: string | null; // Logged-in user reaction
  comments?: ForumComment[]; // Post comments
  showComments?: boolean; // Show/hide comments
  latitude?: number;
  longitude?: number;
  shared?: boolean;
  originalUsername?: string;
  isFavorited?: boolean;
}

export interface ForumComment {
  id: number;
  contenu: string;
  date: string;
  userId: number;
  username: string;
  postId: number;
  parentCommentId?: number;
  likeCount: number;
  userReaction?: string | null;
  replies?: ForumComment[];
}

export interface ForumPostDetails {
  post: ForumPost;
  comments: ForumComment[];
}

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private readonly apiUrl = `${environment.apiUrl.replace(/\/api$/, '')}/forum`;
  private readonly backendBaseUrl = environment.apiUrl.replace(/\/api$/, '');

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getPosts(): Observable<ForumPost[]> {
    return this.http.get<ForumPost[]>(`${this.apiUrl}/posts`, { headers: this.authHeaders() }).pipe(
      map(posts => posts.map(post => this.normalizeForumPost(post)))
    );
  }

  createPost(post: Partial<ForumPost>): Observable<ForumPost> {
    return this.http.post<ForumPost>(`${this.apiUrl}/posts`, post, { headers: this.authHeaders() }).pipe(
      map(createdPost => this.normalizeForumPost(createdPost))
    );
  }

  getPostComments(postId: number): Observable<ForumComment[]> {
    return this.http.get<ForumComment[]>(`${this.apiUrl}/posts/${postId}/comments`, { headers: this.authHeaders() });
  }

  getPostDetails(postId: number): Observable<ForumPostDetails> {
    return this.http.get<ForumPostDetails>(`${this.apiUrl}/posts/${postId}`, { headers: this.authHeaders() }).pipe(
      map(details => ({
        ...details,
        post: this.normalizeForumPost(details.post)
      }))
    );
  }

  addComment(postId: number, contenu: string): Observable<ForumComment> {
    return this.http.post<ForumComment>(`${this.apiUrl}/posts/${postId}/comments`, { contenu }, { headers: this.authHeaders() });
  }

  likePost(postId: number): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/posts/${postId}/reactions`, { type: 'LIKE' }, { headers: this.authHeaders() });
  }

  likeComment(commentId: number): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/comments/${commentId}/reactions`, { type: 'LIKE' }, { headers: this.authHeaders() });
  }

  updatePost(postId: number, titre: string, contenu: string): Observable<ForumPost> {
    return this.http.put<ForumPost>(`${this.apiUrl}/posts/${postId}`, { titre, contenu }, { headers: this.authHeaders() }).pipe(
      map(updatedPost => this.normalizeForumPost(updatedPost))
    );
  }

  deletePost(postId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/posts/${postId}`, {
      headers: this.authHeaders(),
      responseType: 'text'
    });
  }

  updateComment(commentId: number, contenu: string): Observable<ForumComment> {
    return this.http.put<ForumComment>(`${this.apiUrl}/comments/${commentId}`, { contenu }, { headers: this.authHeaders() });
  }

  deleteComment(commentId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/comments/${commentId}`, {
      headers: this.authHeaders(),
      responseType: 'text'
    });
  }

  replyToComment(parentCommentId: number, contenu: string): Observable<ForumComment> {
    return this.http.post<ForumComment>(`${this.apiUrl}/comments/${parentCommentId}/replies`, { contenu }, { headers: this.authHeaders() });
  }

  sharePost(postId: number): Observable<ForumPost> {
    return this.http.post<ForumPost>(`${this.apiUrl}/posts/${postId}/share`, {}, { headers: this.authHeaders() }).pipe(
      map(sharedPost => this.normalizeForumPost(sharedPost))
    );
  }

  toggleFavorite(postId: number): Observable<{isFavorited: boolean}> {
    return this.http.post<{isFavorited: boolean}>(`${this.apiUrl}/posts/${postId}/favorite`, {}, { headers: this.authHeaders() });
  }

  getFavorites(): Observable<ForumPost[]> {
    return this.http.get<ForumPost[]>(`${this.apiUrl}/favorites`, { headers: this.authHeaders() }).pipe(
      map(posts => posts.map(post => this.normalizeForumPost(post)))
    );
  }

  private normalizeForumPost(post: ForumPost): ForumPost {
    return {
      ...post,
      mediaUrl: this.normalizeAssetUrl(post.mediaUrl),
      userProfileImage: this.normalizeAssetUrl(post.userProfileImage)
    };
  }

  private normalizeAssetUrl(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
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
