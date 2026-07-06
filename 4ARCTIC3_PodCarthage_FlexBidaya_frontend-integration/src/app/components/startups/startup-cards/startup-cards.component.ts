import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { BusinessPlanService } from '../../../services/business-plan.service';
import { Startup } from '../../../models/startup';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-startup-cards',
  templateUrl: './startup-cards.component.html',
  styleUrls: ['./startup-cards.component.css']
})
export class StartupCardsComponent implements OnInit {
  @Output() edit = new EventEmitter<Startup>();
  allStartups: Startup[] = [];
  banners: string[] = ['purple', 'teal', 'indigo', 'purple'];
  selectedStartup: Startup | null = null;
  Math = Math;
  
  currentIndex: number = 0;
  pageSize: number = 3;

  constructor(
    private startupService: StartupService,
    private bmcService: BusinessPlanService
  ) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.allStartups = [...startups].reverse();
      this.currentIndex = 0;
    });
  }

  get displayedStartups(): Startup[] {
    return this.allStartups.slice(this.currentIndex, this.currentIndex + this.pageSize);
  }

  nextStartups(): void {
    if (this.currentIndex + this.pageSize < this.allStartups.length) {
      this.currentIndex += this.pageSize;
    }
  }

  prevStartups(): void {
    if (this.currentIndex - this.pageSize >= 0) {
      this.currentIndex -= this.pageSize;
    }
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
    if (confirm('Are you sure you want to delete this startup? This will also delete its Business Model Canvas.')) {
      this.bmcService.getByStartupId(id).pipe(
        switchMap(bmcs => {
          if (bmcs && bmcs.length > 0 && bmcs[0].id) {
            return this.bmcService.delete(bmcs[0].id);
          }
          return of(null);
        }),
        switchMap(() => this.startupService.deleteStartup(id))
      ).subscribe({
        next: () => console.log('Startup deleted'),
        error: (err: any) => console.error('Error during deletion', err)
      });
    }
  }
}
