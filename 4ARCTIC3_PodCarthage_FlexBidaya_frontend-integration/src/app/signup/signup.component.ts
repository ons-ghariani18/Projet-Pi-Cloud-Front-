import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../services/user.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { getDashboardRouteForRoles, normalizeRoles } from '../shared/role-dashboard.util';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  standalone: true,
  imports: [FormsModule, CommonModule]
})
export class SignupComponent implements OnInit {

  warRoomToken: string | null = null;

  signupData = {
    username: '',
    email: '',
    password: '',
    roles: [] as string[],
    startupDescription: '',
    domaine: '',
    organisation: ''
  };

  usernameError: string = '';
  emailError: string = '';
  passwordError: string = '';
  roleError: string = '';
  successMessage: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;
  passwordStrength: number = 0;
  passwordStrengthLabel: string = '';
  passwordStrengthColor: string = '';

  constructor(
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.warRoomToken = this.route.snapshot.queryParamMap.get('warRoomToken');
  }

  goToSignin(): void {
    const extras = this.warRoomToken
      ? { queryParams: { warRoomToken: this.warRoomToken } }
      : {};
    this.router.navigate(['/signin'], extras);
  }

  hasRole(role: string): boolean {
    return this.signupData.roles.includes(role);
  }

  toggleRole(role: string): void {
    const idx = this.signupData.roles.indexOf(role);
    if (idx > -1) this.signupData.roles.splice(idx, 1);
    else this.signupData.roles.push(role);
  }

  selectRole(role: string): void {
    if (!this.hasRole(role)) this.signupData.roles.push(role);
  }

  checkPasswordStrength(): void {
    const p = this.signupData.password;
    let score = 0;

    if (p.length >= 8) score += 25;
    if (/[A-Z]/.test(p)) score += 25;
    if (/[0-9]/.test(p)) score += 25;
    if (/[^A-Za-z0-9]/.test(p)) score += 25;

    this.passwordStrength = score;

    if (score <= 25) {
      this.passwordStrengthLabel = 'Faible';
      this.passwordStrengthColor = '#ef4444';
    } else if (score <= 50) {
      this.passwordStrengthLabel = 'Moyen';
      this.passwordStrengthColor = '#f59e0b';
    } else if (score <= 75) {
      this.passwordStrengthLabel = 'Bien';
      this.passwordStrengthColor = '#3b82f6';
    } else {
      this.passwordStrengthLabel = 'Fort';
      this.passwordStrengthColor = '#10b981';
    }
  }

  validate(): boolean {
    let valid = true;

    this.usernameError = '';
    this.emailError = '';
    this.passwordError = '';
    this.roleError = '';

    if (!this.signupData.username?.trim()) {
      this.usernameError = "Le nom d'utilisateur est requis.";
      valid = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.signupData.email)) {
      this.emailError = "Adresse email invalide.";
      valid = false;
    }

    if (this.signupData.password.length < 8) {
      this.passwordError = "Minimum 8 caractères.";
      valid = false;
    }

    if (this.signupData.roles.length === 0) {
      this.roleError = "Sélectionnez au moins un rôle.";
      valid = false;
    }

    return valid;
  }

  register(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.validate()) return;

    const payload = {
      username: this.signupData.username.trim(),
      email: this.signupData.email.trim(),
      password: this.signupData.password,
      roles: this.signupData.roles,
      startupDescription: this.signupData.startupDescription || null,
      domaine: this.signupData.domaine || null,
      organisation: this.signupData.organisation || null
    };

    this.userService.register(payload).subscribe({
      next: () => this.onRegisterSuccess(),
      error: (err) => {

        if (err.status === 200) {
          this.onRegisterSuccess();
          return;
        }

        const msg = typeof err.error === 'string'
          ? err.error
          : (err.error?.message || err.error?.text || err.message || '');

        if (msg.toLowerCase().includes('username')) {
          this.usernameError = "Nom d'utilisateur déjà utilisé.";
        } else if (msg.toLowerCase().includes('email')) {
          this.emailError = "Email déjà utilisé.";
        } else {
          this.errorMessage = "Une erreur est survenue : " + msg;
        }
      }
    });
  }

  private onRegisterSuccess(): void {
    this.successMessage = '🎉 Compte créé ! Connexion en cours...';

    this.userService.login(
      this.signupData.username.trim(),
      this.signupData.password
    ).subscribe({
      next: (response: any) => {
        localStorage.setItem('token',    response.jwt);
        localStorage.setItem('userId',   response.id.toString());
        localStorage.setItem('username', response.username || '');
        localStorage.setItem('roles',    JSON.stringify(response.roles || []));

        const roles = normalizeRoles(response.roles);
        const destination = getDashboardRouteForRoles(roles);

        setTimeout(() => {
          if (this.warRoomToken && roles.includes('ROLE_USER')) {
            localStorage.setItem('pendingWarRoomToken', this.warRoomToken);
            this.router.navigate(['/dashuser'], {
              queryParams: { warRoomToken: this.warRoomToken }
            });
          } else {
            this.router.navigate([destination]);
          }
        }, 1500);
      },
      error: () => {
        setTimeout(() => this.goToSignin(), 1500);
      }
    });
  }
}
