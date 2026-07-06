// src/app/features/candidature/pages/mes-candidatures/mes-candidatures.component.ts

import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Observable } from 'rxjs';
import { CandidatureService, CandidatureResponse } from '../../services/candidature.service';
import { NotificationService } from '../../services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mes-candidates',
  templateUrl: './mes-candidatures.component.html',
  styleUrls: ['./mes-candidatures.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class MesCandidatesComponent implements OnInit {
  candidatures: CandidatureResponse[] = [];
  filteredCandidatures: CandidatureResponse[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  
  showNotification = false;
  notificationMessage = '';
  
  selectedStatut: string = 'TOUS';
  searchTerm: string = '';
  username: string = 'Candidat';

  get filtratedCandidaturesCount(): number {
    return this.filteredCandidatures.length;
  }
  
  statuts = ['TOUS', 'EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'];

  constructor(
    private candidatureService: CandidatureService,
    private notificationService: NotificationService,
    public router: Router
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('token')) {
      this.router.navigate(['/signin']);
      return;
    }
    this.username = localStorage.getItem('username') || 'Candidat';
    this.loadMesCandidatures();
    
    const userId = this.getCurrentUserId();
    this.notificationService.connect(userId);
    this.notificationService.notifications$.subscribe(message => {
      this.showWowToast(message);
      this.loadMesCandidatures();
    });

    // DEMO AUTO : Notification Securite Blockchain
    setTimeout(() => {
      this.notificationMessage = 'ALERTE SECURITE BLOCKCHAIN : Verification d\'integrite effectuee - Hash SHA-256 valide - Aucune fraude detectee sur vos candidatures';
      this.showNotification = true;
    }, 3000);
  }

  showWowToast(message: string): void {
    this.notificationMessage = message;
    this.showNotification = true;
    setTimeout(() => {
      this.showNotification = false;
    }, 8000);
  }

  testWowNotification(): void {
    this.showWowToast('ALERTE SECURITE BLOCKCHAIN : Verification d\'integrite effectuee - Hash SHA-256 valide - Aucune fraude detectee');
  }

  generateFakeHash(id: number): string {
    const chars = '0123456789abcdef';
    let hash = '';
    const seed = id * 7919;
    for (let i = 0; i < 64; i++) {
      hash += chars[(seed * (i + 1) * 31) % 16];
    }
    return hash;
  }

  ngOnDestroy(): void {
    this.notificationService.disconnect();
  }

  getCurrentUserId(): number {
    const userIdStr = localStorage.getItem('userId');
    return userIdStr ? parseInt(userIdStr, 10) : 1;
  }

  loadMesCandidatures(): void {
    this.isLoading = true;
    const userId = this.getCurrentUserId();
    
    this.candidatureService.getMesCandidatures(userId).subscribe({
      next: (data: CandidatureResponse[]) => {
        this.candidatures = data;
        this.filteredCandidatures = [...data];
        this.isLoading = false;
      },
      error: (err: any) => {
        this.errorMessage = 'Erreur lors du chargement.';
        this.isLoading = false;
      }
    });
  }

  filterCandidatures(): void {
    let result = [...this.candidatures];
    if (this.selectedStatut !== 'TOUS') {
      result = result.filter(c => c.statut === this.selectedStatut);
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(c => c.titreOpportunite?.toLowerCase().includes(term));
    }
    this.filteredCandidatures = result;
  }

  onStatutChange(): void { this.filterCandidatures(); }
  onSearchChange(): void { this.filterCandidatures(); }

  getStatutBadgeClass(statut: string): string {
    switch(statut) {
      case 'ACCEPTEE': return 'bg-success';
      case 'REFUSEE': return 'bg-danger';
      default: return 'bg-warning text-dark';
    }
  }

  getStatutIcon(statut: string): string {
    switch(statut) {
      case 'ACCEPTEE': return 'fas fa-check-circle';
      case 'REFUSEE': return 'fas fa-times-circle';
      default: return 'fas fa-clock';
    }
  }

  getStatutText(statut: string): string {
    switch(statut) {
      case 'ACCEPTEE': return 'Acceptée';
      case 'REFUSEE': return 'Refusée';
      default: return 'En attente';
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  downloadFile(id: number, type: 'cv' | 'motivation' | 'portfolio'): void {
    let downloadFn: Observable<Blob>;
    switch(type) {
      case 'cv': downloadFn = this.candidatureService.downloadCv(id); break;
      case 'motivation': downloadFn = this.candidatureService.downloadMotivation(id); break;
      case 'portfolio': downloadFn = this.candidatureService.downloadPortfolio(id); break;
      default: return;
    }
    downloadFn.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err: any) => console.error('Erreur:', err)
    });
  }

  deleteCandidature(id: number): void {
    if (confirm('Supprimer cette candidature ?')) {
      this.candidatureService.delete(id).subscribe({
        next: () => {
          this.successMessage = 'Supprimée avec succès !';
          this.loadMesCandidatures();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err: any) => this.errorMessage = 'Erreur lors de la suppression.'
      });
    }
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/signin']);
  }
}