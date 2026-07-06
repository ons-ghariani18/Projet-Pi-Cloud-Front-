import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'FlexBidaya';
  showNav = true;
  showBell = false;

  constructor(private router: Router) {
    this.updateNav(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateNav(e.urlAfterRedirects));
  }

  private updateNav(url: string): void {
    this.showNav = !url.startsWith('/certificat/');
    // Show notification bell only on the entrepreneur dashboard
    this.showBell = url.startsWith('/mes-formations');
  }
}