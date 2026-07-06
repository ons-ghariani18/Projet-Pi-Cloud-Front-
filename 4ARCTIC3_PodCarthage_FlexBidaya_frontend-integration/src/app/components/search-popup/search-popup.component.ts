import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { FriendshipService, UserSummary } from '../../services/friendship.service';
import { UserSearchResult, UserSearchService } from '../../services/user-search.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-popup',
  templateUrl: './search-popup.component.html',
  styleUrls: ['./search-popup.component.css']
})
export class SearchPopupComponent {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<number>();

  query = '';
  loading = false;
  error = '';
  results: UserSearchResult[] = [];
  sentToUserId = new Set<number>();
  friendIds = new Set<number>();
  currentUser: any = null;

  private query$ = new Subject<string>();

  constructor(
    private userSearch: UserSearchService,
    private friendships: FriendshipService,
    private router: Router
  ) {
    this.setupSearchSubscription();
    this.loadCurrentUser();
    this.loadFriends();
  }

  private loadFriends(): void {
    this.friendships.getFriends().subscribe({
      next: (friends: UserSummary[]) => {
        this.friendIds = new Set(friends.map(f => f.id));
      },
      error: (err) => console.error('Error loading friends:', err)
    });
  }

  private setupSearchSubscription(): void {
    this.query$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.loading = true;
          this.error = '';
          
          if (!q.trim() || q.length < 2) {
            this.results = [];
            this.loading = false;
            return of<UserSearchResult[]>([]);
          }
          
          return this.userSearch.search(q.trim());
        })
      )
      .subscribe({
        next: (users: UserSearchResult[]) => {
          // Filtrage plus robuste pour exclure les administrateurs
          this.results = (users || []).filter(user => {
            const role = user.role?.toUpperCase() || '';
            const username = user.username?.toLowerCase() || '';
            
            // Exclure si le rôle est ADMIN ou ROLE_ADMIN, ou si le nom d'utilisateur est 'admin'
            return role !== 'ADMIN' && role !== 'ROLE_ADMIN' && username !== 'admin';
          });
          this.loading = false;
        },
        error: (e) => {
          this.error = 'Error during search';
          this.loading = false;
          console.error('Search error:', e);
        }
      });
  }

  private loadCurrentUser(): void {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        this.currentUser = JSON.parse(userData);
      } catch (e) {
        console.error('Error parsing current user:', e);
      }
    }
  }

  onQueryChange(): void {
    this.query$.next(this.query);
  }

  closePopup(): void {
    this.isOpen = false;
    this.close.emit();
    this.resetSearch();
  }

  private resetSearch(): void {
    this.query = '';
    this.results = [];
    this.error = '';
    this.loading = false;
  }

  sendInvite(userId: number): void {
    if (this.sentToUserId.has(userId)) return;

    this.error = '';
    this.friendships.sendFriendRequest(userId).subscribe({
      next: () => {
        this.sentToUserId.add(userId);
      },
      error: (e) => {
        this.error = typeof e?.error === 'string' ? e.error : 'Error while sending invitation';
        console.error('Invite error:', e);
      }
    });
  }

  viewProfile(userId: number): void {
    this.router.navigate(['/profile'], { queryParams: { id: userId } });
    this.closePopup();
  }

  isFriend(userId: number): boolean {
    return this.friendIds.has(userId);
  }

  removeFriend(userId: number): void {
    if (confirm('Are you sure you want to remove this friend?')) {
      this.friendships.removeFriend(userId).subscribe({
        next: () => {
          this.friendIds.delete(userId);
        },
        error: (err) => {
          this.error = 'Error while removing friend';
          console.error(err);
        }
      });
    }
  }

  goToChat(userId: number): void {
    // Émettre l'événement pour que le dashboard ouvre le chat
    this.openChat.emit(userId);
    this.closePopup();
  }

  selectUser(user: UserSearchResult): void {
    // Action quand on clique sur un utilisateur
    console.log('Selected user:', user);
  }

  isCurrentUser(userId: number): boolean {
    return this.currentUser?.id === userId;
  }

  getAvatarLetter(username?: string): string {
    if (!username) return 'U';
    return username.charAt(0).toUpperCase();
  }

  getRoleLabel(role?: string): string {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return 'Admin';
      case 'ENTREPRENEUR': return 'Entrepreneur';
      case 'EXPERT': return 'Expert';
      case 'ORGANISATEUR': return 'Organizer';
      default: return 'User';
    }
  }

  getRoleClass(role?: string): string {
    switch (role?.toLowerCase()) {
      case 'admin': return 'admin';
      case 'entrepreneur': return 'entrepreneur';
      case 'expert': return 'expert';
      case 'organisateur': return 'organisateur';
      default: return 'user';
    }
  }

  trackByUserId(index: number, user: UserSearchResult): number {
    return user.id;
  }

  onImageError(event: any): void {
    // Remplacer l'image par un avatar par défaut en cas d'erreur
    event.target.style.display = 'none';
    const parent = event.target.parentElement;
    if (parent && !parent.querySelector('.avatar-placeholder')) {
      const placeholder = document.createElement('div');
      placeholder.className = 'avatar-placeholder';
      placeholder.textContent = this.getAvatarLetter(event.target.alt);
      parent.appendChild(placeholder);
    }
  }

  // Fermer la popup avec la touche Escape
  @HostListener('keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.closePopup();
    }
  }

  // Fermer la popup en cliquant à l'extérieur
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.isOpen && !target.closest('.search-popup') && !target.closest('.nav-btn')) {
      this.closePopup();
    }
  }
}
