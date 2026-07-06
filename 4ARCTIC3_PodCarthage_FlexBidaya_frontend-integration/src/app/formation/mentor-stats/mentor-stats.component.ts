import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormationService } from '../formation.service';
import { InscriptionService } from '../inscription.service';
import { TestFormationService } from '../test-formation.service';
import { Chart, registerables } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

Chart.register(...registerables);

@Component({
  selector: 'app-mentor-stats',
  templateUrl: './mentor-stats.component.html',
  styleUrls: ['./mentor-stats.component.css'],
})
export class MentorStatsComponent implements OnInit, OnDestroy {

  // Les canvas sont TOUJOURS dans le DOM (aucun *ngIf parent) → static:true fonctionne
  @ViewChild('chartLine',       { static: true }) lineEl!:       ElementRef<HTMLCanvasElement>;
  @ViewChild('chartStatut',     { static: true }) statutEl!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCateg',      { static: true }) categEl!:      ElementRef<HTMLCanvasElement>;
  @ViewChild('chartBar',        { static: true }) barEl!:        ElementRef<HTMLCanvasElement>;
  @ViewChild('chartFormations', { static: true }) formationsEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartExamens',    { static: true }) examensEl!:    ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  formations:     any[] = [];
  inscriptions:   any[] = [];
  certifications: any[] = [];
  examens:        any[] = [];
  allLecons:      any[] = [];
  loading = true;
  error   = false;
  categories: { name: string; count: number; pct: number; color: string }[] = [];

  get inscrits() { return this.inscriptions.length; }
  get termines() { return this.inscriptions.filter((i: any) => i.statut === 'TERMINEE').length; }
  get enCours()  { return this.inscriptions.filter((i: any) => i.statut === 'EN_COURS').length; }
  get nonDem()   { return this.inscriptions.filter((i: any) => i.statut === 'NON_COMMENCEE').length; }
  get taux()     { return this.inscrits ? Math.round(this.termines / this.inscrits * 100) : 0; }

  private readonly palette = ['#6366f1','#f59e0b','#10b981','#ec4899','#8b5cf6','#3b82f6','#06b6d4','#f97316'];

  get kpis() {
    return [
      { label: 'Formations',    value: this.formations.length,    gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', icon: '🎓' },
      { label: 'Leçons',        value: this.allLecons.length,     gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', icon: '📹' },
      { label: 'Examens',       value: this.examens.length,       gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', icon: '📝' },
      { label: 'Étudiants',     value: this.inscrits,             gradient: 'linear-gradient(135deg,#10b981,#34d399)', icon: '👨‍💻' },
      { label: 'Terminés',      value: this.termines,             gradient: 'linear-gradient(135deg,#059669,#10b981)', icon: '✅' },
      { label: 'En cours',      value: this.enCours,              gradient: 'linear-gradient(135deg,#3b82f6,#60a5fa)', icon: '▶️' },
      { label: 'Certifications',value: this.certifications.length,gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', icon: '🏆' },
      { label: 'Complétion',    value: this.taux + '%',           gradient: 'linear-gradient(135deg,#ec4899,#f472b6)', icon: '📈' },
    ];
  }

  constructor(
    private fs: FormationService,
    private is: InscriptionService,
    private ts: TestFormationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    forkJoin({
      formations:     this.fs.getMesFormations().pipe(catchError(() => of([]))),
      inscriptions:   this.is.getVueMentor().pipe(catchError(() => of([]))),
      certifications: this.is.getCertificationsMentor().pipe(catchError(() => of([]))),
      examens:        this.ts.getAllExamens().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.formations     = (res.formations     as any[]) ?? [];
        this.inscriptions   = (res.inscriptions   as any[]) ?? [];
        this.certifications = (res.certifications as any[]) ?? [];
        this.examens        = (res.examens        as any[]) ?? [];
        this.buildCategories();

        const leconObs = this.formations.length > 0
          ? forkJoin(this.formations.map((f: any) => this.fs.getLecons(f.id).pipe(catchError(() => of([])))))
          : of([] as any[][]);

        leconObs.subscribe({
          next:  (a: any[][]) => { this.allLecons = (a as any[]).flat?.() ?? []; this.finish(); },
          error: () => this.finish()
        });
      },
      error: () => { this.loading = false; this.error = true; this.cdr.detectChanges(); }
    });
  }

  ngOnDestroy(): void { this.destroyAll(); }

  private finish(): void {
    this.loading = false;
    this.cdr.detectChanges();
    // Détruire les anciens
    this.destroyAll();
    // Construire directement — static:true garantit que les refs sont valides ici
    this.buildLine();
    this.buildStatut();
    this.buildCateg();
    this.buildBar();
    this.buildFormations();
    this.buildExamens();
  }

  private destroyAll(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch (_) {} });
    this.charts = [];
  }

  private buildCategories(): void {
    const map: Record<string, number> = {};
    this.formations.forEach((f: any) => { const k = f.categorie ?? 'Autre'; map[k] = (map[k] || 0) + 1; });
    const total = this.formations.length || 1;
    this.categories = Object.entries(map).map(([name, count], i) => ({
      name, count, pct: Math.round(count / total * 100), color: this.palette[i % this.palette.length]
    }));
    if (!this.categories.length) this.categories = [{ name: 'Aucune', count: 1, pct: 100, color: '#e2e8f0' }];
  }

  // ── 1. Line chart ──────────────────────────────────────
  private buildLine(): void {
    const el = this.lineEl?.nativeElement;
    if (!el) { console.error('chartLine canvas NOT FOUND'); return; }

    const now = new Date();
    const labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      return d.toLocaleDateString('fr-FR', { month: 'short' });
    });

