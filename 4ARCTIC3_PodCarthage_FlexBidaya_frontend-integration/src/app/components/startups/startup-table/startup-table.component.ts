import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { BusinessPlanService } from '../../../services/business-plan.service';
import { AuthService } from '../../../services/auth.service';
import { Startup } from '../../../models/startup';
import { switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-startup-table',
  templateUrl: './startup-table.component.html',
  styleUrls: ['./startup-table.component.css']
})
export class StartupTableComponent implements OnInit {
  @Output() viewGrowth = new EventEmitter<Startup>();
  @Output() viewDetails = new EventEmitter<Startup>();
  @Output() edit = new EventEmitter<Startup>();

  allStartups: Startup[] = [];
  filteredStartups: Startup[] = [];
  isAdmin: boolean = false;
  
  bmcCompletionMap: { [startupId: number]: number } = {};

  constructor(
    private startupService: StartupService,
    private bmcService: BusinessPlanService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getUser();
    this.isAdmin = user?.roles?.includes('ROLE_ADMIN') || false;

    this.startupService.startups$.subscribe(startups => {
      this.allStartups = startups;
      this.filteredStartups = startups;
      this.calculateAllBmcCompletions();
    });
  }

  updateStatus(id: number | undefined, status: 'approved' | 'pending' | 'rejected'): void {
    if (!id) return;
    this.startupService.updateStartupStatus(id, status).subscribe({
      next: () => console.log(`Status updated to ${status}`),
      error: (err) => console.error('Error updating status', err)
    });
  }

  calculateAllBmcCompletions(): void {
    this.allStartups.forEach(startup => {
      if (startup.id) {
        this.bmcService.getByStartupId(startup.id).subscribe({
          next: (bmcs: any[]) => {
            if (bmcs && bmcs.length > 0) {
              const bmc = bmcs[0];
              const fields = [
                bmc.partenairesCles, bmc.activitesCles, bmc.ressourcesCles,
                bmc.propositionValeurs, bmc.relationsClients, bmc.canauxDistribution,
                bmc.segmentsClients, bmc.structuresCouts, bmc.fluxRevenus
              ];
              const filledFields = fields.filter(f => f && f.trim() !== '').length;
              this.bmcCompletionMap[startup.id!] = Math.round((filledFields / 9) * 100);
            } else {
              this.bmcCompletionMap[startup.id!] = 0;
            }
          },
          error: () => {
            this.bmcCompletionMap[startup.id!] = 0;
          }
        });
      }
    });
  }

  getBmcBadgeClass(pct: number | undefined): string {
    const p = pct || 0;
    if (p === 100) return 'bmc-complete';
    if (p > 0) return 'bmc-partial';
    return 'bmc-empty';
  }



  onViewGrowth(startup: Startup): void {
    this.viewGrowth.emit(startup);
  }

  onViewDetails(startup: Startup): void {
    this.viewDetails.emit(startup);
  }

  onEdit(s: Startup): void {
    this.edit.emit(s);
  }

  onDelete(id: number | undefined): void {
    if (!id) return;
    if (confirm('Are you sure you want to delete this startup? This will also delete its Business Model Canvas.')) {
      this.bmcService.getByStartupId(id).pipe(
        switchMap(bmcs => {
          if (bmcs && bmcs.length > 0 && bmcs[0].id) {
            // Delete the BMC first
            return this.bmcService.delete(bmcs[0].id);
          }
          // If no BMC, just continue
          return of(null);
        }),
        switchMap(() => this.startupService.deleteStartup(id))
      ).subscribe({
        next: () => {
          console.log('Startup and its BMC deleted successfully');
          // Optionally refresh list if not handled by observable
        },
        error: (err: any) => console.error('Error during deletion', err)
      });
    }
  }
}
