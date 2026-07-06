import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-checkin',
  templateUrl: './checkin.component.html',
  styleUrls: ['./checkin.component.css']
})
export class CheckinComponent implements OnInit {

  eventId: string = '';
  email: string = '';
  state: 'loading' | 'success' | 'already' | 'error' | 'idle' = 'idle';
  participantName: string = '';
  participantSkills: string = '';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.email   = this.route.snapshot.queryParamMap.get('email') || '';

    console.log('eventId:', this.eventId);
    console.log('email:', this.email);

    if (this.eventId && this.email) {
      this.doCheckin();
    } else {
      this.state = 'error';
      this.errorMessage = 'QR code invalide — informations manquantes';
    }
  }

doCheckin(): void {
  this.state = 'loading';

  // ✅ 1. Remplace l'URL par ngrok
  const url = `https://reemerge-album-dedicator.ngrok-free.dev/api/forms/event/${this.eventId}/checkin`
            + `?email=${encodeURIComponent(this.email)}`;

  console.log('Calling:', url);

  // ✅ 2. Ajoute le header ngrok obligatoire
  const headers = { 'ngrok-skip-browser-warning': 'true' };

  this.http.get<any>(url, { headers }).subscribe({
    next: (res) => {
      console.log('Response:', res);
      this.participantName   = res.name   || '';
      this.participantSkills = res.skills || '';

      if (res.alreadyChecked) {
        this.state = 'already';
      } else if (res.success) {
        this.state = 'success';
      } else {
        this.state = 'error';
        this.errorMessage = res.message || 'Erreur inconnue';
      }
    },
    error: (err) => {
      console.error('Error:', err);
      this.state = 'error';
      this.errorMessage = err.status === 404
        ? 'Participant non inscrit à cet événement'
        : 'Erreur serveur — réessayez';
    }
  });
}
}