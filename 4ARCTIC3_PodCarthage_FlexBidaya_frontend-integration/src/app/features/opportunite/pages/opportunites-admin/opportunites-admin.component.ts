import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-opportunites-admin',
  templateUrl: './opportunites-admin.component.html',
  styleUrls: ['./opportunites-admin.component.css']
})
export class OpportunitesAdminComponent implements OnInit {
  opportunites: any[] = [];
  selectedId: number | null = null;
  message = '';
  error = '';
  totalOpportunites = 0;
  ouvertesCount = 0;
  totalCandidatures = 0;
  selectedImageFile: File | null = null;
  showForm = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;

  get totalPages(): number {
    return Math.ceil(this.opportunites.length / this.itemsPerPage);
  }

  get paginatedOpportunites(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.opportunites.slice(start, start + this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  types = ['CONCOURS', 'FINANCEMENT', 'PARTENARIAT', 'EVENEMENT'];
  secteurs = ['TECH', 'SANTE', 'AGRICULTURE', 'EDUCATION', 'TOURISME', 'AUTRE'];

  form = this.fb.group({
    titre: ['', Validators.required],
    description: [''],
    type: ['CONCOURS', Validators.required],
    secteur: ['TECH', Validators.required],
    dateLimite: ['', Validators.required],
    lienExterne: [''],
    nombrePlaces: [1, Validators.min(1)]
  });

  get today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.http.get('http://localhost:8080/api/opportunites').subscribe({
      next: (data: any) => {
        this.opportunites = data.content;
        this.totalOpportunites = data.totalElements;
        this.ouvertesCount = data.content.filter((o: any) => o.statut === 'OUVERTE').length;
        this.loadCandidaturesCount();
      },
      error: () => this.error = 'Erreur de chargement'
    });
  }

  loadCandidaturesCount(): void {
    this.http.get('http://localhost:8080/api/candidatures').subscribe({
      next: (data: any) => {
        this.totalCandidatures = data.totalElements;
      },
      error: () => {}
    });
  }

  edit(opp: any): void {
    this.selectedId = opp.id;
    this.form.patchValue({
      titre: opp.titre,
      description: opp.description || '',
      type: opp.type,
      secteur: opp.secteur,
      dateLimite: opp.dateLimite,
      lienExterne: opp.lienExterne || '',
      nombrePlaces: opp.nombrePlaces || 1
    });
  }

  reset(): void {
    this.selectedId = null;
    this.message = '';
    this.error = '';
    this.form.reset({
      titre: '',
      description: '',
      type: 'CONCOURS',
      secteur: 'TECH',
      dateLimite: '',
      lienExterne: '',
      nombrePlaces: 1
    });
    this.selectedImageFile = null;
    const fileInput = document.getElementById('imageInput') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  }

  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.selectedImageFile = null;
      this.error = 'Image non supportee. Formats acceptes : JPG, PNG, WEBP, GIF.';
      event.target.value = '';
      setTimeout(() => this.error = '', 4000);
      return;
    }

    this.error = '';
    this.selectedImageFile = file;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.value;

    const req$ = this.selectedId
      ? this.http.put(`http://localhost:8080/api/opportunites/${this.selectedId}`, payload)
      : this.http.post('http://localhost:8080/api/opportunites', payload);

    req$.subscribe({
      next: (res: any) => {
        const oppId = this.selectedId ? this.selectedId : res.id;
        if (this.selectedImageFile && oppId) {
          const formData = new FormData();
          formData.append('file', this.selectedImageFile);
          this.http.post(`http://localhost:8080/api/opportunites/${oppId}/upload-image`, formData)
            .subscribe({
              next: () => {
                this.message = this.selectedId ? 'Opportunité modifiée avec succès' : 'Opportunité créée avec succès';
                this.reset();
                this.loadData();
                setTimeout(() => this.message = '', 3000);
              },
              error: (uploadErr) => {
                this.message = this.selectedId
                  ? 'Opportunite modifiee avec succes, mais l image n a pas ete envoyee.'
                  : 'Opportunite creee avec succes, mais l image n a pas ete envoyee.';
                this.error = uploadErr?.error?.message || 'Erreur lors du telechargement de l image';
                this.reset();
                this.loadData();
                setTimeout(() => {
                  this.message = '';
                  this.error = '';
                }, 5000);
              }
            });
        } else {
          this.message = this.selectedId ? 'Opportunité modifiée avec succès' : 'Opportunité créée avec succès';
          this.reset();
          this.loadData();
          setTimeout(() => this.message = '', 3000);
        }
      },
      error: (err) => {
        console.error('Erreur:', err);
        this.error = 'Erreur lors de l\'enregistrement';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  changerStatut(id: number, statut: string): void {
    this.http.put(`http://localhost:8080/api/opportunites/${id}/statut?statut=${statut}`, {}).subscribe({
      next: () => this.loadData(),
      error: () => {
        this.error = 'Erreur lors du changement de statut';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  supprimer(id: number): void {
    if (!confirm('Supprimer cette opportunité ?')) return;
    this.http.delete(`http://localhost:8080/api/opportunites/${id}`).subscribe({
      next: () => this.loadData(),
      error: () => {
        this.error = 'Erreur lors de la suppression';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  voirCandidatures(opportuniteId: number): void {
    this.router.navigate(['/admin/candidatures'], { queryParams: { opportuniteId: opportuniteId } });
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/signin']);
  }
}
