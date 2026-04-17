import { Component, OnInit } from '@angular/core';
import { StartupService } from '../../services/startup.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  currentView: string = 'startups';
  startupCount: number = 0;
  isCollapsed: boolean = false;

  constructor(
    private startupService: StartupService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.startupService.startups$.subscribe(startups => {
      this.startupCount = startups.length;
    });
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    // Mise à jour de la variable CSS globale pour le layout
    document.documentElement.style.setProperty('--sb-width', this.isCollapsed ? '80px' : '240px');
  }

  switchView(view: string): void {
    this.currentView = view;
    if (view === 'startups' || view === 'bmc') {
      this.router.navigate([`/${view}`]);
    }
  }
}
