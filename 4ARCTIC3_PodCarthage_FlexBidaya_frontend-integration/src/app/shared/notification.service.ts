import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { InscriptionService, AlerteInactivite } from '../formation/inscription.service';

export interface Toast {
  id: number;
  message: string;
  type: 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  exiting?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private _alertes$ = new BehaviorSubject<AlerteInactivite[]>([]);
  private _toasts$ = new BehaviorSubject<Toast[]>([]);
  private _toastIdCounter = 0;
  private _pollingSubscription?: Subscription;
  private _knownIds = new Set<number>();

  alertes$ = this._alertes$.asObservable();
  toasts$ = this._toasts$.asObservable();

  constructor(
    private inscriptionService: InscriptionService
  ) {
    this.startPolling();
  }

  get unreadCount(): number {
    return this._alertes$.getValue().filter(a => !a.estLue).length;
  }

  get alertes(): AlerteInactivite[] {
    return this._alertes$.getValue();
  }

  startPolling(): void {
    // Poll every 30 seconds
    this._pollingSubscription = interval(30000)
      .pipe(
        startWith(0),
        switchMap(() => {
          const id = Number(localStorage.getItem('userId'));
          return this.inscriptionService.getMesAlertes(id);
        })
      )
      .subscribe({
        next: (alertes) => {
          const unread = alertes.filter(a => !a.estLue);
          this._alertes$.next(unread);

          // Show toast for new alerts
          unread.forEach(alerte => {
            if (!this._knownIds.has(alerte.id)) {
              this._knownIds.add(alerte.id);
              this.showToast(alerte);
            }
          });
        },
        error: () => { /* ignore network errors during polling */ }
      });
  }

  private showToast(alerte: AlerteInactivite): void {
    const id = ++this._toastIdCounter;
    const toast: Toast = {
      id,
      title: '⏰ Rappel de formation',
      message: this.getAlertMessage(alerte),
      type: alerte.type === 'ALERTE_14J' ? 'warning' : 'info',
      icon: alerte.type === 'ALERTE_14J' ? '🚨' : '⚠️',
    };

    const current = this._toasts$.getValue();
    this._toasts$.next([...current, toast]);

    // Auto-dismiss after 6 seconds
    setTimeout(() => this.dismissToast(id), 6000);
  }

  dismissToast(id: number): void {
    // Mark as exiting first for animation
    const current = this._toasts$.getValue().map(t =>
      t.id === id ? { ...t, exiting: true } : t
    );
    this._toasts$.next(current);

    // Remove after animation
    setTimeout(() => {
      this._toasts$.next(this._toasts$.getValue().filter(t => t.id !== id));
    }, 400);
  }

  marquerLue(alerteId: number): void {
    this.inscriptionService.marquerLue(alerteId).subscribe(() => {
      const updated = this._alertes$.getValue().filter(a => a.id !== alerteId);
      this._alertes$.next(updated);
    });
  }

  marquerToutesLues(): void {
    const alertes = this._alertes$.getValue();
    alertes.forEach(a => {
      this.inscriptionService.marquerLue(a.id).subscribe();
    });
    this._alertes$.next([]);
  }

  getAlertMessage(alerte: AlerteInactivite): string {
    const titre = alerte.inscription?.formation?.titre ?? 'votre formation';
    if (alerte.type === 'ALERTE_1J') return `Reprenez "${titre}" – inactif depuis 1 jour.`;
    if (alerte.type === 'ALERTE_7J') return `Reprenez "${titre}" – inactif depuis 7 jours !`;
    return `Urgent ! Reprenez "${titre}" – inactif depuis 14 jours !`;
  }

  ngOnDestroy(): void {
    this._pollingSubscription?.unsubscribe();
  }
}
