import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestFormationService } from '../test-formation.service';
import { SoumissionTest } from '../test-formation.model';

@Component({
  selector: 'app-correction-test',
  templateUrl: './correction-test.component.html',
  styleUrls: ['./correction-test.component.css']
})
export class CorrectionTestComponent implements OnInit {
  soumissions: SoumissionTest[] = [];
  soumissionSelected: SoumissionTest | null = null;
  loading = true;
  correctionSaved = false;
  savingCorrection = false;

  constructor(
    private testService: TestFormationService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const soumissionId = this.route.snapshot.paramMap.get('soumissionId');
    if (soumissionId && soumissionId !== 'all') {
      // Directly open a specific submission (coming from the mentor dashboard scores panel)
      this.testService.getAllExamens().subscribe(exams => {
        const promises = exams.map(e => this.testService.getSoumissionsParTest(e.id!).toPromise());
        Promise.all(promises).then(results => {
          const allSoumissions = (results.flat() as SoumissionTest[]).filter(Boolean);
          const found = allSoumissions.find(s => s.id === Number(soumissionId));
          if (found) {
            this.soumissions = allSoumissions;
            this.soumissionSelected = found;
          }
          this.loading = false;
        });
      });
    } else {
      // Load all submissions from all exams
      this.testService.getAllExamens().subscribe(exams => {
        if (exams.length === 0) { this.loading = false; return; }
        const promises = exams.map(e => this.testService.getSoumissionsParTest(e.id!).toPromise());
        Promise.all(promises).then(results => {
          this.soumissions = (results.flat() as SoumissionTest[]).filter(Boolean);
          this.loading = false;
        });
      });
    }
  }

  selectionnerSoumission(soumission: SoumissionTest | null) {
    this.soumissionSelected = soumission;
    this.correctionSaved = false;
  }

  validerCorrection() {
    if (!this.soumissionSelected?.reponses) return;
    this.savingCorrection = true;
    this.testService.corrigerSoumission(this.soumissionSelected.id!, this.soumissionSelected.reponses).subscribe({
      next: () => {
        this.savingCorrection = false;
        this.correctionSaved = true;
        this.soumissionSelected!.estCorrige = true;
        // Update in list
        const idx = this.soumissions.findIndex(s => s.id === this.soumissionSelected!.id);
        if (idx >= 0) this.soumissions[idx].estCorrige = true;
      },
      error: (err) => {
        this.savingCorrection = false;
        alert('Erreur lors de la correction: ' + (err?.error || err?.message));
      }
    });
  }
}
