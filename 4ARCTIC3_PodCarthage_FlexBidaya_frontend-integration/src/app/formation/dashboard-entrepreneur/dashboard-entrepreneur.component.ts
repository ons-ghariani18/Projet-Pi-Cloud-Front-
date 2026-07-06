import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InscriptionService, Inscription, Certification, ProgressionLecon } from '../inscription.service';
import { FormationService, FormationRecommandee, RecommandationsResponse } from '../formation.service';
import { TestFormationService } from '../test-formation.service';
import { SoumissionTest } from '../test-formation.model';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { PaymentResponse } from '../paiement.service';

@Component({
  selector: 'app-dashboard-entrepreneur',
  templateUrl: './dashboard-entrepreneur.component.html',
  styleUrls: ['./dashboard-entrepreneur.component.css']
})
export class DashboardEntrepreneurComponent implements OnInit {
  inscriptions: Inscription[] = [];
  certifications: Certification[] = [];
  alertes: any[] = [];
  progressionsMap: { [id: number]: ProgressionLecon[] } = {};
  onglet: 'formations' | 'certifications' | 'examens' | 'classement' = 'formations';
  reouvertureEnvoyee: { [insId: number]: boolean } = {};
  reouvertureLoading: { [insId: number]: boolean } = {};
  reouvertureMessage: { [insId: number]: string } = {};
  selectedIns: Inscription | null = null;
  soumissionsFormationMap: { [formationId: number]: SoumissionTest } = {};

  // ── Payment Modal ────────────────────────────────────────────────────
  showPaymentModal = false;
  paymentIns: Inscription | null = null;

  // ── Recommandations IA ──────────────────────────────────────────────
  recommandations: FormationRecommandee[] = [];
  recLoading   = true;
  recMethod    = '';      // 'tfidf_cosine' | 'popularity' | 'consolidation'
  recUserLevel = '';      // 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE'

  constructor(
    private inscriptionService: InscriptionService,
    private formationService: FormationService,
    private testService: TestFormationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const id = Number(localStorage.getItem('userId'));

    this.inscriptionService.getMesFormations(id).subscribe(d => {
      this.inscriptions = d;
      this.inscriptions.forEach(ins => {
        this.inscriptionService.getProgression(ins.id).subscribe(p => {
          this.progressionsMap[ins.id] = p;
        });
      });
    });

    this.testService.getMesSoumissions(id).subscribe(soumissions => {
      soumissions.forEach(s => {
        if (s.testFormation && (s.testFormation.formationId || (s.testFormation as any).formation?.id)) {
          const fId = s.testFormation.formationId || (s.testFormation as any).formation.id;
          this.soumissionsFormationMap[fId] = s;
        }
      });
    });

    this.inscriptionService.getMesCertifications(id).subscribe(d => {
      this.certifications = d;
    });
    this.inscriptionService.getMesAlertes(id).subscribe(d => {
        this.alertes = d.filter(a => !a.estLue);
    });

    // ── Charger les recommandations IA (avec auto-retrain si vide) ──────
    const loadRecs = () => this.formationService.getRecommandations(id, 6)
      .pipe(catchError(() => of(null)));

    loadRecs().subscribe((res: RecommandationsResponse | null) => {
      const isEmpty = !res || !res.recommendations || res.recommendations.length === 0;

      if (isEmpty) {
        // Modèle pas entraîné → on retrain puis on réessaie
        this.formationService.retrain().pipe(catchError(() => of(null))).subscribe(() => {
          loadRecs().subscribe((res2: RecommandationsResponse | null) => {
            this.recLoading = false;
            this.applyRecommendations(res2);
          });
        });
      } else {
        this.recLoading = false;
        this.applyRecommendations(res);
      }
    });
  }

  private applyRecommendations(res: RecommandationsResponse | null): void {
    if (!res) { this.recommandations = []; return; }
    this.recommandations = res.recommendations || [];
    this.recUserLevel    = res.userLevel || '';
    const m = (res.method || '').toLowerCase();
    if (m.includes('hybrid') || m.includes('tfidf')) {
      this.recMethod = 'tfidf_cosine';
    } else if (m.includes('popularity')) {
      this.recMethod = 'popularity';
    } else if (m.includes('consolidation')) {
      this.recMethod = 'consolidation';
    } else {
      this.recMethod = m;
    }
  }

  isLessonLocked(insId: number, lecon: any, index: number): boolean {
    const progs = this.progressionsMap[insId] || [];
    if (index === 0) return false;
    return progs[index - 1]?.statut !== 'COMPLETE';
  }

