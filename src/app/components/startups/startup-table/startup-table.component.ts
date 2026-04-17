import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { Startup } from '../../../models/startup';

@Component({
  selector: 'app-startup-table',
  templateUrl: './startup-table.component.html',
  styleUrls: ['./startup-table.component.css']
})
export class StartupTableComponent implements OnInit {
  @Output() updateStatus = new EventEmitter<{startup: Startup, index: number}>();

  allStartups: Startup[] = [];
  filteredStartups: Startup[] = [];
  currentFilter: string = 'all';
  counts = { all: 0, approved: 0, pending: 0, rejected: 0 };

  constructor(private startupService: StartupService) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.allStartups = startups;
      this.updateCounts();
      this.applyFilter();
    });
  }

  updateCounts(): void {
    this.counts.all = this.allStartups.length;
    this.counts.approved = this.allStartups.filter(s => s.status === 'approved').length;
    this.counts.pending = this.allStartups.filter(s => s.status === 'pending').length;
    this.counts.rejected = this.allStartups.filter(s => s.status === 'rejected').length;
  }

  setFilter(filter: string): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.currentFilter === 'all') {
      this.filteredStartups = this.allStartups;
    } else {
      this.filteredStartups = this.allStartups.filter(s => s.status === this.currentFilter);
    }
  }

  onUpdateStatus(startup: Startup, index: number): void {
    // We need the absolute index in the service array
    const absoluteIndex = this.allStartups.indexOf(startup);
    this.updateStatus.emit({ startup, index: absoluteIndex });
  }
}
