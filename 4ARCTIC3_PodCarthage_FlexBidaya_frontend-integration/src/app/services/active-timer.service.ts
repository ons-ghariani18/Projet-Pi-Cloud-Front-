import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, fromEvent, merge } from 'rxjs';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ActiveTimerService implements OnDestroy {
  private seconds = 0;
  private isActive = true;
  private interval: any;
  private inactivityTimeout: any;
  private readonly INACTIVITY_LIMIT = 30_000; // 30s

  time$ = new BehaviorSubject<string>('00:00:00');
  active$ = new BehaviorSubject<boolean>(true);

  constructor(private router: Router) {
    this.startInterval();
    this.bindActivityEvents();
    this.bindVisibilityEvents();
    this.bindRouterEvents();
  }

  private format(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
  }

  private startInterval() {
    this.interval = setInterval(() => {
      if (this.isActive) {
        this.seconds++;
        this.time$.next(this.format(this.seconds));
      }
    }, 1000);
  }

  private setActive(active: boolean) {
    this.isActive = active;
    this.active$.next(active);
  }

  private resetInactivity() {
    if (!this.isActive) this.setActive(true);
    clearTimeout(this.inactivityTimeout);
    this.inactivityTimeout = setTimeout(
      () => this.setActive(false), this.INACTIVITY_LIMIT
    );
  }

  private bindActivityEvents() {
    const events = ['mousemove','mousedown','keydown','scroll','touchstart','click'];
    merge(...events.map(e => fromEvent(document, e)))
      .subscribe(() => this.resetInactivity());
    this.resetInactivity();
  }

  private bindVisibilityEvents() {
    fromEvent(document, 'visibilitychange').subscribe(() => {
      document.hidden ? this.setActive(false) : this.resetInactivity();
    });
    fromEvent(window, 'blur').subscribe(() => this.setActive(false));
    fromEvent(window, 'focus').subscribe(() => this.resetInactivity());
  }

  private bindRouterEvents() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationStart))
      .subscribe(() => this.setActive(false));
  }

  ngOnDestroy() {
    clearInterval(this.interval);
    clearTimeout(this.inactivityTimeout);
  }
}