import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { Startup } from '../../../models/startup';

@Component({
  selector: 'app-startup-cards',
  templateUrl: './startup-cards.component.html',
  styleUrls: ['./startup-cards.component.css']
})
export class StartupCardsComponent implements OnInit {
  @Output() edit = new EventEmitter<Startup>();
  recentStartups: Startup[] = [];
  banners: string[] = ['purple', 'teal', 'indigo', 'purple'];
  selectedStartup: Startup | null = null;

  constructor(private startupService: StartupService) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.recentStartups = startups.slice(-3).reverse();
    });
  }

  openDetails(s: Startup) {
    this.selectedStartup = s;
  }

  closeDetails() {
    this.selectedStartup = null;
  }

  onEdit(event: Event, s: Startup) {
    event.stopPropagation();
    this.edit.emit(s);
  }

  onDelete(event: Event, id: number | undefined) {
    event.stopPropagation();
    if (!id) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer cette startup ?')) {
      this.startupService.deleteStartup(id).subscribe({
        next: () => console.log('Startup supprimée'),
        error: (err: any) => console.error('Erreur lors de la suppression', err)
      });
    }
  }
}
