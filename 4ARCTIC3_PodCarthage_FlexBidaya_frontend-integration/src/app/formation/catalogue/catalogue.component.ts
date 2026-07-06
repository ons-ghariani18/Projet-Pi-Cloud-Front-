import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Formation, FormationService } from '../formation.service';
import { Inscription, InscriptionService } from '../inscription.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface FormationAvecStatut extends Formation {
  inscription?: Inscription;
  statutInscription: 'NON_INSCRIT' | 'EN_COURS' | 'TERMINEE';
  progression: number;
  bookmarked: boolean;
}

@Component({
  selector: 'app-catalogue',
  templateUrl: './catalogue.component.html',
  styleUrls: ['./catalogue.component.css']
})
export class CatalogueComponent implements OnInit {
  formations: FormationAvecStatut[] = [];
  formationsFiltrees: FormationAvecStatut[] = [];

  filtreCategorie = '';
  filtreNiveau = '';
  filtreDureeMax = 40;
  maxDurationData = 40;
  filtreStatut: 'ALL' | 'ACTIVE' | 'DONE' = 'ALL';

  weeklyProgress = 0;
  totalBadges = 0;
  badgeIcons: string[] = [];

  isLoading = true;

  // ── Utilisateur connecté ──────────────────────────────────────────────
  currentUsername = localStorage.getItem('username') || 'User';
  currentUserInitiale = (localStorage.getItem('username') || 'U').charAt(0).toUpperCase();
  currentUserRole = 'ENTREPRENEUR';

  constructor(
    private formationService: FormationService,
    private inscriptionService: InscriptionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    if (roles.includes('ROLE_EXPERT') || roles.includes('ROLE_ORGANISATEUR')) {
      this.currentUserRole = 'EXPERT';
    } else if (roles.includes('ROLE_ADMIN')) {
      this.currentUserRole = 'ADMIN';
    }
    this.chargerTout();
  }

  chargerTout(): void {
    this.isLoading = true;
    const entrepreneurId = Number(localStorage.getItem('userId'));

    forkJoin({
      formations: this.formationService.getAll().pipe(
        catchError(() => of([] as Formation[]))
      ),
      inscriptions: this.inscriptionService.getMesFormations(entrepreneurId).pipe(
        catchError(() => of([] as Inscription[]))
      ),
      certifications: this.inscriptionService.getMesCertifications(entrepreneurId).pipe(
        catchError(() => of([] as any[]))
      ),
    }).subscribe({
      next: ({ formations, inscriptions, certifications }) => {
        // Calculate dynamic values for top dash
        this.totalBadges = certifications.length;
        
        const icons = [];
        if (certifications.some(c => c.badgeType === 'OR')) icons.push('★');
        if (certifications.some(c => c.badgeType === 'ARGENT')) icons.push('⚡');
        if (certifications.some(c => c.badgeType === 'BRONZE')) icons.push('A');
        if (icons.length < 3 && certifications.length > 0) {
           icons.push('✦');
        }
        this.badgeIcons = icons.slice(0, 3);
        if (this.badgeIcons.length === 0) this.badgeIcons = ['-'];

        let avgProg = 0;
        if (inscriptions.length > 0) {
          const sumProg = inscriptions.reduce((acc, ins) => acc + Math.min(100, (ins.scoreMoyen || 0)), 0);
          avgProg = Math.round(sumProg / inscriptions.length);
        }
        this.weeklyProgress = avgProg;

        this.formations = formations.map(f => {
          const ins = inscriptions.find(i => i.formation.id === f.id);
          let statutInscription_var: 'NON_INSCRIT' | 'EN_COURS' | 'TERMINEE' = 'NON_INSCRIT';
          if (ins) {
            statutInscription_var = ins.statut === 'TERMINEE' ? 'TERMINEE' : 'EN_COURS';
          }
          const progression = ins ? Math.min(100, Math.round(ins.scoreMoyen || 0)) : 0;
          return { ...f, inscription: ins, statutInscription: statutInscription_var, progression, bookmarked: false };
        });

        if (this.formations.length > 0) {
          this.maxDurationData = Math.max(1, ...this.formations.map((f: FormationAvecStatut) => f.dureeHeures || 0));
        } else {
          this.maxDurationData = 5;
        }
        this.filtreDureeMax = this.maxDurationData;

        this.appliquerFiltres();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  appliquerFiltres(): void {
    this.formationsFiltrees = this.formations.filter(f => {
      const okCategorie = !this.filtreCategorie || f.categorie === this.filtreCategorie;
      const okNiveau = !this.filtreNiveau || f.niveau === this.filtreNiveau;
      const maxVal = Number(this.filtreDureeMax) || 0;
      const okDuree = f.dureeHeures <= maxVal;
      const okStatut =
        this.filtreStatut === 'ALL' ||
        (this.filtreStatut === 'ACTIVE' && f.statutInscription === 'EN_COURS') ||
        (this.filtreStatut === 'DONE' && f.statutInscription === 'TERMINEE');
      return okCategorie && okNiveau && okDuree && okStatut;
    });
  }

  chargerFormations(): void {
    this.appliquerFiltres();
  }

  voirFormation(f: FormationAvecStatut): void {
    if (f.inscription) {
      this.router.navigate(['/formations', f.id, 'lecons', f.inscription.id]);
    }
  }

  actionPrincipale(f: FormationAvecStatut, event: Event): void {
    event.stopPropagation();
    if (f.statutInscription === 'NON_INSCRIT') {
      const id = Number(localStorage.getItem('userId'));
      this.inscriptionService.inscrire(id, f.id).subscribe({
        next: (ins) => {
          f.inscription = ins;
          f.statutInscription = 'EN_COURS';
          this.router.navigate(['/formations', f.id, 'lecons', ins.id]);
        },
        error: (e) => alert(e.error || 'Erreur lors de l\'inscription')
      });
    } else if (f.statutInscription === 'EN_COURS') {
      this.router.navigate(['/formations', f.id, 'lecons', f.inscription!.id]);
    } else if (f.statutInscription === 'TERMINEE') {
      // Just let them review the course
      this.router.navigate(['/formations', f.id, 'lecons', f.inscription!.id]);
    }
  }

  toggleBookmark(f: FormationAvecStatut, event: Event): void {
    event.stopPropagation();
    f.bookmarked = !f.bookmarked;
  }

  getImageUrl(chemin?: string): string {
    if (!chemin) return 'https://placehold.co/400x220/0d1117/00d4ff?text=Formation';
    const clean = chemin.replace(/\\/g, '/');
    return clean.startsWith('http') ? clean : `http://localhost:8080/${clean}`;
  }

  getCategorieColor(cat: string): string {
    const map: Record<string, string> = {
      TECH: '#00d4ff',
      MARKETING: '#a855f7',
      FINANCE: '#f59e0b',
      MANAGEMENT: '#10b981',
      LEADERSHIP: '#ef4444',
      JURIDIQUE: '#6366f1'
    };
    return map[cat] || '#94a3b8';
  }

  getProgressionModuleLabel(f: FormationAvecStatut): string {
    if (!f.inscription) return '';
    const total = 5;
    const done = Math.round((f.progression / 100) * total);
    return `MODULE ${done} OF ${total}`;
  }
}
