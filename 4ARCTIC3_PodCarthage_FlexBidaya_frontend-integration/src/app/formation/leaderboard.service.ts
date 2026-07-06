import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LeaderboardEntry {
  rang: number;
  username: string;
  certifications: number;
  formationsTerminees: number;
  scoreMoyen: number;
  points: number;
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly api = 'http://localhost:8080/api/leaderboard';
  constructor(private http: HttpClient) {}
  getClassement(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(this.api);
  }
}
