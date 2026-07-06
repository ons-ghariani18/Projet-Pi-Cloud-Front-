import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService, Toast } from '../notification.service';
import { AlerteInactivite } from '../../formation/inscription.service';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.css'],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  isOpen = false;
  alertes: AlerteInactivite[] = [];
  toasts: Toast[] = [];
  unreadCount = 0;
  ringing = false;

  private alertesSub?: Subscription;
  private toastsSub?: Subscription;

  constructor(
    private notifService: NotificationService,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.alertesSub = this.notifService.alertes$.subscribe((a) => {
      const hadPrevious = this.unreadCount > 0;
      this.alertes = a;
      this.unreadCount = a.filter(x => !x.estLue).length;
      // Trigger ring animation when new notifications arrive
      if (this.unreadCount > 0 && (!hadPrevious || this.unreadCount > this.alertes.length)) {
        this.triggerRing();
      }
    });

    this.toastsSub = this.notifService.toasts$.subscribe(
      (t) => (this.toasts = t)
    );
  }

  triggerRing(): void {
    this.ringing = true;
    setTimeout(() => (this.ringing = false), 1000);
  }

  togglePanel(): void {
    this.isOpen = !this.isOpen;
  }

  marquerLue(id: number, event: Event): void {
    event.stopPropagation();
    this.notifService.marquerLue(id);
  }

  marquerToutesLues(): void {
    this.notifService.marquerToutesLues();
  }

  dismissToast(id: number): void {
    this.notifService.dismissToast(id);
  }

  getTypeLabel(type: string): string {
    if (type === 'ALERTE_1J') return '1 jour';
    if (type === 'ALERTE_7J') return '7 jours';
    return '14 jours';
  }

  getTypeSeverity(type: string): string {
    if (type === 'ALERTE_14J') return 'critical';
    if (type === 'ALERTE_7J') return 'high';
    return 'medium';
  }

  getTimeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)} j`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  ngOnDestroy(): void {
    this.alertesSub?.unsubscribe();
    this.toastsSub?.unsubscribe();
  }
}
