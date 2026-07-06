import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LocationSuggestion {
  displayName: string;
  lat: number;
  lon: number;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private apiUrl = `${environment.apiUrl}/geocoding/search`;

  constructor(private http: HttpClient) {}

  searchLocation(query: string): Observable<LocationSuggestion[]> {
    if (!query || query.trim().length < 1) {
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }
    return this.http.get<LocationSuggestion[]>(this.apiUrl, {
      params: { q: query.trim() }
    });
  }
}
