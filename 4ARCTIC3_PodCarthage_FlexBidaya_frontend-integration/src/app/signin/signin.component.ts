import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../services/user.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { getDashboardRouteForRoles, normalizeRoles } from '../shared/role-dashboard.util';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.css'],
  standalone: true,
  imports: [FormsModule, CommonModule]
})
export class SigninComponent implements OnInit {

  username = '';
  password = '';
  loginError: string | boolean = '';
  usernameError = false;
  passwordError = false;
  warRoomToken: string | null = null;

  constructor(
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.warRoomToken = this.route.snapshot.queryParamMap.get('warRoomToken');
  }

  goToSignup(): void {
    const extras = this.warRoomToken
      ? { queryParams: { warRoomToken: this.warRoomToken } }
      : {};
    this.router.navigate(['/signup'], extras);
  }

  login(): void {
    this.usernameError = !this.username || this.username.trim() === '';
    this.passwordError = !this.password || this.password.trim() === '';
    this.loginError = '';

    if (this.usernameError || this.passwordError) return;

    this.userService.login(this.username, this.password).subscribe(
      (response: { id: number; jwt: string; roles: string[]; username: string }) => {
        localStorage.setItem('token',    response.jwt);
        localStorage.setItem('userId',   String(response.id));
        localStorage.setItem('username', response.username);
        localStorage.setItem('roles',    JSON.stringify(response.roles || []));

        const roles = normalizeRoles(response.roles);
        const destination = getDashboardRouteForRoles(roles);

        if (this.warRoomToken && roles.includes('ROLE_USER')) {
          // Only regular users get the warRoomToken flow
          localStorage.setItem('pendingWarRoomToken', this.warRoomToken);
          this.router.navigate(['/dashuser'], {
            queryParams: { warRoomToken: this.warRoomToken }
          });
        } else {
          this.router.navigate([destination]);
        }
      },
      (error) => {
        if (error.status === 403 && error.error?.message) {
          this.loginError = error.error.message;
        } else {
          this.loginError = 'Invalid credentials. Please try again.';
        }
      }
    );
  }
}
