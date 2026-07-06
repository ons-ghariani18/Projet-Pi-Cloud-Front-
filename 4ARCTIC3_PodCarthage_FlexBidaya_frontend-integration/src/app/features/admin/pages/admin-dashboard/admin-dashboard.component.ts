import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {

  totalCandidatures = 0;
  acceptees = 0;
  refusees = 0;
  attente = 0;
  currentYear = new Date().getFullYear();

  private pieChart: any;
  private lineChart: any;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // Vérification admin/auth si besoin...
  }

  ngAfterViewInit(): void {
    this.fetchDataAndDrawCharts();
  }

  fetchDataAndDrawCharts(): void {
    forkJoin({
      candidatures: this.http.get<any>('http://localhost:8080/api/candidatures', {
        params: { page: 0, size: 1000 }
      }),
      opportunites: this.http.get<any>('http://localhost:8080/api/opportunites/statistiques')
    }).subscribe({
      next: ({ candidatures, opportunites }) => {
        const rows = candidatures?.content ?? (Array.isArray(candidatures) ? candidatures : []);
        this.totalCandidatures = candidatures?.totalElements ?? opportunites?.totalCandidatures ?? rows.length;
        this.acceptees = rows.filter((c: any) => c.statut === 'ACCEPTEE').length;
        this.refusees = rows.filter((c: any) => c.statut === 'REFUSEE').length;
        this.attente = rows.filter((c: any) => c.statut === 'EN_ATTENTE').length;

        this.drawPieChart();
        this.drawLineChart(this.buildMonthlyData(rows));
      },
      error: (err) => {
        console.error('Erreur chargement dashboard', err);
        // Fallback graphique en cas d'absence backend
        this.drawPieChart();
        this.drawLineChart();
      }
    });
  }

  private buildMonthlyData(candidatures: any[]): number[] {
    const values = Array(12).fill(0);

    candidatures.forEach((c) => {
      if (!c.dateCandidature) return;
      const date = new Date(c.dateCandidature);
      if (!isNaN(date.getTime()) && date.getFullYear() === this.currentYear) {
        values[date.getMonth()] += 1;
      }
    });

    return values;
  }

  drawPieChart(): void {
    const ctx = document.getElementById('pieChart') as HTMLCanvasElement;
    if (this.pieChart) this.pieChart.destroy();
    
    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Acceptées', 'Refusées', 'En Attente'],
        datasets: [{
          data: [this.acceptees, this.refusees, this.attente],
          backgroundColor: ['#16a34a', '#dc2626', '#ca8a04'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  drawLineChart(monthlyData: number[] = []): void {
    const ctx = document.getElementById('lineChart') as HTMLCanvasElement;
    if (this.lineChart) this.lineChart.destroy();

    // Map les données backend (qui renvoient des clés du type "JANUARY", "FEBRUARY") 
    // ou simplement utiliser des mois par défaut.
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    
    // Exemple de transformation dynamique si monthlyData existe, sinon fallback fake data
    const values = monthlyData.length === 12 ? monthlyData : Array(12).fill(0); 
    
    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Nouvelles candidatures',
          data: values,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/signin']);
  }
}