  hasLeconEnCours(ins: Inscription): boolean {
    const progs = this.progressionsMap[ins.id] || [];
    return progs.some(p => p.statut === 'EN_COURS');
  }

  allerAuCours(ins: Inscription): void {
    this.router.navigate(['/formations', ins.formation.id, 'lecons', ins.id]);
  }

  selectInscription(ins: Inscription): void {
    this.selectedIns = ins;
  }

  getProgressionPct(ins: Inscription): number {
    const progs = this.progressionsMap[ins.id];
    if (progs && progs.length > 0) {
      const done = progs.filter(p => p.statut === 'COMPLETE').length;
      return Math.round((done / progs.length) * 100);
    }
    return ins.scoreMoyen ? Math.round(ins.scoreMoyen) : 0;
  }

  getBadgeClass(badge: string): string {
    return badge === 'OR' ? 'badge-or' : badge === 'ARGENT' ? 'badge-argent' : 'badge-bronze';
  }

  telechargerPdf(cert: Certification): void {
    this.inscriptionService.ouvrirCertificat(cert.qrCodeToken);
  }

  demanderReouvertureFormation(ins: Inscription): void {
    this.reouvertureLoading[ins.id] = true;
    this.reouvertureMessage[ins.id] = '';
    
    this.inscriptionService.demanderReouvertureFormation(ins.id).subscribe({
      next: () => {
        this.reouvertureLoading[ins.id] = false;
        this.reouvertureEnvoyee[ins.id] = true;
        this.reouvertureMessage[ins.id] = '✉️ Demande envoyée ! Attendez que le mentor approuve.';
      },
      error: (err) => {
        this.reouvertureLoading[ins.id] = false;
        
        let msgStr = 'Impossible d\'envoyer la demande.';
        if (err && err.error) {
           msgStr = typeof err.error === 'string' ? err.error : (err.error.message || err.message);
        } else if (err && err.message) {
           msgStr = err.message;
        }

        this.reouvertureMessage[ins.id] = '❌ Erreur : ' + msgStr;
      }
    });
  }

  marquerAlerteLue(alerteId: number): void {
    this.inscriptionService.marquerLue(alerteId).subscribe(() => {
      this.alertes = this.alertes.filter(a => a.id !== alerteId);
    });
  }

  payerExamen(ins: Inscription): void {
    // Ouvrir le modal de paiement personnalisé (sans Stripe)
    this.paymentIns = ins;
    this.showPaymentModal = true;
  }

  onPaymentSuccess(res: PaymentResponse): void {
    if (this.paymentIns) {
      // Mettre à jour localement isPremiumPaid
      const idx = this.inscriptions.findIndex(i => i.id === this.paymentIns!.id);
      if (idx !== -1) {
        this.inscriptions[idx] = { ...this.inscriptions[idx], isPremiumPaid: true };
        this.inscriptions = [...this.inscriptions]; // trigger change detection
      }
    }
    // Fermer le modal après 3s
    setTimeout(() => this.closePaymentModal(), 3000);
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.paymentIns = null;
  }

  allerALExamen(ins: Inscription): void {
    // Naviguer vers le module de passage de test
    this.inscriptionService.getTestByFormation(ins.formation.id).subscribe(test => {
      this.router.navigate(['/passage-test', test.id], { queryParams: { inscriptionId: ins.id } });
    });
  }
  allerVersFormation(formationId: number): void {
    this.router.navigate(['/catalogue'], { queryParams: { focus: formationId } });
  }

  // ── Helpers pour le nouveau design ──────────────────────────────────
  getInitiales(): string {
    const username = localStorage.getItem('username') || '';
    if (!username) return 'ME';
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  }

  getCurrentUsername(): string {
    return localStorage.getItem('username') || 'User';
  }

  getNombreCompletes(): number {
    return this.inscriptions.filter(i => i.statut === 'TERMINEE').length;
  }

  getProgressionMoyenne(): number {
    if (!this.inscriptions.length) return 0;
    const total = this.inscriptions.reduce((sum, ins) => sum + this.getProgressionPct(ins), 0);
    return Math.round(total / this.inscriptions.length);
  }

  certForFormation(ins: Inscription): Certification | null {
    return this.certifications.find(c =>
      c.formation?.titre?.toLowerCase() === ins.formation?.titre?.toLowerCase()
    ) || null;
  }

  voirCertificat(ins: Inscription): void {
    const cert = this.certForFormation(ins);
    if (cert?.qrCodeToken) {
      this.inscriptionService.ouvrirCertificat(cert.qrCodeToken);
    }
  }
}
