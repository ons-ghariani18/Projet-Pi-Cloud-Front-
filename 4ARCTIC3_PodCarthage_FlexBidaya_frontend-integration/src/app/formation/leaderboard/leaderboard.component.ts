import { Component, OnInit } from '@angular/core';
import { LeaderboardService, LeaderboardEntry } from '../leaderboard.service';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css'],
})
export class LeaderboardComponent implements OnInit {
  classement: LeaderboardEntry[] = [];
  loading = true;
  error = false;

  /** Username de l'utilisateur connecté (pour mise en surbrillance) */
  myUsername: string = '';

  constructor(private leaderboardService: LeaderboardService) {}

  ngOnInit(): void {
    // Récupérer le username depuis le localStorage (pattern du projet)
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.myUsername = parsed.username || parsed.sub || '';
      }
    } catch {}

    this.leaderboardService.getClassement().subscribe({
      next: (data) => {
        this.classement = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  get top3(): LeaderboardEntry[] {
    return this.classement.slice(0, 3);
  }

  get reste(): LeaderboardEntry[] {
    return this.classement.slice(3);
  }

  podiumClass(rang: number): string {
    if (rang === 1) return 'podium-first';
    if (rang === 2) return 'podium-second';
    return 'podium-third';
  }

  podiumEmoji(rang: number): string {
    if (rang === 1) return '🥇';
    if (rang === 2) return '🥈';
    return '🥉';
  }

  isMe(username: string): boolean {
    return this.myUsername !== '' && username === this.myUsername;
  }

  /** Initiales pour l'avatar */
  initiales(username: string): string {
    return username ? username.substring(0, 2).toUpperCase() : '?';
  }

  /** Couleur HSL stable par username (même couleur à chaque rechargement) */
  avatarColor(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 48%)`;
  }
}
