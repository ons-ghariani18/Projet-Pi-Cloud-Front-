import { Component, OnInit } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { FinancialSimulationService, Credit, SimulationPayload } from '../../../services/financial-simulation.service';
import { Startup } from '../../../models/startup';
import { AiAnalysisResult } from '../../../services/financial-simulation.service';
import { catchError, finalize } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Component({
  selector: 'app-financial-simulation',
  templateUrl: './financial-simulation.component.html',
  styleUrls: ['./financial-simulation.component.css']
})
export class FinancialSimulationComponent implements OnInit {

  // Parameters
  startups: Startup[] = [];
  selectedStartupId: number | null = null;
  simulationType: 'projection' | 'amortissement' | 'kpis' = 'projection';
  
  budgetInitial: number = 0;
  dureeProjection: number = 24;
  chargesFixesMensuelles: number = 2000;
  investissementMensuel: number = 500;

  // Credits
  credits: Credit[] = [];
  showCreditModal: boolean = false;
  showExchangeModal: boolean = false;
  newCredit: Credit = { montant: 10000, tauxInteret: 5, dureeMois: 12, source: 'BANQUE' };

  // Results State
  loading: boolean = false;
  error: string | null = null;
  hasSimulated: boolean = false;
  activeScenario: 'pessimiste' | 'neutre' | 'optimiste' = 'neutre';

  // Result Data
  tresorerieFinale: number = 0;
  fluxNetTotal: number = 0;
  scoreSante: number = 0;
  
  // Projection Data
  chartData: any = null;
  monthlyTable: any[] = [];
  
  // Amortissement Data
  amortissementData: any[] = [];
  
  // KPI Data
  kpiData: any = null;

  // AI State
  isAiLoading: boolean = false;
  aiError: boolean = false;
  aiResult: AiAnalysisResult | null = null;
  aiLoadingMessage: string = '';
  aiLoadingMessages: string[] = [
    "Lecture des résultats financiers...",
    "Identification des points clés...",
    "Rédaction des conseils personnalisés...",
    "Finalisation de l'analyse..."
  ];
  aiLoadingInterval: any;

