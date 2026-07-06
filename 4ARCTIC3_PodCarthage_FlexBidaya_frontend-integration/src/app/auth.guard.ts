import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const token = localStorage.getItem('token');

    if (!token) {
      this.router.navigate(['/signin']);
      return false;
    }

    let roles: string[] = [];
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      roles = payload.roles || [];
    } catch {
      this.router.navigate(['/signin']);
      return false;
    }

    const requiredRoles: string[] = route.data['roles'] || [];
    if (requiredRoles.length === 0) return true;

    const hasRole = requiredRoles.some(r => roles.includes(r));
    if (!hasRole) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  }
}