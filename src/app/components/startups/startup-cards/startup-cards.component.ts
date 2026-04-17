import { Component, OnInit } from '@angular/core';
import { StartupService } from '../../../services/startup.service';
import { Startup } from '../../../models/startup';

@Component({
  selector: 'app-startup-cards',
  templateUrl: './startup-cards.component.html',
  styleUrls: ['./startup-cards.component.css']
})
export class StartupCardsComponent implements OnInit {
  recentStartups: Startup[] = [];
  banners: string[] = ['purple', 'teal', 'indigo', 'purple'];

  constructor(private startupService: StartupService) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.recentStartups = startups.slice(-3).reverse();
    });
  }
}
