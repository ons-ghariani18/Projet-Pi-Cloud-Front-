// src/app/features/opportunite/pages/opportunite-detail/opportunite-detail.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CandidatureService } from '../../../candidature/services/candidature.service';

@Component({
  selector: 'app-opportunite-detail',
  templateUrl: './opportunite-detail.component.html',
  styleUrls: ['./opportunite-detail.component.css']
})
export class OpportuniteDetailComponent implements OnInit {
  opportunite: any = null;
  loading = false;
  error = '';
  alreadyApplied = false;
  checkingStatus = false;
  userId: number = 0;
  infoMessage = '';
  showAppliedModal = false;
  username: string = 'Candidat';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private http: HttpClient,
    private candidatureService: CandidatureService
  ) {}

  ngOnInit(): void {
    this.username = localStorage.getItem('username') || 'Candidat';
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id) {
      this.router.navigate(['/client/opportunites']);
      return;
    }
    
    this.userId = this.getCurrentUserId();
    this.loadOpportunite(Number(id));
    
    if (this.userId > 0) {
      this.checkIfAlreadyApplied(Number(id));
    }
  }

  getCurrentUserId(): number {
    const userId = localStorage.getItem('userId');
    return userId ? Number(userId) : 0;
  }

  loadOpportunite(id: number): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    
    if (!token) {
      this.error = 'Vous devez être connecté';
      this.loading = false;
      setTimeout(() => this.router.navigate(['/signin']), 2000);
      return;
    }
    
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    
    this.http.get(`http://localhost:8080/api/opportunites/${id}`, { headers }).subscribe({
      next: (data: any) => {
        this.opportunite = data;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Impossible de charger les détails';
        this.loading = false;
      }
    });
  }

  checkIfAlreadyApplied(oppId: number): void {
    this.checkingStatus = true;
    this.candidatureService.hasUserApplied(this.userId, oppId).subscribe({
      next: (applied: boolean) => {
        this.alreadyApplied = applied;
        this.checkingStatus = false;
      },
      error: (err: any) => {
        console.error('Erreur check candidature', err);
        this.checkingStatus = false;
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  }

  getIcon(type: string): string {
    const icons: any = {
      'CONCOURS': '🏆',
      'FINANCEMENT': '💰',
      'PARTENARIAT': '🤝',
      'EVENEMENT': '🎉'
    };
    return icons[type] || '✨';
  }

  getStatusClass(statut: string): string {
    switch(statut) {
      case 'OUVERTE': return 'status-open';
      case 'FERMEE': return 'status-closed';
      default: return 'status-upcoming';
    }
  }

  // ✅ CORRECTION DEFINITIVE : Utiliser un Modal au lieu d'une redirection ou alerte
  postuler(): void {
    if (this.checkingStatus) {
      console.log('⌛ Vérification toujours en cours...');
      return;
    }

    if (this.alreadyApplied) {
      this.showAppliedModal = true;
      return;
    }

    const opportuniteId = this.opportunite?.id;
    if (opportuniteId) {
      this.router.navigate(['/candidature-public'], { 
        queryParams: { opportuniteId: opportuniteId } 
      });
    }
  }

  retour(): void {
    this.router.navigate(['/client/opportunites']);
  }

  goToMyApplications(): void {
    this.showAppliedModal = false;
    this.router.navigate(['/mes-candidatures']);
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/signin']);
  }
}
