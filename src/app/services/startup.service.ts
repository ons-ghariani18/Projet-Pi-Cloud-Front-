import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Startup } from '../models/startup';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StartupService {
  private apiUrl = `${environment.apiUrl}/startups`;
  
  private startupsSubject = new BehaviorSubject<Startup[]>([]);
  startups$ = this.startupsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStartups();
  }

  loadStartups(): void {
    this.http.get<Startup[]>(this.apiUrl).pipe(
      map(startups => startups.map(s => this.augmentStartup(s)))
    ).subscribe({
      next: (startups) => {
        this.startupsSubject.next(startups);
      },
      error: (err) => {
        console.error('Error loading startups', err);
        this.startupsSubject.next([]);
      }
    });
  }

  getStartups(): Observable<Startup[]> {
    return this.http.get<Startup[]>(this.apiUrl).pipe(
      map(startups => startups.map(s => this.augmentStartup(s))),
      tap(startups => this.startupsSubject.next(startups))
    );
  }

  addStartup(startup: Startup): Observable<Startup> {
    return this.http.post<Startup>(this.apiUrl, startup).pipe(
      map(s => this.augmentStartup(s)),
      tap(newStartup => {
        const current = this.startupsSubject.value;
        this.startupsSubject.next([...current, newStartup]);
      })
    );
  }

  updateStartupStatus(id: number, status: 'approved' | 'pending' | 'rejected'): Observable<Startup> {
    return this.http.put<Startup>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      map(s => this.augmentStartup(s)),
      tap(updatedStartup => {
        const current = this.startupsSubject.value;
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
          current[index] = updatedStartup;
          this.startupsSubject.next([...current]);
        }
      })
    );
  }

  updateStartup(id: number, startup: Startup): Observable<Startup> {
    return this.http.put<Startup>(`${this.apiUrl}/${id}`, startup).pipe(
      map(s => this.augmentStartup(s)),
      tap(updatedStartup => {
        const current = this.startupsSubject.value;
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
          current[index] = updatedStartup;
          this.startupsSubject.next([...current]);
        }
      })
    );
  }

  deleteStartup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        const current = this.startupsSubject.value;
        this.startupsSubject.next(current.filter(s => s.id !== id));
      })
    );
  }

  private augmentStartup(s: Startup): Startup {
    const today = new Date();
    const d = today.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    
    // Fallback if backend fields are null
    const name = s.nom || 'Sans nom';
    const sector = s.secteur || 'Secteur inconnu';
    
    return {
      ...s,
      nom: name, // Ensure 'nom' is set even if backend returns 'name' (sync)
      sub: sector + ' · Tunis',
      dates: s.dateCreation ? new Date(s.dateCreation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : d,
      status: s.stade === 'MVP' ? 'approved' : 'pending' // Simple mapping logic for status
    };
  }
}
