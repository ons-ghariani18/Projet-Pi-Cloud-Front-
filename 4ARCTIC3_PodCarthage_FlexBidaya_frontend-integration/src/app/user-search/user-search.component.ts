import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { FriendshipService } from '../services/friendship.service';
import { UserSearchResult, UserSearchService } from '../services/user-search.service';

@Component({
  selector: 'app-user-search',
  templateUrl: './user-search.component.html',
  styleUrls: ['./user-search.component.css']
})
export class UserSearchComponent {
  query = '';
  loading = false;
  error = '';
  results: UserSearchResult[] = [];
  sentToUserId = new Set<number>();

  private query$ = new Subject<string>();

  constructor(
    private userSearch: UserSearchService,
    private friendships: FriendshipService,
    private router: Router
  ) {
    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          this.loading = true;
          this.error = '';
          if (!q.trim()) {
            this.results = [];
            this.loading = false;
            return of<UserSearchResult[]>([]);
          }
          return this.userSearch.search(q.trim());
        })
      )
      .subscribe({
        next: (users: UserSearchResult[]) => {
          this.results = users || [];
          this.loading = false;
        },
        error: (e) => {
          this.error = 'Error during search';
          this.loading = false;
          console.error(e);
        }
      });
  }

  onQueryChange(): void {
    this.query$.next(this.query);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  sendInvite(userId: number): void {
    this.error = '';
    this.friendships.sendFriendRequest(userId).subscribe({
      next: () => {
        this.sentToUserId.add(userId);
      },
      error: (e) => {
        this.error = typeof e?.error === 'string' ? e.error : 'Error sending invitation';
      }
    });
  }

  avatarLetter(username?: string): string {
    if (!username) return 'U';
    return username.charAt(0).toUpperCase();
  }
}