  constructor(
    private startupService: StartupService,
    private simulationService: FinancialSimulationService
  ) {}

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.startups = startups;
      if (this.startups.length > 0 && !this.selectedStartupId) {
        this.selectedStartupId = this.startups[0].id || null;
        this.onStartupChange();
      }
    });
  }

  onStartupChange(): void {
    if (this.selectedStartupId) {
      const s = this.startups.find(x => x.id === this.selectedStartupId);
      if (s) {
        this.budgetInitial = s.budgetInitial || 0;
      }
      this.loadCredits();
      this.hasSimulated = false;
    }
  }

  // --- CREDITS LOGIC ---
  loadCredits(): void {
    if (!this.selectedStartupId) return;
    const stored = localStorage.getItem(`credits_startup_${this.selectedStartupId}`);
    if (stored) {
      try {
        this.credits = JSON.parse(stored);
      } catch (e) {
        this.credits = [];
      }
    } else {
      this.credits = [];
    }
  }

  saveCredits(): void {
    if (!this.selectedStartupId) return;
    localStorage.setItem(`credits_startup_${this.selectedStartupId}`, JSON.stringify(this.credits));
  }

  openCreditModal(): void {
    this.newCredit = { montant: 10000, tauxInteret: 5, dureeMois: 12, source: 'BANQUE' };
    this.showCreditModal = true;
  }

  openExchangeModal(): void {
    this.showExchangeModal = true;
  }

  closeExchangeModal(): void {
    this.showExchangeModal = false;
  }

  addCredit(): void {
    this.newCredit.id = Math.random().toString(36).substring(2, 9);
    this.credits.push({ ...this.newCredit });
    this.saveCredits();
    this.showCreditModal = false;
  }

  removeCredit(id?: string): void {
    this.credits = this.credits.filter(c => c.id !== id);
    this.saveCredits();
  }

  // --- SIMULATION LOGIC ---
  lancerSimulation(): void {
    if (!this.selectedStartupId) {
      this.error = "Veuillez sélectionner une startup.";
      return;
    }
    
    this.loading = true;
    this.error = null;
    this.hasSimulated = false;

    if (this.simulationType === 'projection') {
      const payload: SimulationPayload = {
        moisProjection: this.dureeProjection,
        chargesFixesMensuelles: this.chargesFixesMensuelles,
        investissementMensuel: this.investissementMensuel,
        credits: this.credits
      };
      
      this.simulationService.getProjection(this.selectedStartupId, payload).pipe(
        catchError(err => {
          console.warn('API /projection failed, using mock data', err);
          return of(this.generateMockProjection());
        }),
        finalize(() => this.loading = false)
      ).subscribe((res: any) => {
        this.applyProjectionResults(res);
      });

    } else if (this.simulationType === 'amortissement') {
      this.simulationService.getAmortissement(this.selectedStartupId, this.credits).pipe(
        catchError(err => {
          console.warn('API /amortissement failed, using mock data', err);
          return of(this.generateMockAmortissement());
        }),
        finalize(() => this.loading = false)
      ).subscribe((res: any) => {
        this.amortissementData = res;
        this.hasSimulated = true;
        this.triggerAiAnalysis();
      });

    } else if (this.simulationType === 'kpis') {
      this.simulationService.getKpis(this.selectedStartupId, this.credits).pipe(
        catchError(err => {
          console.warn('API /kpis failed, using mock data', err);
          return of(this.generateMockKpis());
        }),
        finalize(() => this.loading = false)
      ).subscribe((res: any) => {
        this.kpiData = res;
        this.hasSimulated = true;
        this.triggerAiAnalysis();
      });
    }
  }

  reset(): void {
    this.dureeProjection = 24;
    this.chargesFixesMensuelles = 2000;
    this.investissementMensuel = 500;
    this.hasSimulated = false;
  }

  setScenario(scenario: 'pessimiste' | 'neutre' | 'optimiste'): void {
    this.activeScenario = scenario;
    // For a real app, you would recalculate or fetch new data for the scenario
    // Here we'll just mock a quick multiplier for the charts
    if (this.hasSimulated && this.simulationType === 'projection') {
      this.lancerSimulation(); // Re-run to get mock data updated
    }
  }

  // --- RESULT APPLIER ---
  applyProjectionResults(res: any): void {
    let multiplier = 1;
    if (this.activeScenario === 'pessimiste') multiplier = 0.7;
    if (this.activeScenario === 'optimiste') multiplier = 1.3;

    // Apply multiplier to mock data
    this.monthlyTable = res.monthlyTable.map((row: any) => ({
      ...row,
      mrr: row.mrr * multiplier,
      fluxNet: (row.mrr * multiplier) - row.remboursements - row.charges,
      tresorerie: row.tresorerie * multiplier
    }));

    this.tresorerieFinale = this.monthlyTable[this.monthlyTable.length - 1].tresorerie;
    this.fluxNetTotal = this.monthlyTable.reduce((sum: number, row: any) => sum + row.fluxNet, 0);
    this.scoreSante = Math.min(100, Math.max(0, 50 + (this.fluxNetTotal > 0 ? 30 : -20) + (multiplier > 1 ? 20 : 0)));

    const labels = this.monthlyTable.map(r => r.mois);
    const values = this.monthlyTable.map(r => r.tresorerie);
    const max = Math.max(...values) * 1.1;
    const min = Math.min(...values);

    // Compute SVG paths here because Angular template parser doesn't support complex .map().join() logic
    const width = 800;
    const height = 230;
    const yOffset = 250;
    const length = values.length;

    let pathCoords = values.map((v: number, i: number) => {
      const x = (i / (length - 1)) * width;
      const y = yOffset - ((v - min) / (max - min) * height);
      return `${x} ${y}`;
    });

    const linePath = 'M ' + pathCoords.map(coord => coord).join(' L ');
    const areaPath = `M 0 ${yOffset} ` + pathCoords.map(coord => `L ${coord}`).join(' ') + ` L ${width} ${yOffset} Z`;

    this.chartData = {
      labels,
      values,
      max,
      min,
      linePath,
      areaPath
    };
    
    this.hasSimulated = true;
    this.triggerAiAnalysis();
  }

  // --- MOCK DATA GENERATORS (Fallback if backend missing) ---
  private generateMockProjection(): any {
    const table = [];
    let currentTresorerie = this.budgetInitial;
    
    for (let i = 1; i <= this.dureeProjection; i++) {
      const mrr = 1000 + (i * 200); // growing MRR
      const creditAnnite = this.credits.reduce((sum, c) => sum + (c.montant / c.dureeMois), 0);
      const charges = this.chargesFixesMensuelles + this.investissementMensuel;
      const flux = mrr - creditAnnite - charges;
      currentTresorerie += flux;
      
      table.push({
        mois: `M${i}`,
        mrr: mrr,
        remboursements: creditAnnite,
        charges: charges,
        fluxNet: flux,
        tresorerie: currentTresorerie
      });
    }
    
    return { monthlyTable: table };
  }

  private generateMockAmortissement(): any[] {
    return this.credits.map(c => {
      const annuite = (c.montant * (1 + (c.tauxInteret/100))) / c.dureeMois;
      const interetMensuel = (c.montant * (c.tauxInteret/100)) / c.dureeMois;
      const principal = annuite - interetMensuel;
      
      const details = [];
      let restant = c.montant;
      for (let i = 1; i <= c.dureeMois; i++) {
        restant -= principal;
        details.push({ mois: i, annuite, principal, interet: interetMensuel, restant: Math.max(0, restant) });
      }
      
      return { credit: c, details };
    });
  }

  private generateMockKpis(): any {
    const totalFinancement = this.credits.reduce((s, c) => s + c.montant, 0);
    const totalInterets = this.credits.reduce((s, c) => s + (c.montant * (c.tauxInteret/100)), 0);
    
    return {
      tauxEndettement: this.budgetInitial > 0 ? (totalFinancement / this.budgetInitial) * 100 : 0,
      totalFinancement,
      totalInterets,
      nbCredits: this.credits.length
    };
  }

  // --- AI ANALYSIS LOGIC ---
  triggerAiAnalysis(): void {
    const startupNom = this.startups.find(s => s.id === this.selectedStartupId)?.nom || 'Startup';
    
    // Construct payload based on simulation type
    const analysePayload: any = {
      startupNom,
      budgetInitial: this.budgetInitial,
      typeAnalyse: this.simulationType,
      nbCredits: this.credits.length,
      totalFinancement: this.credits.reduce((s, c) => s + c.montant, 0)
    };

    if (this.simulationType === 'projection') {
      analysePayload.mrrInitial = this.monthlyTable[0]?.mrr || 0;
      analysePayload.moisProjection = this.dureeProjection;
      analysePayload.scoreSante = this.scoreSante;
      analysePayload.fluxNetTotalBase = this.fluxNetTotal;
    } else if (this.simulationType === 'kpis' && this.kpiData) {
      analysePayload.tauxEndettement = this.kpiData.tauxEndettement;
      analysePayload.totalInterets = this.kpiData.totalInterets;
    }

    this.isAiLoading = true;
    this.aiError = false;
    this.aiResult = null;
    this.startAiLoadingMessages();

    this.simulationService.getAiAnalysis(analysePayload).pipe(
      catchError(err => {
        console.warn('API /analyser-ia failed, using mock data after delay', err);
        // Simulate a 5-second delay to show the loading animation even for the mock
        return new Observable<AiAnalysisResult>(observer => {
          setTimeout(() => {
            observer.next(this.generateMockAiAnalysis());
            observer.complete();
          }, 5000);
        });
      }),
      finalize(() => {
        this.isAiLoading = false;
        clearInterval(this.aiLoadingInterval);
      })
    ).subscribe({
      next: (res: any) => {
        this.aiResult = res;
      },
      error: () => {
        this.aiError = true;
      }
    });
  }

  startAiLoadingMessages(): void {
    let index = 0;
    this.aiLoadingMessage = this.aiLoadingMessages[index];
    if (this.aiLoadingInterval) clearInterval(this.aiLoadingInterval);
    
    this.aiLoadingInterval = setInterval(() => {
      index = (index + 1) % this.aiLoadingMessages.length;
      this.aiLoadingMessage = this.aiLoadingMessages[index];
    }, 3000);
  }

  private generateMockAiAnalysis(): AiAnalysisResult {
    const prefix = this.simulationType === 'projection' ? "D'après la projection de trésorerie" : 
                   (this.simulationType === 'amortissement' ? "Concernant l'amortissement des crédits" : "En analysant vos KPIs financiers");
                   
    return {
      diagnostic: "La trajectoire financière est globalement saine, mais présente un léger risque de liquidité au cours des 6 premiers mois en raison d'un burn rate élevé par rapport au MRR actuel.",
      pointsForts: "Votre flux net devient positif avant la fin de l'année 1. L'investissement mensuel est modéré et vous permet de préserver votre runway. Excellent contrôle des charges fixes.",
      pointsFaibles: "Le ratio d'endettement par rapport au budget initial est assez lourd au début. Une annuité importante pèse sur la trésorerie des mois 3 à 8.",
      conseil: "Envisagez de reporter un des investissements non critiques au trimestre suivant pour garder un matelas de sécurité plus épais. Négociez un différé d'amortissement de 3 mois avec la banque si possible.",
      alertes: this.fluxNetTotal < 0 ? "Risque critique de cessation de paiement au mois 5 ! Injection de capital requise." : "Aucune alerte critique",
      resumeSimple: `${prefix}, la startup semble sur une pente ascendante viable. Si la croissance du MRR se maintient au niveau espéré, l'autonomie financière sera atteinte d'ici 14 mois.`
    };
  }
}
