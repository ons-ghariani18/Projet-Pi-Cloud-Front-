import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TestFormation, SoumissionTest, ReponseTest } from './test-formation.model';

@Injectable({
  providedIn: 'root'
})
export class TestFormationService {
  private apiUrl = 'http://localhost:8080/api/examens';

  constructor(private http: HttpClient) {}

  creerExamen(testFormation: any): Observable<TestFormation> {
    const formationId = testFormation.formationId;
    if (!formationId) throw new Error('formationId est obligatoire pour créer un examen');
    return this.http.post<TestFormation>(`${this.apiUrl}/creer/${formationId}`, testFormation);
  }

  getAllExamens(): Observable<TestFormation[]> {
    return this.http.get<TestFormation[]>(`${this.apiUrl}/all`);
  }

  getExamen(id: number, entrepreneurId: number): Observable<TestFormation> {
    return this.http.get<TestFormation>(`${this.apiUrl}/${id}?entrepreneurId=${entrepreneurId}`);
  }

  demarrerTest(testId: number, entrepreneurId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${testId}/demarrer/${entrepreneurId}`, {});
  }

  soumettreTest(testId: number, entrepreneurId: number, reponses: ReponseTest[], infractionsDetectees: number): Observable<SoumissionTest> {
    return this.http.post<SoumissionTest>(`${this.apiUrl}/${testId}/soumettre/${entrepreneurId}?infractionsDetectees=${infractionsDetectees}`, reponses);
  }

  getSoumissionsParTest(testId: number): Observable<SoumissionTest[]> {
    return this.http.get<SoumissionTest[]>(`${this.apiUrl}/soumissions/${testId}`);
  }

  getMesSoumissions(entrepreneurId: number): Observable<SoumissionTest[]> {
    return this.http.get<SoumissionTest[]>(`${this.apiUrl}/soumissions/entrepreneur/${entrepreneurId}`);
  }

  corrigerSoumission(soumissionId: number, reponsesCorrigees: ReponseTest[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/correction/${soumissionId}`, reponsesCorrigees, { responseType: 'text' });
  }
}
