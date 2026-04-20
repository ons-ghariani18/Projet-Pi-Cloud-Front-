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
    this.http.get<Startup[]>(`${this.apiUrl}/my`).pipe(
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
    return this.http.get<Startup[]>(`${this.apiUrl}/my`).pipe(
      map(startups => startups.map(s => this.augmentStartup(s))),
      tap(startups => this.startupsSubject.next(startups))
    );
  }

  createStartup(data: any): Observable<Startup> {
    return this.http.post<Startup>(this.apiUrl, data).pipe(
      map(s => this.augmentStartup(s)),
      tap(newStartup => {
        const current = this.startupsSubject.value;
        this.startupsSubject.next([...current, newStartup]);
      })
    );
  }

  getAll(): Observable<Startup[]> {
    return this.http.get<Startup[]>(`${this.apiUrl}/my`).pipe(
      map(startups => startups.map(s => this.augmentStartup(s))),
      tap(startups => this.startupsSubject.next(startups))
    );
  }

  getMyStartups(): Observable<Startup[]> {
    return this.http.get<Startup[]>(`${this.apiUrl}/my`).pipe(
      map(startups => startups.map(s => this.augmentStartup(s))),
      tap(startups => this.startupsSubject.next(startups))
    );
  }

  inviteMember(startupId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${startupId}/membres`, data);
  }

  addStartup(startup: Startup): Observable<Startup> {
    return this.createStartup(startup);
  }


  // Keep other methods for compatibility if they are used
  updateStartupStatus(id: number, status: 'approved' | 'pending' | 'rejected'): Observable<Startup> {
    return this.http.put<Startup>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      map(s => this.augmentStartup(s)),
      tap(updatedStartup => {
        const current = this.startupsSubject.value;
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = updatedStartup;
          this.startupsSubject.next(updatedList);
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
          const updatedList = [...current];
          updatedList[index] = updatedStartup;
          this.startupsSubject.next(updatedList);
        }
      })
    );
  }

  getMembers(startupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${startupId}/membres`);
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
    
    return {
      ...s,
      sub: (s.secteur || 'Secteur inconnu') + ' · Tunis',
      dates: s.dateCreation ? new Date(s.dateCreation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : d,
      status: s.stade === 'MVP' ? 'approved' : 'pending'
    };
  }
}

