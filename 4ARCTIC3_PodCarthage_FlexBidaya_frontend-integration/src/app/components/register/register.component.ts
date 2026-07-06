import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  selectedRole: string = '';
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      tel: [''],
      role: ['', Validators.required],
      startupDescription: [''],
      domaine: [''],
      organisation: ['']
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  onRoleChange(event: any): void {
    this.selectedRole = event.target.value;
    // Reset validators for specific fields
    if (this.selectedRole !== 'entrepreneur') {
      this.registerForm.get('startupDescription')?.clearValidators();
    } else {
      this.registerForm.get('startupDescription')?.setValidators(Validators.required);
    }
    if (this.selectedRole !== 'expert') {
      this.registerForm.get('domaine')?.clearValidators();
    } else {
      this.registerForm.get('domaine')?.setValidators(Validators.required);
    }
    if (this.selectedRole !== 'organisateur') {
      this.registerForm.get('organisation')?.clearValidators();
    } else {
      this.registerForm.get('organisation')?.setValidators(Validators.required);
    }
    // update validity
    this.registerForm.get('startupDescription')?.updateValueAndValidity();
    this.registerForm.get('domaine')?.updateValueAndValidity();
    this.registerForm.get('organisation')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    // Build payload to match backend DTO (SignupRequest)
    const payload: any = {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      tel: this.registerForm.value.tel,
      roles: [this.registerForm.value.role]  
      
      
      // send as array, as expected by backend
    };

    // Add role-specific fields only if they exist
    if (this.registerForm.value.role === 'entrepreneur') {
      payload.startupDescription = this.registerForm.value.startupDescription;
    } else if (this.registerForm.value.role === 'expert') {
      payload.domaine = this.registerForm.value.domaine;
    } else if (this.registerForm.value.role === 'organisateur') {
      payload.organisation = this.registerForm.value.organisation;
    }

    this.authService.signup(payload).subscribe({
      next: () => {
        // Optionnel: On pourrait connecter l'utilisateur automatiquement ici
        // Mais pour l'instant on garde le comportement actuel de redirection

        if (this.registerForm.value.role === 'entrepreneur') {
          this.successMessage = 'Registration successful! Preparing your startup space...';
          setTimeout(() => this.router.navigate(['/login']), 1500);
        } else {
          this.successMessage = 'Registration successful! You can now log in.';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        }
      },
      error: (err) => {
        // Improved error handling: backend may return plain string or object with message
        if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else if (err.error && err.error.message) {
          this.errorMessage = err.error.message;
        } else {
             this.errorMessage = `Error during registration`;

        }
        // Clear success message if any
        this.successMessage = '';
      }
    });
  }
}