    // Compter les inscriptions réelles par mois
    const inscByMonth: number[] = labels.map((_, i) => {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1).getMonth();
      const targetYear = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1).getFullYear();
      return this.inscriptions.filter((ins: any) => {
        const d = new Date(ins.dateInscription || ins.dateCreation || ins.createdAt || 0);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      }).length;
    });

    // Compter les certifications réelles par mois
    const certByMonth: number[] = labels.map((_, i) => {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1).getMonth();
      const targetYear = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1).getFullYear();
      return this.certifications.filter((cert: any) => {
        const d = new Date(cert.dateEmission || cert.dateCertification || cert.createdAt || 0);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      }).length;
    });

    // Calculer les cumuls
    const cumulInsc: number[] = [];
    const cumulCert: number[] = [];
    let sumInsc = 0, sumCert = 0;
    for (let i = 0; i < 7; i++) {
      sumInsc += inscByMonth[i];
      sumCert += certByMonth[i];
      cumulInsc[i] = sumInsc;
      cumulCert[i] = sumCert;
    }

    this.charts.push(new Chart(el, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Inscriptions',   data: cumulInsc, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 2.5, fill: true, tension: 0.4, pointBackgroundColor: '#6366f1', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7 },
          { label: 'Certifications', data: cumulCert, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',  borderWidth: 2.5, fill: true, tension: 0.4, pointBackgroundColor: '#f59e0b', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7 }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { labels: { color: '#64748b', usePointStyle: true, padding: 16, font: { size: 12 } } },
          tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(148,163,184,0.15)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.15)' } }
        }
      }
    }));
  }

  // ── 2. Statut doughnut ─────────────────────────────────
  private buildStatut(): void {
    const el = this.statutEl?.nativeElement;
    if (!el) { console.error('chartStatut canvas NOT FOUND'); return; }

    const t = this.termines, e = this.enCours;
    const total = t + e || 1;

    this.charts.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: [`Terminées ${Math.round(t/total*100)}%`, `En cours ${Math.round(e/total*100)}%`],
        datasets: [{ data: [t || 0.01, e || 0.01], backgroundColor: ['#10b981','#f59e0b'], borderColor: '#fff', borderWidth: 3, hoverOffset: 10 }]
      },
      options: {
        responsive: false, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => [' Terminées',' En cours'][ctx.dataIndex] + ': ' + ctx.raw }, backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
        },
        animation: { animateScale: true, duration: 900 }
      }
    }));
  }

  // ── 3. Catégories doughnut ─────────────────────────────
  private buildCateg(): void {
    const el = this.categEl?.nativeElement;
    if (!el) { console.error('chartCateg canvas NOT FOUND'); return; }

    this.charts.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: this.categories.map(c => c.name),
        datasets: [{ data: this.categories.map(c => c.count || 0.01), backgroundColor: this.categories.map(c => c.color), borderColor: '#fff', borderWidth: 3, hoverOffset: 10 }]
      },
      options: {
        responsive: false, cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${this.categories[ctx.dataIndex]?.name}: ${ctx.raw}` }, backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
        },
        animation: { animateScale: true, duration: 900 }
      }
    }));
  }

  // ── 4. Bar certifications ──────────────────────────────
  private buildBar(): void {
    const el = this.barEl?.nativeElement;
    if (!el) { console.error('chartBar canvas NOT FOUND'); return; }

    const map: Record<string, number> = {};
    this.certifications.forEach((cert: any) => {
      const f   = this.formations.find((f2: any) => f2.titre === cert.formation?.titre);
      const cat = f?.categorie ?? 'Autre';
      map[cat] = (map[cat] || 0) + 1;
    });
    let labels = Object.keys(map);
    if (!labels.length) labels = this.categories.map(c => c.name);
    if (!labels.length) labels = ['Aucune'];

    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Certifications',
          data: labels.map(k => map[k] || 0),
          backgroundColor: labels.map((_, i) => this.palette[i % this.palette.length] + '33'),
          borderColor:     labels.map((_, i) => this.palette[i % this.palette.length]),
          borderWidth: 2, borderRadius: 8, borderSkipped: false
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.15)' } }
        },
        animation: { duration: 900 }
      }
    }));
  }

  // ── 5. Horizontal bar: Entrepreneurs par Formation ─────────────────
  private buildFormations(): void {
    const el = this.formationsEl?.nativeElement;
    if (!el) { console.error('chartFormations canvas NOT FOUND'); return; }

    // Compter les inscrits par formation
    const countByF: Record<string, number> = {};
    this.inscriptions.forEach((ins: any) => {
      const titre = ins.formationTitre ?? 'Inconnue';
      countByF[titre] = (countByF[titre] || 0) + 1;
    });

    // Trier par count desc, prendre les 8 premiers
    const sorted = Object.entries(countByF)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 8);
    const labels = sorted.map(([t]) => t.length > 22 ? t.slice(0,20) + '…' : t);
    const data   = sorted.map(([,c]) => c);
    const maxVal = Math.max(...data, 1);

    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Entrepreneurs',
          data,
          backgroundColor: data.map((v) => {
            const ratio = v / maxVal;
            return ratio > 0.7 ? '#6366f1' : ratio > 0.4 ? '#818cf8' : '#a5b4fc';
          }),
          borderColor:     data.map((v) => {
            const ratio = v / maxVal;
            return ratio > 0.7 ? '#4f46e5' : ratio > 0.4 ? '#6366f1' : '#818cf8';
          }),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: false,
        indexAxis: 'y',          // barres horizontales
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.raw} entrepreneur(s)` },
            backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
            borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.12)' } },
          y: { ticks: { color: '#334155', font: { size: 11, weight: 600 } }, grid: { display: false } }
        },
        animation: { duration: 1000 }
      }
    }));
  }

  // ── 6. Grouped bar: Inscrits / Complétés / Certifiés par catégorie ────
  private buildExamens(): void {
    const el = this.examensEl?.nativeElement;
    if (!el) { console.error('chartExamens canvas NOT FOUND'); return; }

    const cats = this.categories.map(c => c.name);
    if (!cats.length) return;

    // Inscrits par catégorie
    const inscrits: number[] = cats.map(cat => {
      const formIds = this.formations
        .filter((f: any) => (f.categorie ?? 'Autre') === cat)
        .map((f: any) => f.id);
      return this.inscriptions.filter((ins: any) => formIds.includes(ins.formationId)).length;
    });

    // Complétés par catégorie
    const completes: number[] = cats.map(cat => {
      const formIds = this.formations
        .filter((f: any) => (f.categorie ?? 'Autre') === cat)
        .map((f: any) => f.id);
      return this.inscriptions
        .filter((ins: any) => formIds.includes(ins.formationId) && ins.statut === 'TERMINEE').length;
    });

    // Certifiés par catégorie
    const certifies: number[] = cats.map(cat => {
      const formTitles = this.formations
        .filter((f: any) => (f.categorie ?? 'Autre') === cat)
        .map((f: any) => f.titre);
      return this.certifications
        .filter((cert: any) => formTitles.includes(cert.formation?.titre)).length;
    });

    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: cats,
        datasets: [
          { label: 'Inscrits',   data: inscrits,   backgroundColor: 'rgba(99,102,241,0.75)',  borderColor: '#6366f1', borderWidth: 2, borderRadius: 6, borderSkipped: false },
          { label: 'Complétés', data: completes,  backgroundColor: 'rgba(16,185,129,0.75)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6, borderSkipped: false },
          { label: 'Certifiés', data: certifies,  backgroundColor: 'rgba(245,158,11,0.75)', borderColor: '#f59e0b', borderWidth: 2, borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index' as const,
            intersect: false,
            backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
            borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.12)' } }
        },
        animation: { duration: 900 }
      }
    }));
  }


  avatarColor(u: string): string {
    let h = 0;
    for (let i = 0; i < u.length; i++) h = u.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360},60%,46%)`;
  }
  initiales(u: string): string { return u ? u.substring(0, 2).toUpperCase() : '?'; }
}