import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-passage-test-success',
  template: `
    <div style="margin: 80px auto; max-width: 600px; text-align: center; background: white; border-radius: 24px; padding: 50px; box-shadow: 0 20px 60px rgba(0,0,0,0.12); border: 1px solid #e2e8f0; font-family: 'Outfit', sans-serif;">
      <div style="font-size: 80px; margin-bottom: 20px;">✅</div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 800; margin-bottom: 12px;">Payment Confirmed!</h1>
      <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">
        Your exam access has been activated. Check your email for the exam link and scheduled date.
      </p>
      <p style="color: #94a3b8; font-size: 13px; margin-bottom: 20px;">Redirecting automatically in 5 seconds...</p>
      <button (click)="continuer()"
        style="padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer; border: none; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; font-family: inherit;">
        ← Back to My Courses
      </button>
    </div>
  `
})
export class PassageTestSuccessComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit(): void {
    setTimeout(() => this.continuer(), 5000);
  }
  continuer() { this.router.navigate(['/mes-formations']); }
}
