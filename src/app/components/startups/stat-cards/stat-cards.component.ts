import { Component, OnInit } from '@angular/core';
import { StartupService } from '../../../services/startup.service';

@Component({
  selector: 'app-stat-cards',
  templateUrl: './stat-cards.component.html',
  styleUrls: ['./stat-cards.component.css']
})
export class StatCardsComponent implements OnInit {
  totalStartups: number = 0;
  pendingStartups: number = 0;

  constructor(private startupService: StartupService) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.totalStartups = startups.length;
      this.pendingStartups = startups.filter(s => s.status === 'pending').length;
    });
  }
}
