import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.css']
})
export class UnauthorizedComponent {
  currentRole: string = '';

  constructor(private router: Router) {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const roles: string[] = payload.roles || [];
        if (roles.includes('ROLE_ADMIN')) this.currentRole = 'Administrateur';
        else if (roles.includes('ROLE_ORGANISATEUR')) this.currentRole = 'Organisateur';
        else this.currentRole = 'Participant';
      } catch { this.currentRole = 'Inconnu'; }
    }
  }

  goToDashboard(): void {
    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/signin']); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = payload.roles || [];
      if (roles.includes('ROLE_ADMIN')) this.router.navigate(['/dashadmin']);
      else if (roles.includes('ROLE_ORGANISATEUR')) this.router.navigate(['/dashorg']);
      else this.router.navigate(['/dashuser']);
    } catch {
      this.router.navigate(['/signin']);
    }
  }
}