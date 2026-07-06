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

  private mapStage(stage: string | undefined): string {
    if (!stage) return 'Idee';
    const s = stage.toLowerCase().trim();
    if (s.includes('idee') || s.includes('idea')) return 'Idee';
    if (s.includes('prototype')) return 'Prototype';
    if (s.includes('mvp')) return 'MVP';
    if (s.includes('croissance') || s.includes('growth')) return 'Croissance';
    if (s.includes('scale')) return 'Scale';
    return 'Idee';
  }

  onSubmit() {
    if (!this.startup || !this.startup.id) return;
    
    this.isLoading = true;

    // Clone and clean data for backend - ONLY KEEP VALID FIELDS
    const cleanData: any = { 
      id: this.startup.id,
      nom: this.startup.nom,
      description: this.startup.description,
      secteur: this.startup.secteur?.toUpperCase(),
      stade: this.mapStage(this.startup.stade), // Fixed case sensitivity
      statut: (this.startup as any).statut || 'Active',
      dateCreation: this.startup.dateCreation,
      typeClient: this.startup.typeClient?.toUpperCase(),
      mrr: (this.startup as any).mrr || 0,
      budgetInitial: (this.startup as any).budgetInitial || 0,
      entrepreneur: (this.startup as any).entrepreneur // Mandatory field
    };

    // Clean members
    if (this.startup.membres && Array.isArray(this.startup.membres)) {
      cleanData.membres = this.startup.membres.map((m: any) => {
        // Keep only what StartupMembre entity has
        return {
          id: m.id,
          nomPrenom: m.nomPrenom,
          role: m.role,
          email: m.email,
          statutMembre: m.statutMembre || (m.statut === 'Full-time' ? 'Tempsplein' : (m.statut === 'Part-time' ? 'Tempspartiel' : m.statut))
        };
      });
    }

    // Clean credits
    if ((this.startup as any).credits && Array.isArray((this.startup as any).credits)) {
      cleanData.credits = (this.startup as any).credits.map((c: any) => ({
        id: c.id,
        montant: c.montant,
        tauxInteret: c.tauxInteret,
        dureeMois: c.dureeMois,
        source: c.source
      }));
    }

    this.startupService.updateStartup(this.startup.id, cleanData).subscribe({
      next: () => {
        this.isLoading = false;
        this.onClose();
      },
      error: (err) => {
        console.error('Error during update', err);
        this.isLoading = false;
      }
    });
  }
}
