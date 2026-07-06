import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { MembrePerformance, MembrePerformanceService } from '../../../services/membre-performance.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-membre-performance',
  templateUrl: './membre-performance.component.html',
  styleUrls: ['./membre-performance.component.css']
})
export class MembrePerformanceComponent implements OnChanges {
  @Input() startupId: number | null = null;

  loading = false;
  membres: MembrePerformance[] = [];

  constructor(
    private performanceService: MembrePerformanceService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startupId'] && this.startupId) {
      this.loadPerformance();
    }
  }

  loadPerformance(): void {
    if (!this.startupId) {
      this.membres = [];
      return;
    }

    this.loading = true;
    this.performanceService.getPerformance(this.startupId).subscribe({
      next: (res) => {
        this.membres = res || [];
        this.loading = false;
      },
      error: () => {
        this.toastService.show('Error loading member performance');
        this.loading = false;
      }
    });
  }

  get bestMembre(): MembrePerformance | null {
    if (!this.membres.length) {
      return null;
    }
    return [...this.membres].sort((a, b) => (b.scoreGlobal || 0) - (a.scoreGlobal || 0))[0];
  }

  get tauxMoyenEquipe(): number {
    if (!this.membres.length) {
      return 0;
    }
    const sum = this.membres.reduce((acc, m) => acc + (m.tauxApprobation || 0), 0);
    return +(sum / this.membres.length).toFixed(1);
  }

  get membresInactifs(): number {
    return this.membres.filter((m) => (m.totalPropositions || 0) === 0).length;
  }

  get totalApprovedEquipe(): number {
    return this.membres.reduce((acc, m) => acc + (m.totalApproved || 0), 0);
  }

  badgeClass(niveau: string): string {
    if (niveau?.includes('Très')) return 'badge badge-green';
    if (niveau?.includes('Engagé')) return 'badge badge-orange';
    if (niveau?.includes('Inactif')) return 'badge badge-gray';
    return 'badge badge-red';
  }

  scoreClass(score: number): string {
    if (score > 70) return 'score-green';
    if (score > 40) return 'score-orange';
    return 'score-red';
  }

  initiales(nom: string): string {
    if (!nom) return '?';
    return nom
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('');
  }

  progressWidth(pct: number | null): string {
    const v = Math.max(0, Math.min(100, pct || 0));
    return `${v}%`;
  }

  actionSuspendre(m: MembrePerformance): void {
    this.performanceService.suspendre(m.membreId).subscribe({
      next: () => {
        this.toastService.show(`Member ${m.nomPrenom} suspended`);
        this.loadPerformance();
      },
      error: () => this.toastService.show('Error suspending member')
    });
  }

  actionRevoquer(m: MembrePerformance): void {
    this.performanceService.revoquer(m.membreId).subscribe({
      next: () => {
        this.toastService.show(`Access revoked for ${m.nomPrenom}`);
        this.loadPerformance();
      },
      error: () => this.toastService.show('Error revoking member')
    });
  }

  actionRelancer(m: MembrePerformance): void {
    this.performanceService.relancer(m.membreId).subscribe({
      next: () => this.toastService.show(`Reminder sent to ${m.nomPrenom}`),
      error: () => this.toastService.show('Error reminding member')
    });
  }

  voirPropositions(m: MembrePerformance): void {
    if (!this.startupId) return;
    this.router.navigate(['/bmc', this.startupId], { queryParams: { memberId: m.membreId } });
  }
}
