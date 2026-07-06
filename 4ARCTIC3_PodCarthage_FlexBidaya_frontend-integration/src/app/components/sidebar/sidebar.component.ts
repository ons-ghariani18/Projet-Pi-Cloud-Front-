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
  currentUsername: string = 'User';
  currentUserRole: string = 'Role';

  constructor(
    private startupService: StartupService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.currentUsername = this.getCurrentUsername();
    this.currentUserRole = this.getCurrentRole();
    this.startupService.startups$.subscribe(startups => {
      this.startupCount = startups.length;
    });
  }

  getCurrentUsername(): string {
    const token = localStorage.getItem('token');
    if (!token) return 'Utilisateur';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.username || 'Utilisateur';
    } catch (e) {
      return 'Utilisateur';
    }
  }

  getCurrentRole(): string {
    const rolesStr = localStorage.getItem('roles');
    if (!rolesStr) return 'Membre';
    try {
      const roles = JSON.parse(rolesStr);
      if (Array.isArray(roles) && roles.length > 0) {
        let role = roles[0];
        if (typeof role === 'object' && role.authority) {
          role = role.authority;
        }
        role = role.replace('ROLE_', '');
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
      }
      return 'Membre';
    } catch (e) {
      if (typeof rolesStr === 'string' && rolesStr.startsWith('ROLE_')) {
        const role = rolesStr.replace('ROLE_', '');
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
      }
      return rolesStr || 'Membre';
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    // Mise à jour de la variable CSS globale pour le layout
    document.documentElement.style.setProperty('--sb-width', this.isCollapsed ? '70px' : '240px');
  }

  switchView(view: string): void {
    this.currentView = view;
    if (view === 'startups' || view === 'bmc' || view === 'dashboard' || view === 'logout') {
      this.router.navigate([`/${view}`]);
    }
  }
}
