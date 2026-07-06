import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Inscription {
  id: number;
  formation: { id: number; titre: string; description: string; categorie: string; niveau: string; dureeHeures: number; cheminImage: string };
  statut: 'NON_COMMENCEE' | 'EN_COURS' | 'TERMINEE';
  scoreMoyen: number;
  tempsTotalMin: number;
  dateInscription: string;
  isPremiumPaid?: boolean; // NOUVEAU: Pour Stripe
}

export interface ProgressionLecon {
  id: number;
  lecon: { id: number; titre: string; ordre: number; type: string; isObligatoire: boolean };
  statut: 'NON_VU' | 'EN_COURS' | 'COMPLETE';
  scoreQuiz: number;
  tempsPasseMin: number;
  remarqueMentor?: string;
  demandeReouverture?: boolean;
}

export interface InscriptionReouvertureVue {
  id: number;
  entrepreneur: { username: string };
  formation: { titre: string };
  dateInscription: string;
}

export interface Certification {
  id: number;
  formation: { titre: string };
  entrepreneur: { username: string };
  badgeType: 'BRONZE' | 'ARGENT' | 'OR';
  qrCodeToken: string;
  pdfUrl: string;
  dateEmission: string;
  /** Hash de la transaction Polygon — null si l'ancrage n'a pas encore eu lieu */
  blockchainTxHash?: string | null;
}

export interface AlerteInactivite {
  id: number;
  entrepreneur: { username: string; email: string };
  inscription: { id: number; formation: { titre: string } };
  type: 'ALERTE_1J' | 'ALERTE_7J' | 'ALERTE_14J';
  estLue: boolean;
  derniereActivite: string;
}

/** Même structure que le DTO Java `MentorInscriptionVue` (réponse GET /api/inscriptions/mentor). */
export interface MentorInscriptionVue {
  inscriptionId: number;
  entrepreneurUsername: string;
  entrepreneurEmail: string;
  formationId: number;
  formationTitre: string;
  statut: string;
  scoreMoyen: number;
  tempsTotalMin: number;
  pourcentageProgression: number;
  derniereActivite: string;
  leconsTotal: number;
  leconsComplete: number;
}

@Injectable({ providedIn: 'root' })
export class InscriptionService {
  private readonly api = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  inscrire(entrepreneurId: number, formationId: number): Observable<Inscription> {
    return this.http.post<Inscription>(`${this.api}/inscriptions`, { entrepreneurId, formationId });
  }

  getMesFormations(entrepreneurId: number): Observable<Inscription[]> {
    return this.http.get<Inscription[]>(`${this.api}/inscriptions/entrepreneur/${entrepreneurId}`);
  }

  getProgression(inscriptionId: number): Observable<ProgressionLecon[]> {
    return this.http.get<ProgressionLecon[]>(`${this.api}/progressions/inscription/${inscriptionId}`);
  }

  updateProgression(progressionId: number, progression: ProgressionLecon): Observable<ProgressionLecon> {
    return this.http.put<ProgressionLecon>(`${this.api}/progressions/${progressionId}`, progression);
  }

  getTestByFormation(formationId: number): Observable<any> {
    return this.http.get<any>(`${this.api}/examens/formation/${formationId}`);
  }

  completerLecon(inscriptionId: number, leconId: number, scoreQuiz: number, tempsMin: number): Observable<any> {
    return this.http.put(`${this.api}/inscriptions/${inscriptionId}/lecon/${leconId}/complete`, { scoreQuiz, tempsMin }, { responseType: 'text' });
  }

  demanderReouverture(progressionId: number): Observable<ProgressionLecon> {
    return this.http.post<ProgressionLecon>(`${this.api}/progressions/${progressionId}/demander-reouverture`, {});
  }

  approuverReouverture(progressionId: number): Observable<ProgressionLecon> {
    return this.http.post<ProgressionLecon>(`${this.api}/progressions/${progressionId}/approuver-reouverture`, {});
  }

  refuserReouverture(progressionId: number): Observable<ProgressionLecon> {
    return this.http.post<ProgressionLecon>(`${this.api}/progressions/${progressionId}/refuser-reouverture`, {});
  }

  getDemandesReouverture(): Observable<ProgressionLecon[]> {
    return this.http.get<ProgressionLecon[]>(`${this.api}/progressions/demandes-reouverture`);
  }

  // NOUVEAU: Réouverture au niveau FORMATION (Inscription)
  demanderReouvertureFormation(inscriptionId: number): Observable<Inscription> {
    return this.http.post<Inscription>(`${this.api}/inscriptions/${inscriptionId}/demander-reouverture`, {});
  }
  
  approuverReouvertureFormation(inscriptionId: number): Observable<Inscription> {
    return this.http.post<Inscription>(`${this.api}/inscriptions/${inscriptionId}/approuver-reouverture`, {});
  }

  refuserReouvertureFormation(inscriptionId: number): Observable<Inscription> {
    return this.http.post<Inscription>(`${this.api}/inscriptions/${inscriptionId}/refuser-reouverture`, {});
  }

  getDemandesReouvertureFormation(): Observable<Inscription[]> {
    return this.http.get<Inscription[]>(`${this.api}/inscriptions/demandes-reouverture`);
  }

  getMesCertifications(entrepreneurId: number): Observable<Certification[]> {
    return this.http.get<Certification[]>(`${this.api}/certifications/entrepreneur/${entrepreneurId}`);
  }

  verifierCertificat(token: string): Observable<Certification> {
    return this.http.get<Certification>(`${this.api}/certifications/verifier/${token}`);
  }

  /** Ouvre le certificat dans l’app Angular (impression / PDF depuis le navigateur). */
  ouvrirCertificat(token: string): void {
    const url = `${window.location.origin}/certificat/${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Mentor
  /** Données construites côté Java à partir de `MentorInscriptionVue`. */
  getVueMentor(): Observable<MentorInscriptionVue[]> {
    return this.http.get<MentorInscriptionVue[]>(`${this.api}/inscriptions/mentor`);
  }

  getMesAlertes(entrepreneurId: number): Observable<AlerteInactivite[]> {
    return this.http.get<AlerteInactivite[]>(`${this.api}/alertes/entrepreneur/${entrepreneurId}`);
  }

  getCertificationsMentor(): Observable<Certification[]> {
    return this.http.get<Certification[]>(`${this.api}/certifications/mentor`);
  }

  getAlertes(): Observable<AlerteInactivite[]> {
    return this.http.get<AlerteInactivite[]>(`${this.api}/alertes/mentor`);
  }

  marquerLue(alerteId: number): Observable<void> {
    return this.http.put<void>(`${this.api}/alertes/${alerteId}/lire`, {});
  }
}
