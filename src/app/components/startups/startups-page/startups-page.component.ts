import { Component, OnInit, ViewChild } from '@angular/core';
import { StatusModalComponent } from '../status-modal/status-modal.component';
import { EditStartupModalComponent } from '../edit-startup-modal/edit-startup-modal.component';
import { Startup } from '../../../models/startup';
import { AuthService } from '../../../services/auth.service';
import { StartupService } from '../../../services/startup.service';

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
  activeTab: 'startups' | 'performance' = 'startups';
  myStartups: Startup[] = [];
  selectedStartupId: number | null = null;

  constructor(
    private authService: AuthService,
    private startupService: StartupService
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

  setTab(tab: 'startups' | 'performance'): void {
    this.activeTab = tab;
  }
}
