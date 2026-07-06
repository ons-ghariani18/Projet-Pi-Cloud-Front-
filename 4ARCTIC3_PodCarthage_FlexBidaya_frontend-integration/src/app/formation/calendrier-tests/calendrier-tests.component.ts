import { Component, OnInit } from '@angular/core';
import { TestFormationService } from '../test-formation.service';
import { TestFormation, SoumissionTest } from '../test-formation.model';

@Component({
  selector: 'app-calendrier-tests',
  templateUrl: './calendrier-tests.component.html',
  styleUrls: ['./calendrier-tests.component.css']
})
export class CalendrierTestsComponent implements OnInit {
  tests: TestFormation[] = [];
  soumissionsMap: { [testId: number]: SoumissionTest } = {};

  constructor(
    private testService: TestFormationService
  ) {}

  ngOnInit(): void {
    const entrepreneurId = Number(localStorage.getItem('userId'));

    this.testService.getAllExamens().subscribe(res => {
      let fetchedTests = res.sort((a,b) => new Date(a.heureFixeDebut).getTime() - new Date(b.heureFixeDebut).getTime());
      
      if (entrepreneurId) {
        this.testService.getMesSoumissions(entrepreneurId).subscribe(soumissions => {
          soumissions.forEach(s => {
            if (s.testFormation && s.testFormation.id) {
              this.soumissionsMap[s.testFormation.id] = s;
            }
          });
          // Ne conserver que les examens déjà passés (soumis)
          this.tests = fetchedTests.filter(t => t.id && this.soumissionsMap[t.id]);
        });
      } else {
        this.tests = [];
      }
    });
  }
}
