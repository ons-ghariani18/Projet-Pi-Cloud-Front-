import { Component, OnInit } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { BusinessPlanService } from '../../../services/business-plan.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-stat-cards',
  templateUrl: './stat-cards.component.html',
  styleUrls: ['./stat-cards.component.css']
})
export class StatCardsComponent implements OnInit {
  totalStartups: number = 0;
  pendingStartups: number = 0;
  totalBudget: number = 0;
  totalMRR: number = 0;
  
  // Nouveaux champs pour le BMC
  completedBmcs: number = 0;
  isBmcComplete: boolean = false;
  bmcPercentage: number = 0; // Nouveau : pourcentage précis
  lastStartupId: number | null = null;

  constructor(
    private startupService: StartupService,
    private bmcService: BusinessPlanService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.totalStartups = startups.length;
      this.pendingStartups = startups.filter(s => s.status === 'pending').length;
      this.totalBudget = startups.reduce((acc, s) => acc + (s.budgetInitial || 0), 0);
      this.totalMRR = startups.reduce((acc, s) => acc + (s.mrr || 0), 0);
      
      if (startups.length > 0) {
        this.lastStartupId = startups[0].id || null;
        this.checkBmcStatus(startups);
      }
    });
  }

  private checkBmcStatus(startups: any[]) {
    this.completedBmcs = 0;
    startups.forEach(startup => {
      if (startup.id) {
        this.bmcService.getByStartupId(startup.id).subscribe(plans => {
          if (plans && plans.length > 0) {
            const plan = plans[0];
            
            // Calculer le nombre de blocs remplis (sur 9)
            const blocks = [
              plan.partenairesCles, plan.activitesCles, plan.ressourcesCles,
              plan.propositionValeurs, plan.relationsClients, plan.canauxDistribution,
              plan.segmentsClients, plan.structuresCouts, plan.fluxRevenus
            ];
            const filledCount = blocks.filter(b => b && b.trim() !== '' && b !== ' ').length;
            
            if (filledCount === 9) this.completedBmcs++;
            
            if (startup.id === this.lastStartupId) {
              this.bmcPercentage = Math.round((filledCount / 9) * 100);
              this.isBmcComplete = (filledCount === 9);
            }
          }
        });
      }
    });
  }

  navigateToBmc() {
    if (this.lastStartupId) {
      this.router.navigate(['/bmc', this.lastStartupId]);
    } else {
      this.router.navigate(['/bmc']);
    }
  }
}
