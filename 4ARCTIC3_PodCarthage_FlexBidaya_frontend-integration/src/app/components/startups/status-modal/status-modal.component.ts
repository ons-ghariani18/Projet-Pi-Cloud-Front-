import { Component, Input, OnInit } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { ToastService } from '../../../services/toast.service';
import { Startup } from '../../../models/startup';

@Component({
  selector: 'app-status-modal',
  templateUrl: './status-modal.component.html',
  styleUrls: ['./status-modal.component.css']
})
export class StatusModalComponent implements OnInit {
  isVisible: boolean = false;
  startup: Startup | null = null;
  index: number = -1;

  constructor(
    private startupService: StartupService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void { }

  open(startup: Startup, index: number): void {
    this.startup = startup;
    this.index = index;
    this.isVisible = true;
  }

  close(): void {
    this.isVisible = false;
  }

  closeOnOutsideClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close();
    }
  }

  setStatus(status: 'approved' | 'pending' | 'rejected'): void {
    if (this.startup && this.startup.id !== undefined) {
      this.startupService.updateStartupStatus(this.startup.id, status).subscribe({
        next: () => {
          const label = status === 'approved' ? 'Approved' : (status === 'pending' ? 'Pending' : 'Rejected');
          this.toastService.show(`Status updated: ${label}`);
          this.close();
        },
        error: (err) => {
          console.error('Error updating status', err);
          this.toastService.show('Error updating status');
        }
      });
    }
  }
}
