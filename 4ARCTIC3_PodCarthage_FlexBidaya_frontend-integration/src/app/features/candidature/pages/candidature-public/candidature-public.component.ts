import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CandidatureService } from '../../services/candidature.service';

@Component({
  selector: 'app-candidate-public',
  templateUrl: './candidature-public.component.html',
  styleUrls: ['./candidature-public.component.css']
})
export class CandidatePublicComponent implements OnInit {
  candidatureForm!: FormGroup;
  opportuniteId = 0;
  userId = 0;

  selectedCvFile: File | null = null;
  selectedMotivationFile: File | null = null;
  selectedPortfolioFile: File | null = null;

  cvFileName = '';
  motivationFileName = '';
  portfolioFileName = '';

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  alreadyApplied = false;
  username = 'Candidat';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private candidatureService: CandidatureService
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('token')) {
      this.router.navigate(['/signin']);
      return;
    }

    this.username = localStorage.getItem('username') || 'Candidat';
    this.userId = this.getCurrentUserId();
    this.initForm();

    this.route.queryParams.subscribe(params => {
      this.opportuniteId = Number(params['opportuniteId']);
      this.alreadyApplied = false;
      this.errorMessage = '';

      if (!this.opportuniteId || isNaN(this.opportuniteId)) {
        this.errorMessage = 'Opportunite invalide ou manquante.';
        return;
      }

      if (!this.userId) {
        this.router.navigate(['/signin']);
        return;
      }

      this.checkIfAlreadyApplied();
    });
  }

  getCurrentUserId(): number {
    const userId = localStorage.getItem('userId');
    return userId ? Number(userId) : 0;
  }

  initForm(): void {
    this.candidatureForm = this.fb.group({
      motivation: ['', [Validators.required, Validators.minLength(10)]],
      lettreMotivation: [''],
      portfolio: ['']
    });
  }

  checkIfAlreadyApplied(): void {
    this.candidatureService.hasUserApplied(this.userId, this.opportuniteId).subscribe({
      next: (result: boolean) => {
        this.alreadyApplied = result;
      },
      error: (err: any) => {
        console.error('Erreur verification:', err);
      }
    });
  }

  onFileSelected(event: Event, type: 'cv' | 'motivation' | 'portfolio'): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    switch (type) {
      case 'cv':
        this.selectedCvFile = file;
        this.cvFileName = file.name;
        break;
      case 'motivation':
        this.selectedMotivationFile = file;
        this.motivationFileName = file.name;
        break;
      case 'portfolio':
        this.selectedPortfolioFile = file;
        this.portfolioFileName = file.name;
        break;
    }
  }

  removeFile(type: 'cv' | 'motivation' | 'portfolio'): void {
    switch (type) {
      case 'cv':
        this.selectedCvFile = null;
        this.cvFileName = '';
        break;
      case 'motivation':
        this.selectedMotivationFile = null;
        this.motivationFileName = '';
        break;
      case 'portfolio':
        this.selectedPortfolioFile = null;
        this.portfolioFileName = '';
        break;
    }
  }

  onSubmit(): void {
    if (this.candidatureForm.invalid) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      this.candidatureForm.markAllAsTouched();
      return;
    }

    if (this.alreadyApplied) {
      this.errorMessage = 'Vous ne pouvez pas postuler deux fois.';
      return;
    }

    if (!this.opportuniteId || isNaN(this.opportuniteId)) {
      this.errorMessage = 'Opportunite invalide.';
      return;
    }

    if (!this.userId) {
      this.router.navigate(['/signin']);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request = {
      motivation: this.candidatureForm.value.motivation,
      lettreMotivation: this.candidatureForm.value.lettreMotivation,
      portfolio: this.candidatureForm.value.portfolio,
      opportuniteId: this.opportuniteId,
      userId: this.userId
    };

    this.candidatureService.postuler(request).subscribe({
      next: (candidature: any) => this.uploadFiles(candidature.id),
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Erreur lors de la candidature.';
      }
    });
  }

  private async uploadFiles(candidatureId: number): Promise<void> {
    const uploads: Promise<any>[] = [];

    if (this.selectedCvFile) {
      uploads.push(firstValueFrom(this.candidatureService.uploadCv(candidatureId, this.selectedCvFile)));
    }
    if (this.selectedMotivationFile) {
      uploads.push(firstValueFrom(this.candidatureService.uploadMotivation(candidatureId, this.selectedMotivationFile)));
    }
    if (this.selectedPortfolioFile) {
      uploads.push(firstValueFrom(this.candidatureService.uploadPortfolio(candidatureId, this.selectedPortfolioFile)));
    }

    try {
      await Promise.all(uploads);
      this.successMessage = 'Candidature envoyee avec succes !';
    } catch {
      this.successMessage = 'Candidature creee avec succes, mais un fichier n a pas pu etre envoye.';
    } finally {
      this.isLoading = false;
      setTimeout(() => this.router.navigate(['/mes-candidatures']), 2000);
    }
  }

  retour(): void {
    if (this.opportuniteId) {
      this.router.navigate(['/opportunite', this.opportuniteId]);
    } else {
      this.router.navigate(['/client/opportunites']);
    }
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/signin']);
  }
}
