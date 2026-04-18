import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Startup } from '../../../models/startup';
import { StartupService } from '../../../services/startup.service';

@Component({
  selector: 'app-edit-startup-modal',
  templateUrl: './edit-startup-modal.component.html',
  styleUrls: ['./edit-startup-modal.component.css']
})
export class EditStartupModalComponent {
  @Input() startup: Startup | null = null;
  @Output() closed = new EventEmitter<void>();

  isLoading = false;

  constructor(private startupService: StartupService) {}

  onClose() {
    this.closed.emit();
  }

  onSubmit() {
    if (!this.startup || !this.startup.id) return;
    
    this.isLoading = true;
    this.startupService.updateStartup(this.startup.id, this.startup).subscribe({
      next: () => {
        this.isLoading = false;
        this.onClose();
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour', err);
        this.isLoading = false;
      }
    });
  }
}
