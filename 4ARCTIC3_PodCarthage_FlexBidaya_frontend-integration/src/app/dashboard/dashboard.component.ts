import { Component, OnInit, AfterViewChecked, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ForumService, ForumPost, ForumComment } from '../services/forum.service';
import { UserService } from '../services/user.service';
import { ReactionService } from '../services/reaction.service';
import { FriendshipService, Friendship, UserSummary } from '../services/friendship.service';
import { MessagingService, MessageDTO } from '../services/messaging.service';
import { AppNotification, NotificationService } from '../services/notification.service';
import { GeocodingService, LocationSuggestion } from '../services/geocoding.service';
import * as L from 'leaflet';

const leafletDefaultIcon = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown };
delete leafletDefaultIcon._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png'
});

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef;
  @ViewChild('messageFileInput') messageFileInput?: ElementRef<HTMLInputElement>;
  private emojiButtonBound = false;
  private refreshTimerId: any = null;
  private heartbeatTimerId: any = null;

  posts: ForumPost[] = [];
  newPostContent: string = '';
  newPostMediaUrl: string = ''; // Base64 de l'image/vidÃ©o
  newPostMediaType: string = ''; // "image" ou "video"
  newPostError: string = '';
  showEmojiPicker: boolean = false;
  readonly postEmojis: string[] = ['ðŸ˜€', 'ðŸ˜‚', 'ðŸ˜', 'ðŸ”¥', 'ðŸ‘', 'ðŸ‘', 'ðŸŽ‰', 'ðŸ’¡', 'ðŸš€', 'â¤ï¸', 'ðŸ˜Š', 'ðŸ¤'];
  private readonly mediaOnlyMarker = '\u200B';
  private readonly emojiShortcodes: Record<string, string> = {
    ':smile:': 'ðŸ˜„',
    ':laugh:': 'ðŸ˜‚',
    ':heart:': 'â¤ï¸',
    ':fire:': 'ðŸ”¥',
    ':thumbsup:': 'ðŸ‘',
    ':clap:': 'ðŸ‘',
    ':rocket:': 'ðŸš€',
    ':idea:': 'ðŸ’¡',
    ':party:': 'ðŸŽ‰',
    ':wink:': 'ðŸ˜‰',
    ':sad:': 'ðŸ˜¢',
    ':ok:': 'ðŸ‘Œ'
  };
  loading: boolean = false;
  currentUser: any = null;
  searchQuery: string = '';
  searchResults: any[] = [];
  showSearchResults: boolean = false;
  isSearchPopupOpen: boolean = false;
  newCommentContent: { [key: number]: string } = {};
  editingPostId: number | null = null;
  editingPostContent: { [key: number]: { titre: string; contenu: string } } = {};
  editingCommentId: number | null = null;
  editingCommentContent: { [key: number]: string } = {};
  replyContent: { [key: number]: string } = {};
  showPostMenu: number | null = null;
  showCommentMenu: number | null = null;
  showReplyForm: number | null = null;
  showSearchPopup: boolean = false;
  reactionMenuPostId: number | null = null;
  showReactionMenuFlag: boolean = false;
  showDeleteConfirmation: boolean = false;
  commentToDelete: number | null = null;

  // IA Translation state
  translatedPosts: { [key: number]: { titre: string; contenu: string; translated: boolean } } = {};
  isTranslating: { [key: number]: boolean } = {};

  // Location state
  userLocation: { latitude: number; longitude: number } | null = null;
  friendsLocations: any[] = [];
  showMap: boolean = false;
  private map: any;
  private locationIntervalId: any = null;
  postLocation: { latitude: number; longitude: number } | null = null;
  
   // Location Picker state
   showLocationPicker: boolean = false;
   pickedLocation: { latitude: number; longitude: number } | null = null;
   locationAddress: string | null = null;
   locationSearchQuery: string = '';
   locationSuggestions: LocationSuggestion[] = [];
   showSuggestions: boolean = false;
   isLoadingSuggestions: boolean = false;
   searchLocationError: boolean = false;
   private pickerMap: any;
   private pickerMarker: any;
   private searchDebounceTimer: any = null;

  currentView: 'feed' | 'friends' | 'invitations' | 'messages' | 'notifications' | 'favorites' = 'feed';
  favoritePosts: ForumPost[] = [];
  friends: UserSummary[] = [];
  pendingInvitationsCount: number = 0;
  unreadMessagesBySender: { [key: number]: number } = {};
  receivedRequests: Friendship[] = [];
  error: string = '';
  friendError: string = '';
  invitationError: string = '';
  isBlockedPopupOpen: boolean = false;
  blockReason: string = '';
  selectedFriend: UserSummary | null = null;
  messages: MessageDTO[] = [];
  newMessage: string = '';
  messagesError: string = '';
  isSendingMessage: boolean = false;
  isRecordingVoice: boolean = false;
  selectedMessageMediaFile: File | null = null;
  selectedMessageMediaPreviewUrl: SafeUrl | null = null;
  private selectedMessageMediaUnsafeUrl: string | null = null;
  selectedMessageMediaType: string = '';
  selectedMessageMediaName: string = '';
  unreadCount: number = 0;
  notifications: AppNotification[] = [];
  notificationsError: string = '';
  unreadNotificationCount: number = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];

  constructor(
    private forumService: ForumService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private reactionService: ReactionService,
    private friendshipService: FriendshipService,
    private messagingService: MessagingService,
    private notificationService: NotificationService,
    private sanitizer: DomSanitizer,
    private geocodingService: GeocodingService
  ) {}

  ngOnInit(): void {
    console.log('=== Dashboard ngOnInit ===');
    console.log('Checking authentication on init...');
    if (!this.checkAuthentication()) {
      console.log('Not authenticated, redirecting to login');
      return;
    }
    console.log('Authenticated, loading data...');
    this.loadCurrentUser();
    this.loadPosts();
    this.loadUnreadMessageCount();
    this.loadUnreadNotificationCount();
    this.loadFriendsForMessages(); // Charger les amis pour la barre droite
    this.loadPendingInvitationsCount(); // Charger le nombre d'invitations en attente
    this.startRefreshLoop();
    this.startHeartbeatLoop();
    this.initGeolocation();
    this.handleQueryParams();
  }

  private handleQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      const chatWithId = params['chatWith'];
      if (chatWithId) {
        this.openChatWithUser(+chatWithId);
      }
    });
  }

  public openChatWithUser(userId: number): void {
    this.friendError = '';
    this.messagesError = '';
    
    // On essaie de trouver l'ami dans la liste si déjà chargé
    const friend = this.friends.find(f => f.id === userId);
    if (friend) {
      this.selectFriend(friend);
    } else {
      // Sinon on charge les infos de base et on lance la conversation
      this.userService.getUserById(userId).subscribe({
        next: (user: any) => {
          this.selectedFriend = {
            id: user.id,
            username: user.username,
            profileImage: user.profileImage
          };
          this.messages = [];
          this.newMessage = '';
          this.loadConversation(userId);
        },
        error: (err) => console.error('Error loading user for chat:', err)
      });
    }
  }

  ngAfterViewChecked(): void {
    this.enhanceEmojiButton();
    this.scrollMessagesToBottom();
  }

  ngOnDestroy(): void {
    if (this.refreshTimerId !== null) {
      window.clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
    if (this.heartbeatTimerId !== null) {
      window.clearInterval(this.heartbeatTimerId);
      this.heartbeatTimerId = null;
    }
    this.abortVoiceRecording();
    this.clearMessageMedia();
    this.destroyPickerMap();
  }

  private loadCurrentUser(): void {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // On utilise getMyProfile au lieu de getCurrentUser pour récupérer l'image de profil
        this.userService.getMyProfile().subscribe({
          next: (user: any) => {
            this.currentUser = user;
          },
          error: (error) => {
            console.error('Error loading user profile:', error);
            // Fallback si l'API échoue, on essaie au moins de récupérer les infos de base
            this.userService.getCurrentUser().subscribe({
              next: (fallbackUser: any) => {
                this.currentUser = fallbackUser;
              },
              error: () => this.router.navigate(['/signin'])
            });
          }
        });
      } catch (error) {
        console.error('Error parsing token:', error);
        this.router.navigate(['/signin']);
      }
    } else {
      this.router.navigate(['/signin']);
    }
  }

  private loadPosts(): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
      return;
    }
    this.loading = true;
    this.forumService.getPosts().subscribe({
      next: (posts: ForumPost[]) => {
        this.posts = posts;
        this.loading = false;
        // Charger les rÃ©actions de l'utilisateur pour chaque post
        this.loadUserReactions();
      },
      error: (error) => {
        console.error('Error loading posts:', error);
        this.loading = false;
      }
    });
  }

  private loadUserReactions(): void {
    this.posts.forEach(post => {
      this.reactionService.getMyPostReaction(post.id).subscribe({
        next: (reaction) => {
          if (reaction) {
            post.userReaction = reaction.type;
          }
        },
        error: (error) => {
          // Ignore errors for reactions (user might not have reacted)
        }
      });
    });
  }

  get canPublishPost(): boolean {
    return !!this.newPostContent.trim() || !!this.newPostMediaUrl;
  }

  createPost(): void {
    console.log('=== DEBUG createPost ===');
    console.log('Token exists:', !!localStorage.getItem('token'));
    console.log('Content:', this.newPostContent);
    console.log('Media URL:', this.newPostMediaUrl);
    console.log('Media Type:', this.newPostMediaType);
    console.log('Is authenticated:', this.checkAuthentication());
    
    if (!this.canPublishPost || !this.checkAuthentication()) {
      console.log('Cannot create post: missing content or not authenticated');
      return;
    }

    const content = this.preparePostContent(this.newPostContent);
    this.newPostError = '';
    
    this.loading = true;
    const postData = {
      titre: '',
      contenu: content,
      mediaUrl: this.newPostMediaUrl,
      mediaType: this.newPostMediaType,
      latitude: this.postLocation?.latitude,
      longitude: this.postLocation?.longitude
    };

    this.forumService.createPost(postData).subscribe({
      next: (post: ForumPost) => {
        this.posts.unshift(post);
        this.newPostContent = '';
        this.newPostMediaUrl = '';
        this.newPostMediaType = '';
        this.postLocation = null;
        this.loading = false;
        this.showEmojiPicker = false;
        this.loadUserReactions();
      },
      error: (error) => {
        console.error('Error creating post:', error);
        this.loading = false;
        
        // Show specific block popup if content is flagged (400, 403 or 500 error from moderation)
        const errorMessage = typeof error.error === 'string' ? error.error : (error.error?.message || '');
        console.log('DEBUG: Error creating post. Status:', error.status, 'Message:', errorMessage);
        
        const isBlocked = (error.status === 400 || error.status === 403 || error.status === 500) && (
          errorMessage.toLowerCase().includes('bloqu') || 
          errorMessage.toLowerCase().includes('image') ||
          errorMessage.toLowerCase().includes('contenu') ||
          errorMessage.toLowerCase().includes('moder') ||
          errorMessage.toLowerCase().includes('reject') ||
          errorMessage.toLowerCase().includes('block')
        );

        if (isBlocked) {
          this.blockReason = errorMessage || 'Inappropriate content detected by AI.';
          this.isBlockedPopupOpen = true;
          this.newPostError = ''; 
          // Fallback alert to be 100% sure the user is notified
          alert('🚫 CONTENT BLOCKED BY AI: ' + this.blockReason);
        } else {
          // Standard error handling
          if (error.status === 401) {
            this.newPostError = 'Your session has expired. Please log in again.';
            localStorage.removeItem('token');
            this.router.navigate(['/signin']);
          } else {
            this.newPostError = errorMessage || 'Post creation failed. Reduce media size and try again.';
          }
        }
      }
    });
  }

  attachLocationToPost(): void {
    if (this.postLocation) {
      this.postLocation = null;
      this.locationAddress = null;
    } else if (this.userLocation) {
      this.postLocation = this.userLocation;
      this.fetchAddress(this.postLocation.latitude, this.postLocation.longitude);
    } else {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.postLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        this.fetchAddress(this.postLocation.latitude, this.postLocation.longitude);
      });
    }
  }

  private fetchAddress(lat: number, lng: number): void {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        this.locationAddress = data.display_name;
      })
      .catch(() => {
        this.locationAddress = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      });
  }

  // Gestion de la sÃ©lection et compression d'images/vidÃ©os
  onMediaSelected(event: any, type: 'image' | 'video'): void {
    const file = event.target.files[0];
    if (!file) return;

    this.newPostError = '';

    if (type === 'image' && file.type.startsWith('image/')) {
      this.compressImage(file).then(base64 => {
        this.newPostMediaUrl = base64;
        this.newPostMediaType = 'image';
        if (!this.newPostContent.trim()) {
          this.newPostContent = this.mediaOnlyMarker;
        }
      });
    } else if (type === 'video' && file.type.startsWith('video/')) {
      const maxVideoSizeInBytes = 8 * 1024 * 1024;
      if (file.size > maxVideoSizeInBytes) {
        this.newPostError = 'The video is too large. Choose a video under 8 MB.';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.newPostMediaUrl = reader.result as string;
        this.newPostMediaType = 'video';
        if (!this.newPostContent.trim()) {
          this.newPostContent = this.mediaOnlyMarker;
        }
      };
      reader.readAsDataURL(file);
    } else {
      this.newPostError = 'Selected file format is not supported.';
    }
  }

  // Compression simple d'image
  private compressImage(file: File, quality: number = 0.6, maxWidth: number = 800): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          let compressedImage = canvas.toDataURL('image/jpeg', quality);

          // Si trop gros, compresser d'avantage
          if (compressedImage.length > 500000) {
            compressedImage = canvas.toDataURL('image/jpeg', 0.3);
          }

          resolve(compressedImage);
        };
      };
    });
  }

  // Supprimer la mÃ©dia sÃ©lectionnÃ©e
  removeMedia(): void {
    this.newPostMediaUrl = '';
    this.newPostMediaType = '';
    this.newPostError = '';
    if (this.newPostContent === this.mediaOnlyMarker) {
      this.newPostContent = '';
    }
  }

  private preparePostContent(value: string): string {
    const withoutMarker = (value || '').split(this.mediaOnlyMarker).join('');
    let normalized = withoutMarker;

    Object.entries(this.emojiShortcodes).forEach(([shortcode, emoji]) => {
      normalized = normalized.split(shortcode).join(emoji);
    });

    return normalized.trim();
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmojiToPost(emoji: string): void {
    const currentValue = this.newPostContent || '';
    this.newPostContent = `${currentValue}${emoji}`;
    this.showEmojiPicker = false;
  }

  private enhanceEmojiButton(): void {
    if (this.emojiButtonBound) {
      return;
    }

    const buttons = Array.from(document.querySelectorAll('.new-post-section .option-btn')) as HTMLElement[];
    const emojiButton = buttons.find((button) => {
      const label = (button.innerText || button.textContent || '').toLowerCase();
      return label.includes('moji');
    });

    if (!emojiButton) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'emoji-picker-container';
    emojiButton.parentElement?.insertBefore(wrapper, emojiButton);
    wrapper.appendChild(emojiButton);

    const menu = document.createElement('div');
    menu.className = 'inline-emoji-menu';
    menu.style.display = 'none';

    ['👍', '👎', '😍', '🔥', '😂', '😢', '😡', '😮'].forEach((emoji) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inline-emoji-option';
      button.textContent = emoji;
      button.addEventListener('click', () => {
        this.addEmojiToPost(emoji);
        menu.style.display = 'none';
      });
      menu.appendChild(button);
    });

    wrapper.appendChild(menu);

    emojiButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.style.display = menu.style.display === 'grid' ? 'none' : 'grid';
    });

    this.emojiButtonBound = true;
  }

  reactToPost(postId: number, reactionType: string): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
      return;
    }

    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    // Sauvegarder l'ancienne rÃ©action pour mettre Ã  jour les compteurs
    const oldReaction = post.userReaction;

    this.reactionService.reactToPost(postId, reactionType).subscribe({
      next: (reaction) => {
        // Masquer le menu des rÃ©actions
        this.hideReactionMenu();

        if (reaction === null) {
          // RÃ©action supprimÃ©e (toggle)
          if (oldReaction) {
            this.decrementReactionCount(post, oldReaction);
            post.userReaction = null;
          }
        } else {
          // Nouvelle rÃ©action ajoutÃ©e
          if (oldReaction && oldReaction !== reactionType) {
            // Changer de type de rÃ©action
            this.decrementReactionCount(post, oldReaction);
          }
          if (!oldReaction || oldReaction !== reactionType) {
            // Nouvelle rÃ©action ou changement de type
            this.incrementReactionCount(post, reactionType);
          }
          post.userReaction = reactionType;
        }
      },
      error: (error) => {
        console.error('Error reacting to post:', error);
      }
    });
  }

  onMouseEnterReaction(postId: number, event: MouseEvent): void {
    // ImplÃ©mentation pour afficher un menu de rÃ©actions si nÃ©cessaire
    console.log('Mouse enter reaction for post:', postId);
  }

  showReactionMenu(postId: number): void {
    this.reactionMenuPostId = postId;
    this.showReactionMenuFlag = true;
  }

  hideReactionMenu(): void {
    this.showReactionMenuFlag = false;
    this.reactionMenuPostId = null;
  }

  toggleReactionMenu(postId: number): void {
    if (this.reactionMenuPostId === postId && this.showReactionMenuFlag) {
      this.hideReactionMenu();
    } else {
      this.showReactionMenu(postId);
    }
  }

  private incrementReactionCount(post: ForumPost, reactionType: string): void {
    switch (reactionType) {
      case 'LIKE':
        post.likeCount = (post.likeCount || 0) + 1;
        break;
      case 'DISLIKE':
        post.dislikeCount = (post.dislikeCount || 0) + 1;
        break;
      case 'LOVE':
        post.loveCount = (post.loveCount || 0) + 1;
        break;
    }
  }

  private decrementReactionCount(post: ForumPost, reactionType: string): void {
    switch (reactionType) {
      case 'LIKE':
        post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
        break;
      case 'DISLIKE':
        post.dislikeCount = Math.max(0, (post.dislikeCount || 0) - 1);
        break;
      case 'LOVE':
        post.loveCount = Math.max(0, (post.loveCount || 0) - 1);
        break;
    }
  }

  // MÃ©thodes pour les commentaires amÃ©liorÃ©s
  getTotalCommentsCount(post: ForumPost): number {
    return post.comments ? post.comments.length : 0;
  }

  trackByCommentId(index: number, comment: ForumComment): number {
    return comment.id;
  }

  reactToComment(commentId: number, reactionType: string): void {
    this.forumService.likeComment(commentId).subscribe({
      next: () => {
        this.posts.forEach(post => {
          if (post.comments) {
            const comment = post.comments.find(c => c.id === commentId);
            if (comment) {
              comment.likeCount = (comment.likeCount || 0) + 1;
              comment.userReaction = 'LIKE';
            }
          }
        });
      },
      error: (error) => {
        console.error('Error reacting to comment:', error);
      }
    });
  }

  confirmDeleteComment(commentId: number): void {
    this.commentToDelete = commentId;
    this.showDeleteConfirmation = true;
    this.hideAllMenus();
  }

  executeDelete(): void {
    if (this.commentToDelete) {
      this.deleteComment(this.commentToDelete);
      this.cancelDelete();
    }
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
    this.commentToDelete = null;
  }

  hideAllMenus(): void {
    this.showCommentMenu = null;
    this.showReactionMenuFlag = false;
    this.reactionMenuPostId = null;
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  goToFriends(): void {
    this.viewFriends();
  }

  goToMessages(): void {
    this.currentView = 'messages';
    this.selectedFriend = null;
    this.messages = [];
    this.newMessage = '';
    this.messagesError = '';
    this.friendError = '';
    this.loadFriendsForMessages();
  }

  viewNotifications(): void {
    this.currentView = 'notifications';
    this.notificationsError = '';
    this.loadNotifications();
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('roles');
    this.router.navigate(['/signin']);
  }

  searchUsers(): void {
    this.isSearchPopupOpen = true;
  }

  viewFriends(): void {
    this.currentView = 'friends';
    this.friendError = '';
    this.loadFriends();
  }

  viewInvitations(): void {
    this.currentView = 'invitations';
    this.selectedFriend = null;
    this.loadReceivedRequests();
  }

  private loadPendingInvitationsCount(): void {
    this.friendshipService.getReceivedRequests().subscribe({
      next: (requests: Friendship[]) => {
        this.pendingInvitationsCount = requests.filter(r => r.status === 'PENDING').length;
      },
      error: (error: any) => {
        console.error('Error loading pending invitations count:', error);
      }
    });
  }

  goToFeed(): void {
    this.currentView = 'feed';
    this.loadPosts();
  }

  goToFavorites(): void {
    this.currentView = 'favorites';
    this.loadFavorites();
  }

  openNotification(notification: AppNotification): void {
    if (!notification.read) {
      this.markNotificationAsRead(notification);
    }

    if (notification.type === 'MESSAGE_RECEIVED' && notification.actorId) {
      this.currentView = 'messages';
      this.friendError = '';
      this.messagesError = '';
      this.selectedFriend = {
        id: notification.actorId,
        username: notification.actorUsername || 'User',
        profileImage: notification.actorProfileImage || null
      };
      this.messages = [];
      this.newMessage = '';
      this.loadConversation(notification.actorId);
      return;
    }

    this.currentView = 'feed';
    if (notification.postId) {
      this.focusPost(notification.postId, !!notification.commentId);
    }
  }

  markNotificationAsRead(notification: AppNotification, event?: Event): void {
    event?.stopPropagation();

    if (notification.read) {
      return;
    }

    notification.read = true;
    this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);

    this.notificationService.markAsRead(notification.id).subscribe({
      error: (error: any) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllNotificationsAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map(notification => ({
          ...notification,
          read: true
        }));
        this.unreadNotificationCount = 0;
      },
      error: (error: any) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  private loadFriends(): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
      return;
    }
    this.friendshipService.getFriends().subscribe({
      next: (friends: UserSummary[]) => {
        this.friends = friends;
        if (!friends.length) {
          this.friendError = 'You don\'t have any friends yet.';
        }
      },
      error: (error: any) => {
        console.error('Error loading friends:', error);
        this.friendError = 'Could not load friends list.';
      }
    });
  }

  private loadUnreadCountsBySender(): void {
    this.messagingService.getUnreadCountsBySender().subscribe({
      next: (counts) => {
        this.unreadMessagesBySender = counts;
        // Mettre à jour les amis existants avec leurs nouveaux counts
        this.friends = this.friends.map(f => ({
          ...f,
          unreadCount: counts[f.id] || 0
        }));
      },
      error: (error) => {
        console.error('Error loading unread counts by sender:', error);
      }
    });
  }

  private loadFriendsForMessages(): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
      return;
    }
    this.friendshipService.getFriends().subscribe({
      next: (friends: UserSummary[]) => {
        this.friends = friends.map(f => ({
          ...f,
          unreadCount: this.unreadMessagesBySender[f.id] || 0
        }));
        
        if (!this.friends.length) {
          this.friendError = 'You don\'t have any friends to chat with yet.';
        }
      },
      error: (error: any) => {
        console.error('Error loading friends for messages:', error);
        this.error = 'Could not share the post.';
      }
    });
  }

  toggleFavorite(post: ForumPost): void {
    if (!this.checkAuthentication()) return;

    this.forumService.toggleFavorite(post.id).subscribe({
      next: (response) => {
        post.isFavorited = response.isFavorited;
        if (this.currentView === 'favorites' && !response.isFavorited) {
          // Remove from list if un-favorited while in favorites view
          this.favoritePosts = this.favoritePosts.filter(p => p.id !== post.id);
        }
      },
      error: (err) => {
        console.error('Erreur lors de la modification des favoris', err);
      }
    });
  }

  selectFriend(friend: UserSummary): void {
    this.abortVoiceRecording();
    this.clearMessageMedia();
    this.selectedFriend = friend;
    this.messages = [];
    this.newMessage = '';
    this.messagesError = '';
    this.loadConversation(friend.id);
  }

  formatLastSeen(dateString?: string | Date): string {
    if (!dateString) return 'Online';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'a few seconds ago';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d ago`;
  }

  closeChat(): void {
    this.selectedFriend = null;
    this.abortVoiceRecording();
    this.clearMessageMedia();
  }

  private loadConversation(friendId: number): void {
    this.messagingService.getConversation(friendId).subscribe({
      next: (messages: MessageDTO[]) => {
        this.messages = messages;
        this.scrollMessagesToBottom();
        this.loadUnreadMessageCount();
        this.loadUnreadCountsBySender(); // Mettre à jour après avoir marqué comme lu
        this.loadUnreadNotificationCount();
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.messagesError = 'Error loading conversation';
        this.messages = [];
      }
    });
  }

  sendMessage(): void {
    if (!this.selectedFriend || !this.canSendMessage()) return;

    const content = this.newMessage.trim();
    const attachment = this.selectedMessageMediaFile;
    this.isSendingMessage = true;
    this.messagesError = '';

    const request$ = attachment
      ? this.messagingService.sendMessageWithMedia(this.selectedFriend.id, content, attachment)
      : this.messagingService.sendMessage(this.selectedFriend.id, content);

    request$.subscribe({
      next: (message: MessageDTO) => {
        this.messages.push(message);
        this.newMessage = '';
        this.clearMessageMedia();
        this.isSendingMessage = false;
        this.scrollMessagesToBottom();
        this.loadUnreadMessageCount();
      },
      error: (error) => {
        console.error('Error sending message:', error);
        this.isSendingMessage = false;
        this.messagesError = 'Error sending message';
      }
    });
  }

  canSendMessage(): boolean {
    return !!this.selectedFriend
      && !this.isSendingMessage
      && !this.isRecordingVoice
      && (!!this.newMessage.trim() || !!this.selectedMessageMediaFile);
  }

  openMessageMediaPicker(): void {
    if (this.isSendingMessage || this.isRecordingVoice) {
      return;
    }
    this.messageFileInput?.nativeElement.click();
  }

  onMessageMediaSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    if (!this.isSupportedMessageMedia(file.type)) {
      this.messagesError = 'Formats acceptes: image, video ou audio.';
      input.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.messagesError = 'Le fichier depasse 25 MB.';
      input.value = '';
      return;
    }

    this.messagesError = '';
    this.abortVoiceRecording();
    this.prepareMessageMedia(file);
  }

  async toggleVoiceRecording(): Promise<void> {
    if (this.isSendingMessage) {
      return;
    }

    if (this.isRecordingVoice) {
      this.stopVoiceRecording();
      return;
    }

    if (!this.supportsVoiceRecording()) {
      this.messagesError = 'Voice recording is not supported by this browser.';
      return;
    }

    try {
      this.messagesError = '';
      this.clearMessageMedia();
      this.recordedChunks = [];
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const preferredMimeType = this.getPreferredAudioMimeType();
      this.mediaRecorder = preferredMimeType
        ? new MediaRecorder(this.recordingStream, { mimeType: preferredMimeType })
        : new MediaRecorder(this.recordingStream);

      this.mediaRecorder.ondataavailable = (recordedEvent: BlobEvent) => {
        if (recordedEvent.data && recordedEvent.data.size > 0) {
          this.recordedChunks.push(recordedEvent.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const mediaType = this.mediaRecorder?.mimeType || preferredMimeType || 'audio/webm';
        const recordedBlob = new Blob(this.recordedChunks, { type: mediaType });
        if (recordedBlob.size > 0) {
          this.prepareMessageMedia(this.createVoiceMessageFile(recordedBlob, mediaType));
        }
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.isRecordingVoice = false;
        this.stopRecordingStream();
      };

      this.mediaRecorder.start();
      this.isRecordingVoice = true;
    } catch (error) {
      console.error('Error recording voice message:', error);
      this.abortVoiceRecording();
      this.messagesError = 'Could not start voice recording.';
    }
  }

  clearMessageMedia(resetInput: boolean = true): void {
    if (this.selectedMessageMediaUnsafeUrl) {
      URL.revokeObjectURL(this.selectedMessageMediaUnsafeUrl);
      this.selectedMessageMediaUnsafeUrl = null;
    }

    this.selectedMessageMediaFile = null;
    this.selectedMessageMediaPreviewUrl = null;
    this.selectedMessageMediaType = '';
    this.selectedMessageMediaName = '';

    if (resetInput && this.messageFileInput?.nativeElement) {
      this.messageFileInput.nativeElement.value = '';
    }
  }

  isImageMessage(message: MessageDTO): boolean {
    return this.isImageMediaType(message.mediaType);
  }

  isVideoMessage(message: MessageDTO): boolean {
    return this.isVideoMediaType(message.mediaType);
  }

  isAudioMessage(message: MessageDTO): boolean {
    return this.isAudioMediaType(message.mediaType);
  }

  supportsVoiceRecording(): boolean {
    return typeof MediaRecorder !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && !!navigator.mediaDevices.getUserMedia;
  }

  private prepareMessageMedia(file: File): void {
    this.clearMessageMedia();
    this.selectedMessageMediaFile = file;
    this.selectedMessageMediaType = file.type;
    this.selectedMessageMediaName = file.name;
    this.selectedMessageMediaUnsafeUrl = URL.createObjectURL(file);
    this.selectedMessageMediaPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(this.selectedMessageMediaUnsafeUrl);
  }

  private stopVoiceRecording(): void {
    if (!this.mediaRecorder) {
      return;
    }

    this.isRecordingVoice = false;
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  private abortVoiceRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.onstop = null;
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    this.recordedChunks = [];
    this.isRecordingVoice = false;
    this.stopRecordingStream();
  }

  private stopRecordingStream(): void {
    this.recordingStream?.getTracks().forEach(track => track.stop());
    this.recordingStream = null;
  }

  private createVoiceMessageFile(blob: Blob, mimeType: string): File {
    const extension = this.getAudioExtension(mimeType);
    return new File([blob], `voice-message-${Date.now()}.${extension}`, { type: mimeType });
  }

  private getAudioExtension(mimeType: string): string {
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm';
  }

  private getPreferredAudioMimeType(): string {
    const candidates = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return '';
  }

  private isSupportedMessageMedia(mimeType: string): boolean {
    return this.isImageMediaType(mimeType)
      || this.isVideoMediaType(mimeType)
      || this.isAudioMediaType(mimeType);
  }

  private isImageMediaType(mimeType?: string | null): boolean {
    return !!mimeType && mimeType.startsWith('image/');
  }

  private isVideoMediaType(mimeType?: string | null): boolean {
    return !!mimeType && mimeType.startsWith('video/');
  }

  private isAudioMediaType(mimeType?: string | null): boolean {
    return !!mimeType && mimeType.startsWith('audio/');
  }

  backToFriendsList(): void {
    this.abortVoiceRecording();
    this.clearMessageMedia();
    this.selectedFriend = null;
    this.messages = [];
    this.newMessage = '';
    this.messagesError = '';
  }

  closeSearchPopup(): void {
    this.isSearchPopupOpen = false;
  }

  private loadNotifications(): void {
    if (!this.checkAuthentication()) {
      return;
    }

    this.notificationService.getNotifications().subscribe({
      next: (notifications: AppNotification[]) => {
        this.notifications = notifications;
        this.notificationsError = '';
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
        this.notificationsError = 'Could not load notifications.';
      }
    });
  }

  private loadUnreadNotificationCount(): void {
    if (!this.checkAuthentication()) {
      return;
    }

    this.notificationService.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadNotificationCount = response.unreadCount;
      },
      error: (error: any) => {
        console.error('Error loading notification count:', error);
      }
    });
  }

  private startRefreshLoop(): void {
    if (this.refreshTimerId !== null) {
      window.clearInterval(this.refreshTimerId);
    }

    this.refreshTimerId = window.setInterval(() => {
      if (!this.checkAuthentication()) {
        return;
      }

      this.loadUnreadMessageCount();
      this.loadUnreadNotificationCount();
      this.loadFriendsForMessages(); // Rafraîchir les statuts des amis
      this.loadUnreadCountsBySender(); // Rafraîchir les badges de messages
      this.loadPendingInvitationsCount(); // Rafraîchir les badges d'invitations

      if (this.currentView === 'notifications') {
        this.loadNotifications();
    } else if (this.currentView === 'favorites') {
      this.loadFavorites();
    }
    }, 10000); // Toutes les 10 secondes
  }

  private startHeartbeatLoop(): void {
    if (this.heartbeatTimerId !== null) {
      window.clearInterval(this.heartbeatTimerId);
    }

    // Premier heartbeat immÃ©diat
    this.userService.heartbeat().subscribe();

    this.heartbeatTimerId = window.setInterval(() => {
      this.userService.heartbeat().subscribe({
        error: (err) => console.warn('Heartbeat failed', err)
      });
    }, 30000); // Toutes les 30 secondes
  }

  // MÃ©thodes pour les rÃ©actions
  getReactionEmoji(type: string | null | undefined): string {
    switch (type) {
      case 'LIKE': return '👍';
      case 'DISLIKE': return '👎';
      case 'LOVE': return '❤️';
      default: return '👍'; // Default to like
    }
  }

  getNotificationIcon(type: AppNotification['type']): string {
    switch (type) {
      case 'MESSAGE_RECEIVED': return '💬';
      case 'POST_REACTION': return '✨';
      case 'COMMENT_REACTION': return '💭';
      case 'POST_SHARED': return '📤';
      default: return '🔔';
    }
  }

  getTotalReactionCount(post: ForumPost): string {
    const total = (post.likeCount || 0) + (post.dislikeCount || 0) + (post.loveCount || 0);
    return total.toString();
  }

  private focusPost(postId: number, openComments: boolean = false): void {
    const postIndex = this.posts.findIndex(post => post.id === postId);
    if (postIndex === -1) {
      return;
    }

    const [post] = this.posts.splice(postIndex, 1);
    this.posts.unshift(post);

    if (openComments) {
      post.showComments = true;
      if (!post.comments) {
        this.loadComments(post.id);
      }
    }
  }

  // Organiser les commentaires hiérarchiquement
  getOrganizedComments(post: ForumPost): ForumComment[] {
    if (!post.comments || post.comments.length === 0) {
      return [];
    }

    const topLevelComments: ForumComment[] = [];
    const repliesMap: { [key: number]: ForumComment[] } = {};

    // Séparer les commentaires de premier niveau et les réponses
    post.comments.forEach(comment => {
      if (comment.parentCommentId) {
        if (!repliesMap[comment.parentCommentId]) {
          repliesMap[comment.parentCommentId] = [];
        }
        repliesMap[comment.parentCommentId].push(comment);
      } else {
        topLevelComments.push(comment);
      }
    });

    // Fonction récursive pour imbriquer les réponses
    const organizeRecursively = (comment: ForumComment, depth: number = 0): ForumComment => {
      const organized = { ...comment, depth } as any;
      if (repliesMap[comment.id]) {
        (organized as any).replies = repliesMap[comment.id].map(reply => 
          organizeRecursively(reply, depth + 1)
        );
      }
      return organized;
    };

    return topLevelComments.map(comment => organizeRecursively(comment));
  }

  // Obtenir les réponses d'un commentaire
  getCommentReplies(commentId: number, post: ForumPost): ForumComment[] {
    if (!post.comments) return [];
    return post.comments.filter(c => c.parentCommentId === commentId);
  }

  // MÃ©thodes pour les posts
  openComments(postId: number): void {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;
    
    post.showComments = !post.showComments;
    
    if (post.showComments && !post.comments) {
      this.loadComments(postId);
    }
  }

  private loadComments(postId: number): void {
    this.forumService.getPostComments(postId).subscribe({
      next: (comments: ForumComment[]) => {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
          post.comments = comments;
        }
      },
      error: (error) => {
        console.error('Error loading comments:', error);
      }
    });
  }

  addComment(postId: number, content: string): void {
    if (!content.trim()) return;

    this.forumService.addComment(postId, content).subscribe({
      next: (comment: ForumComment) => {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
          if (!post.comments) {
            post.comments = [];
          }
          post.comments.push(comment);
        }
        this.newCommentContent[postId] = '';
      },
      error: (error) => {
        console.error('Error adding comment:', error);
        if (error.status === 400 || error.status === 500) {
          alert(error.error?.message || 'The comment was blocked by AI for inappropriate content.');
        } else {
          alert('An error occurred while adding the comment.');
        }
      }
    });
  }

  sharePost(postId: number): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
      return;
    }

    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    this.forumService.sharePost(postId).subscribe({
      next: (sharedPost: ForumPost) => {
        // Force share information for UI display
        sharedPost.shared = true;
        sharedPost.originalUsername = post.username;
        
        // Copy location from original to share
        if (post.latitude && post.longitude) {
          sharedPost.latitude = post.latitude;
          sharedPost.longitude = post.longitude;
        }

        this.posts.unshift(sharedPost);
        alert('Post shared successfully!');
      },
      error: (error) => {
        console.error('Error sharing post:', error);
        if (error.status === 401) {
          console.log('401 Unauthorized - redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userId');
          localStorage.removeItem('roles');
          this.router.navigate(['/signin']);
        } else {
          alert('Error sharing the post');
        }
      }
    });
  }

  isPostOwner(post: ForumPost): boolean {
    const isOwner = this.currentUser && post.userId === this.currentUser.id;
    const isAdmin = this.currentUser && this.currentUser.role === 'ADMIN';
    return isOwner || isAdmin;
  }

  isCommentOwner(comment: ForumComment): boolean {
    const isOwner = this.currentUser && comment.userId === this.currentUser.id;
    const isAdmin = this.currentUser && this.currentUser.role === 'ADMIN';
    return isOwner || isAdmin;
  }

  togglePostMenu(postId: number): void {
    this.showPostMenu = this.showPostMenu === postId ? null : postId;
    this.showCommentMenu = null;
  }

  toggleCommentMenu(commentId: number): void {
    this.showCommentMenu = this.showCommentMenu === commentId ? null : commentId;
    this.showPostMenu = null;
  }

  toggleReplyForm(commentId: number): void {
    this.showReplyForm = this.showReplyForm === commentId ? null : commentId;
  }

  cancelReply(commentId: number): void {
    this.replyContent[commentId] = '';
    this.showReplyForm = null;
  }

  likeComment(commentId: number): void {
    this.forumService.likeComment(commentId).subscribe({
      next: (response: any) => {
        // Le backend renvoie null/204 No Content si la réaction est supprimée
        const isRemoved = !response;

        // Fonction récursive pour trouver et mettre à jour le commentaire ou la réponse
        const updateCommentRecursive = (comments: ForumComment[]): boolean => {
          if (!comments) return false;
          
          for (const comment of comments) {
            if (comment.id === commentId) {
              if (isRemoved) {
                // Si la réaction existait déjà (on vient de la supprimer)
                if (comment.userReaction === 'LIKE') {
                  comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1);
                }
                comment.userReaction = null;
              } else {
                // Si c'est une nouvelle réaction (on vient de l'ajouter)
                if (comment.userReaction !== 'LIKE') {
                  comment.likeCount = (comment.likeCount || 0) + 1;
                }
                comment.userReaction = 'LIKE';
              }
              return true;
            }
            // Chercher dans les réponses
            if (comment.replies && updateCommentRecursive(comment.replies)) {
              return true;
            }
          }
          return false;
        };

        this.posts.forEach(post => {
          if (post.comments) {
            updateCommentRecursive(post.comments);
          }
        });
      },
      error: (error) => {
        console.error('Error liking comment:', error);
      }
    });
  }

  startEditingPost(postId: number): void {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      this.editingPostId = postId;
      this.editingPostContent[postId] = {
        titre: post.titre || '',
        contenu: post.contenu || ''
      };
    }
  }

  cancelEditingPost(): void {
    this.editingPostId = null;
    this.editingPostContent = {};
  }

  savePost(postId: number): void {
    const content = this.editingPostContent[postId];
    if (!content || !content.contenu.trim()) return;

    this.forumService.updatePost(postId, content.titre, content.contenu).subscribe({
      next: (updatedPost: ForumPost) => {
        const postIndex = this.posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
          this.posts[postIndex] = updatedPost;
        }
        this.cancelEditingPost();
      },
      error: (error) => {
        console.error('Error updating post:', error);
        if (error.status === 400 || error.status === 500) {
          alert(error.error?.message || 'The modification was blocked by AI.');
        } else {
          alert('Error updating the post.');
        }
      }
    });
  }

  deletePost(postId: number): void {
    if (!this.checkAuthentication()) {
      localStorage.removeItem('token');
      this.router.navigate(['/signin']);
      return;
    }

    this.forumService.deletePost(postId).subscribe({
      next: () => {
        this.posts = this.posts.filter(post => post.id !== postId);
      },
      error: (error) => {
        console.error('Error deleting post:', error);
        if (error.status === 401) {
          localStorage.removeItem('token');
          this.router.navigate(['/signin']);
        }
      }
    });
  }

  startEditingComment(commentId: number, currentContent: string): void {
    this.editingCommentId = commentId;
    this.editingCommentContent[commentId] = currentContent;
  }

  cancelEditingComment(): void {
    this.editingCommentId = null;
    this.editingCommentContent = {};
  }

  saveComment(commentId: number): void {
    console.log('=== DEBUG saveComment ===');
    console.log('Comment ID:', commentId);
    console.log('Token exists:', !!localStorage.getItem('token'));
    console.log('Current user:', this.currentUser);
    
    if (!this.checkAuthentication()) {
      console.log('Authentication check failed');
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
      localStorage.removeItem('roles');
      this.router.navigate(['/signin']);
      return;
    }

    // VÃ©rifier que l'utilisateur est propriÃ©taire du commentaire
    const comment = this.posts.flatMap(p => p.comments || []).find(c => c.id === commentId);
    console.log('Comment found:', !!comment);
    console.log('Is comment owner:', comment ? this.isCommentOwner(comment) : 'N/A');
    
    if (!comment || !this.isCommentOwner(comment)) {
      console.error('Not authorized to edit this comment');
      return;
    }

    const content = this.editingCommentContent[commentId];
    console.log('Content to update:', content);
    
    if (content && content.trim()) {
      console.log('Calling updateComment API...');
      this.forumService.updateComment(commentId, content).subscribe({
        next: (updatedComment: ForumComment) => {
          this.posts.forEach(post => {
            if (post.comments) {
              const commentIndex = post.comments.findIndex(c => c.id === commentId);
              if (commentIndex !== -1) {
                post.comments[commentIndex] = updatedComment;
              }
            }
          });
          this.cancelEditingComment();
        },
        error: (error) => {
          console.error('Error updating comment:', error);
          if (error.status === 400 || error.status === 500) {
            alert(error.error?.message || 'The comment modification was blocked by AI.');
          } else if (error.status === 401) {
            // Token expirÃ©, nettoyer et rediriger immÃ©diatement
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userId');
            localStorage.removeItem('roles');
            this.router.navigate(['/signin']);
          } else if (error.status === 403) {
            console.error('Not authorized to update this comment');
          }
        }
      });
    }
  }

  deleteComment(commentId: number): void {
    if (!this.checkAuthentication()) {
      localStorage.removeItem('token');
      this.router.navigate(['/signin']);
      return;
    }

    this.forumService.deleteComment(commentId).subscribe({
      next: () => {
        this.posts.forEach(post => {
          if (post.comments) {
            post.comments = post.comments.filter(c => c.id !== commentId && c.parentCommentId !== commentId);
          }
        });
        console.log('Comment deleted successfully');
      },
      error: (error) => {
        console.error('Error deleting comment:', error);
        if (error.status === 401) {
          localStorage.removeItem('token');
          this.router.navigate(['/signin']);
        }
      }
    });
  }

  replyToComment(parentCommentId: number): void {
    const content: string = this.replyContent[parentCommentId];
    if (!content || !content.trim()) {
      return;
    }

    this.forumService.replyToComment(parentCommentId, content).subscribe({
      next: (reply) => {
        this.posts.forEach((post: any) => {
          if (post.comments) {
            const parentComment = post.comments.find((c: any) => c.id === parentCommentId);
            if (parentComment) {
              // Ajouter la rÃ©ponse comme un commentaire normal avec parentCommentId
              post.comments.push({
                ...reply,
                parentCommentId: parentCommentId
              });
            }
          }
        });
        this.replyContent[parentCommentId] = '';
        this.showReplyForm = null;
      },
      error: (error) => {
        console.error('Error replying to comment:', error);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.post-actions-menu') && !target.closest('.comment-actions-menu')) {
      this.showPostMenu = null;
      this.showCommentMenu = null;
    }
    if (!target.closest('.emoji-picker-container')) {
      this.showEmojiPicker = false;
    }
    if (target.classList.contains('reply-form')) {
      this.showReplyForm = null;
    }
  }

  @HostListener('keydown.escape')
  onEscapeKey(): void {
    this.showReplyForm = null;
  }

  private loadUnreadMessageCount(): void {
    this.messagingService.getUnreadMessageCount().subscribe({
      next: (response) => {
        this.unreadCount = response.unreadCount;
      },
      error: (error) => {
        console.error('Error loading unread count:', error);
      }
    });
  }

  private scrollMessagesToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const container = this.messagesContainer.nativeElement as HTMLElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  private loadReceivedRequests(): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
      return;
    }
    this.friendshipService.getReceivedRequests().subscribe({
      next: (requests: Friendship[]) => {
        this.receivedRequests = requests;
        if (!requests.length) {
          this.invitationError = 'No invitations received yet.';
        }
      },
      error: (error) => {
        console.error('Error loading received requests:', error);
        this.invitationError = 'Could not load received invitations.';
      }
    });
  }

  loadInvitations(): void {
    if (this.currentView !== 'invitations') return;
    this.friendshipService.getReceivedRequests().subscribe({
      next: (requests) => {
        this.receivedRequests = requests;
        this.invitationError = '';
        this.pendingInvitationsCount = requests.length;
      },
      error: (err) => {
        console.error('Error loading invitations', err);
        this.invitationError = 'Error loading invitations. Please try again later.';
      }
    });
  }

  loadFavorites(): void {
    if (this.currentView !== 'favorites') return;
    this.forumService.getFavorites().subscribe({
      next: (posts) => {
        this.favoritePosts = posts;
        this.favoritePosts.forEach(post => post.isFavorited = true); // Mark them all as favorited
        this.error = '';
      },
      error: (err) => {
        console.error('Error loading favorites', err);
        this.error = 'Error loading favorites. Please try again later.';
      }
    });
  }

  acceptInvitation(friendshipId: number): void {
    this.friendshipService.acceptRequest(friendshipId).subscribe({
      next: () => {
        this.receivedRequests = this.receivedRequests.filter(req => req.id !== friendshipId);
        this.loadFriends();
      },
      error: (error) => {
        console.error('Error accepting invitation:', error);
        this.invitationError = 'Could not accept the invitation.';
      }
    });
  }

  rejectInvitation(friendshipId: number): void {
    this.friendshipService.rejectRequest(friendshipId).subscribe({
      next: () => {
        this.receivedRequests = this.receivedRequests.filter(req => req.id !== friendshipId);
      },
      error: (error) => {
        console.error('Error rejecting invitation:', error);
        this.invitationError = 'Could not decline the invitation.';
      }
    });
  }

  checkAuthentication(): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found in localStorage');
      return false;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp <= Date.now() / 1000;
      if (isExpired) {
        // Nettoyer le localStorage si le token est expirÃ©
        console.log('Token expired, cleaning localStorage and redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        localStorage.removeItem('roles');
        this.router.navigate(['/signin']);
        return false;
      }
      console.log('Token is valid');
      return true;
    } catch (error) {
      console.error('Error parsing token:', error);
      // Nettoyer en cas d'erreur de parsing
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
      localStorage.removeItem('roles');
      this.router.navigate(['/signin']);
      return false;
    }
  }

  ensureAuthenticated(): void {
    if (!this.checkAuthentication()) {
      this.router.navigate(['/signin']);
    }
  }

  isAdmin(): boolean {
    const roles = localStorage.getItem('roles');
    if (!roles) return false;
    try {
      const parsedRoles = JSON.parse(roles);
      return parsedRoles.some((role: any) => role.name === 'ROLE_ADMIN');
    } catch {
      return false;
    }
  }

  goToAdminDashboard(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  // --- Traduction IA (OpenAI) ---
  translatePost(post: any, lang: string): void {
    if (this.isTranslating[post.id]) return;
    
    this.isTranslating[post.id] = true;
    this.userService.translate(post.contenu, lang).subscribe({
      next: (res: any) => {
        this.translatedPosts[post.id] = {
          titre: post.titre, // On pourrait aussi traduire le titre si besoin
          contenu: res.translatedText,
          translated: true
        };
        this.isTranslating[post.id] = false;
      },
      error: (err) => {
        console.error('Erreur traduction:', err);
        this.isTranslating[post.id] = false;
      }
    });
  }

  toggleTranslation(postId: number): void {
    if (this.translatedPosts[postId]) {
      this.translatedPosts[postId].translated = !this.translatedPosts[postId].translated;
    }
  }

  // --- Géolocalisation & Carte (Leaflet) ---
  initGeolocation(): void {
    if (navigator.geolocation) {
      // Premier update
      navigator.geolocation.getCurrentPosition((pos) => {
        this.updateLocation(pos.coords.latitude, pos.coords.longitude);
      });

      // Update périodique toutes les 5 minutes
      this.locationIntervalId = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          this.updateLocation(pos.coords.latitude, pos.coords.longitude);
        });
      }, 300000);
    }
  }

  updateLocation(lat: number, lng: number): void {
    this.userLocation = { latitude: lat, longitude: lng };
    this.userService.updateLocation(lat, lng).subscribe();
  }

  toggleMap(): void {
    this.showMap = !this.showMap;
    if (this.showMap) {
      this.currentView = 'feed'; // On reste sur le feed mais on superpose la carte
      setTimeout(() => this.initMap(), 100);
    }
  }

  private initMap(): void {
    if (this.map) {
      this.map.remove();
    }

    if (!this.userLocation) return;

    this.map = L.map('map-container').setView([this.userLocation.latitude, this.userLocation.longitude], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // My marker
    L.marker([this.userLocation.latitude, this.userLocation.longitude])
      .addTo(this.map)
      .bindPopup('Me (You are here)')
      .openPopup();

    // Charger les amis
    this.loadFriendsLocations();
  }

  loadFriendsLocations(): void {
    this.userService.getFriendsLocations().subscribe({
      next: (locations) => {
        this.friendsLocations = locations;
        this.friendsLocations.forEach(loc => {
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class='marker-avatar'><img src='${loc.profileImage || 'assets/avatar.png'}' style='width:30px;height:30px;border-radius:50%;border:2px solid #8b5cf6;'></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          L.marker([loc.latitude, loc.longitude], { icon })
            .addTo(this.map)
            .bindPopup(`<b>${loc.username}</b>`);
        });
      }
    });
  }

  shareMyLocation(): void {
    if (!this.selectedFriend || !this.userLocation) {
      this.messagesError = "Location not available or no friend selected";
      return;
    }

    this.messagingService.shareLocation(
      this.selectedFriend.id, 
      this.userLocation.latitude, 
      this.userLocation.longitude
    ).subscribe({
      next: (msg) => {
        this.messages.push(msg);
        this.scrollMessagesToBottom();
      },
      error: (err) => {
        console.error('Error sharing location:', err);
        this.messagesError = "Error sharing location";
      }
    });
  }

  openInGoogleMaps(coords: string): void {
    const url = `https://www.google.com/maps?q=${coords}`;
    window.open(url, '_blank');
  }

  // --- Location Picker Methods ---
  openLocationPicker(): void {
    this.showLocationPicker = true;
    this.pickedLocation = null;
    setTimeout(() => this.initPickerMap(), 100);
  }

  closeLocationPicker(): void {
    this.showLocationPicker = false;
    this.destroyPickerMap();
  }

  private destroyPickerMap(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.pickerMap) {
      this.pickerMap.remove();
      this.pickerMap = null;
    }
    this.pickerMarker = null;
    this.locationSuggestions = [];
    this.showSuggestions = false;
    this.isLoadingSuggestions = false;
    this.searchLocationError = false;
  }

  private initPickerMap(): void {
    this.destroyPickerMap();

    const initialPos = this.userLocation || { latitude: 36.8065, longitude: 10.1815 }; // Tunis par défaut
    this.pickerMap = L.map('location-picker-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([initialPos.latitude, initialPos.longitude], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.pickerMap);

    this.pickerMap.on('click', (e: L.LeafletMouseEvent) => {
      this.setPickerMarker(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => this.pickerMap?.invalidateSize(), 0);
    setTimeout(() => this.pickerMap?.invalidateSize(), 250);
  }

  private setPickerMarker(lat: number, lng: number): void {
    this.pickedLocation = { latitude: lat, longitude: lng };
    if (this.pickerMarker) {
      this.pickerMarker.setLatLng([lat, lng]);
    } else {
      this.pickerMarker = L.marker([lat, lng]).addTo(this.pickerMap);
    }
    this.pickerMap.panTo([lat, lng]);
  }

  searchLocation(query: string): void {
    if (!query || query.trim().length < 1) {
      this.locationSuggestions = [];
      this.showSuggestions = false;
      this.isLoadingSuggestions = false;
      this.searchLocationError = false;
      return;
    }

    this.isLoadingSuggestions = true;
    this.searchLocationError = false;
    const currentQuery = query;

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.geocodingService.searchLocation(query).subscribe({
        next: (suggestions) => {
          if (this.locationSearchQuery !== currentQuery) return;
          this.locationSuggestions = suggestions;
          this.showSuggestions = true;
          this.isLoadingSuggestions = false;
        },
        error: (err) => {
          if (this.locationSearchQuery !== currentQuery) return;
          this.locationSuggestions = [];
          this.searchLocationError = true;
          this.showSuggestions = true;
          this.isLoadingSuggestions = false;
        }
      });
    }, 200);
  }

  selectLocation(suggestion: LocationSuggestion): void {
    this.pickedLocation = { latitude: suggestion.lat, longitude: suggestion.lon };
    this.locationAddress = suggestion.displayName;
    this.locationSearchQuery = suggestion.displayName;
    this.locationSuggestions = [];
    this.showSuggestions = false;
    this.setPickerMarker(suggestion.lat, suggestion.lon);
  }

  closeSuggestions(): void {
    this.showSuggestions = false;
    this.locationSuggestions = [];
  }

  onLocationInputBlur(): void {
    setTimeout(() => this.closeSuggestions(), 200);
  }

  confirmPickedLocation(): void {
    if (this.pickedLocation) {
      this.postLocation = this.pickedLocation;
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.postLocation.latitude}&lon=${this.postLocation.longitude}`;
      fetch(url)
        .then(res => res.json())
        .then(data => {
          this.locationAddress = data.display_name;
        })
        .catch(() => {
          this.locationAddress = `${this.postLocation?.latitude.toFixed(2)}, ${this.postLocation?.longitude.toFixed(2)}`;
        });
      this.closeLocationPicker();
    }
  }

  closeBlockedPopup(): void {
    this.isBlockedPopupOpen = false;
    this.blockReason = '';
  }
}
