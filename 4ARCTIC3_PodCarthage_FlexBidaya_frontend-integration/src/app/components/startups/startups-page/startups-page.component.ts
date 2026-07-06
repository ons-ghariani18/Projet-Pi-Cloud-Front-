import { Component, OnInit, ViewChild } from '@angular/core';
import { StatusModalComponent } from '../status-modal/status-modal.component';
import { EditStartupModalComponent } from '../edit-startup-modal/edit-startup-modal.component';
import { Startup } from '../../../models/startup';
import { AuthService } from '../../../services/auth.service';
import { StartupService } from '../../../services/startup.service';
import { BusinessPlanService } from '../../../services/business-plan.service';

@Component({
  selector: 'app-startups-page',
  templateUrl: './startups-page.component.html',
  styleUrls: ['./startups-page.component.css']
})
export class StartupsPageComponent implements OnInit {
  @ViewChild('statusModal') statusModal!: StatusModalComponent;
  @ViewChild('editModal') editModal!: EditStartupModalComponent;

  selectedStartupToEdit: Startup | null = null;
  currentUsername: string = 'Ahmed';
  activeTab: 'startups' | 'performance' | 'simulation' = 'startups';
  myStartups: Startup[] = [];
  selectedStartupId: number | null = null;

  selectedStartupForDetails: Startup | null = null;
  selectedBmc: any = null;
  
  selectedStartupForGrowth: Startup | null = null;
  growthData: any = null;

  constructor(
    private authService: AuthService,
    private startupService: StartupService,
    private bmcService: BusinessPlanService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user && user.username) {
      this.currentUsername = user.username;
    }

    this.startupService.startups$.subscribe((startups) => {
      this.myStartups = startups || [];
      if (!this.selectedStartupId && this.myStartups.length) {
        this.selectedStartupId = this.myStartups[0]?.id ?? null;
      }
    });

    this.startupService.getMyStartups().subscribe({
      next: (startups) => {
        this.myStartups = startups || [];
        this.selectedStartupId = this.myStartups[0]?.id ?? null;
      },
      error: () => {
        // Fallback to generic startups endpoint if /my is blocked by role checks.
        this.startupService.getAll().subscribe({
          next: (startups) => {
            this.myStartups = startups || [];
            this.selectedStartupId = this.myStartups[0]?.id ?? null;
          },
          error: () => {
            this.myStartups = [];
            this.selectedStartupId = null;
          }
        });
      }
    });
  }

  onOpenStatusModal(event: {startup: Startup, index: number}): void {
    this.statusModal.open(event.startup, event.index);
  }

  onOpenEditModal(startup: Startup): void {
    // Clone the startup to avoid direct binding to the list before save
    this.selectedStartupToEdit = { ...startup };
  }

  onCloseEditModal(): void {
    this.selectedStartupToEdit = null;
  }

  setTab(tab: 'startups' | 'performance' | 'simulation'): void {
    this.activeTab = tab;
  }

  // --- MODAL LOGIC ---

  onViewDetails(startup: Startup): void {
    this.selectedStartupForDetails = startup;
    this.selectedBmc = null;
    if (startup.id) {
      this.bmcService.getByStartupId(startup.id).subscribe({
        next: (data: any) => {
          if (data && data.length > 0) {
            this.selectedBmc = data[0];
          }
        },
        error: (err: any) => console.error('Error fetching BMC for details', err)
      });
    }
  }

  closeDetailsModal(): void {
    this.selectedStartupForDetails = null;
    this.selectedBmc = null;
  }

  onViewGrowth(startup: Startup): void {
    this.selectedStartupForGrowth = startup;
    
    // Generate realistic looking mock growth data based on actual MRR
    const baseMrr = startup.mrr || 1000;
    const mrrData = [
      baseMrr * 0.4, 
      baseMrr * 0.5, 
      baseMrr * 0.65, 
      baseMrr * 0.8, 
      baseMrr * 0.95, 
      baseMrr
    ];
    const memberData = [1, 2, 2, 3, Math.max(3, (startup.membres?.length || 0) - 1), Math.max(1, startup.membres?.length || 1)];

    this.growthData = {
      mrr: mrrData,
      members: memberData,
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      healthScore: Math.floor(Math.random() * 40) + 60,
      maxMrr: Math.max(...mrrData, 1),
      maxMember: Math.max(...memberData, 1)
    };
  }

  closeGrowthModal(): void {
    this.selectedStartupForGrowth = null;
    this.growthData = null;
  }
}
