import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TestFormationService } from '../test-formation.service';
import { FormationService, Formation } from '../formation.service';
import { TypeQuestion } from '../test-formation.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-creation-test',
  templateUrl: './creation-test.component.html',
  styleUrls: ['./creation-test.component.css']
})
export class CreationTestComponent implements OnInit {
  testForm!: FormGroup;
  formations: Formation[] = [];
  isLoadingFormations = false;
  isSubmitting = false;
  msgSuccess = '';
  msgError = '';

  constructor(
    private fb: FormBuilder,
    private testFormationService: TestFormationService,
    private formationService: FormationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.testForm = this.fb.group({
      formationId: ['', Validators.required],
      heureFixeDebut: ['', Validators.required],
      dureeMinutes: [60, [Validators.required, Validators.min(5)]],
      scoreSeuil: [10, [Validators.required, Validators.min(1)]],
      questions: this.fb.array([])
    });
    this.ajouterQuestion();

    // ✅ Charger UNIQUEMENT les formations du mentor connecté (via JWT)
    this.isLoadingFormations = true;
    this.formationService.getMesFormations().subscribe({
      next: (data: Formation[]) => {
        // Filtrer seulement les formations APPROUVÉES (les autres ne peuvent pas avoir d'examens)
        this.formations = data ?? [];
        this.isLoadingFormations = false;
        if (this.formations.length > 0) {
          // Pré-sélectionner la première formation
          this.testForm.patchValue({ formationId: this.formations[0].id });
        } else {
          this.msgError = '⚠️ Aucune formation trouvée. Créez une formation d\'abord.';
        }
      },
      error: (err: any) => {
        this.isLoadingFormations = false;
        this.msgError = '❌ Impossible de charger vos formations. Vérifiez que vous êtes connecté.';
        console.error('Erreur chargement formations:', err);
      }
    });
  }

  get questions() {
    return this.testForm.get('questions') as FormArray;
  }

  ajouterQuestion() {
    this.questions.push(this.fb.group({
      type: [TypeQuestion.QCM, Validators.required],
      texte: ['', Validators.required],
      points: [1, [Validators.required, Validators.min(1)]],
      choixA: [''],
      choixB: [''],
      choixC: [''],
      choixD: [''],
      bonneReponse: ['A']
    }));
  }

  supprimerQuestion(index: number) {
    if (this.questions.length > 1) {
      this.questions.removeAt(index);
    } else {
      this.msgError = '⚠️ L\'examen doit avoir au moins une question.';
      setTimeout(() => this.msgError = '', 3000);
    }
  }

  getFormationNom(id: any): string {
    const f = this.formations.find(f => f.id == id);
    return f?.titre || 'Formation #' + id;
  }

  resetForm() {
    this.testForm.reset();
    while (this.questions.length) this.questions.removeAt(0);
    this.ajouterQuestion();
    if (this.formations.length > 0) {
      this.testForm.patchValue({
        formationId: this.formations[0].id,
        dureeMinutes: 60,
        scoreSeuil: 10
      });
    }
  }

  soumettre() {
    this.msgError = '';
    this.msgSuccess = '';

    if (this.testForm.invalid) {
      this.testForm.markAllAsTouched();
      this.msgError = '⚠️ Formulaire incomplet. Remplissez tous les champs obligatoires.';
      return;
    }

    const rawValue = this.testForm.value;
    const formationId = Number(rawValue.formationId);

    if (!formationId || formationId === 0) {
      this.msgError = '⚠️ Veuillez sélectionner une formation valide.';
      return;
    }

    const payload = {
      formationId,
      heureFixeDebut: rawValue.heureFixeDebut,
      dureeMinutes: rawValue.dureeMinutes,
      scoreSeuil: rawValue.scoreSeuil,
      questions: rawValue.questions
    };

    this.isSubmitting = true;
    this.testFormationService.creerExamen(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.msgSuccess = `✅ Examen créé avec succès pour "${this.getFormationNom(formationId)}" !`;
        this.resetForm();
        setTimeout(() => {
          this.msgSuccess = '';
          this.router.navigate(['/mentor']);
        }, 3000);
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message || err?.error || err?.statusText || 'Erreur inconnue';
        this.msgError = `❌ Erreur lors de la création : ${msg}`;
        console.error('Erreur création examen:', err);
      }
    });
  }
}
