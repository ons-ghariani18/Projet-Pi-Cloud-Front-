import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface PitchAnalysisResult {
  detected: boolean;
  message?: string;
  confidence: number;
  posture: number;
  hands: number;
  head: number;
  eyeContact?: number;
  voiceRhythm?: number;   // ← add this line
  feedback?: { type: 'success' | 'warning' | 'error'; text: string }[];
}
@Injectable({ providedIn: 'root' })
export class PitchTrainerService {

  private api = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  analyzeFrame(base64Image: string): Observable<PitchAnalysisResult> {
    return this.http.post<PitchAnalysisResult>(
      `${this.api}/analyze`,
      { image: base64Image }
    );
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.api}/health`);
  }
}