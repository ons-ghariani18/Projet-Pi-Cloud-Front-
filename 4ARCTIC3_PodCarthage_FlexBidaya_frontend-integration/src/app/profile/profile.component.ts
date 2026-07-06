import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { ForumService, ForumPost, ForumComment } from '../services/forum.service';
import { ReactionService } from '../services/reaction.service';
import { FriendshipService, UserSummary } from '../services/friendship.service';
import { NotificationService, AppNotification } from '../services/notification.service';
import { MessagingService, MessageDTO } from '../services/messaging.service';
import { EditProfileData } from './edit-profile/edit-profile.component';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface UserProfile {
  id: number;
  username: string;
  roles: string[];
  email?: string;
  bio?: string;
  profileImage?: string;
}

interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUser: UserProfile | null = null;
  userPosts: ForumPost[] = [];
  notifications: AppNotification[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  notificationsError: string = '';
  private refreshTimerId: number | null = null;
  userStats: UserStats = {
    totalPosts: 0,
    totalComments: 0,
    totalLikes: 0
  };
  loading: boolean = true;
  error: string = '';
  showEditProfile: boolean = false;
  isOwnProfile: boolean = true;
  profileUserId: number | null = null;
  friendIds = new Set<number>();
  invitationSent: boolean = false;

  // Chat Logic
  showChat: boolean = false;
  messages: MessageDTO[] = [];
  newMessage: string = '';
  isSendingMessage: boolean = false;
  messagesError: string = '';
  private readonly backendBaseUrl = 'http://localhost:8080';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private forumService: ForumService,
    private reactionService: ReactionService,
    private notificationService: NotificationService,
    private friendshipService: FriendshipService,
    private messagingService: MessagingService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.profileUserId = +id;
        this.checkIfOwnProfile();
      } else {
        this.isOwnProfile = true;
        this.profileUserId = null;
      }
      
      this.loadCurrentUser(); // Load "Me" for reactions etc.
      this.loadProfileData();
      this.loadUserStats();
      this.loadUnreadNotificationCount();
      this.loadFriends();
    });
    this.startRefreshLoop();
  }

  private loadFriends(): void {
    this.friendshipService.getFriends().subscribe({
      next: (friends: UserSummary[]) => {
        this.friendIds = new Set(friends.map(f => f.id));
      },
      error: (err) => console.error('Error loading friends:', err)
    });
  }

  isFriend(): boolean {
    return this.profileUserId ? this.friendIds.has(this.profileUserId) : false;
  }

  sendInvite(): void {
    if (!this.profileUserId) return;
    this.friendshipService.sendFriendRequest(this.profileUserId).subscribe({
      next: () => {
        this.invitationSent = true;
      },
      error: (err) => console.error('Error sending invite:', err)
    });
  }

  removeFriend(): void {
    if (!this.profileUserId) return;
    if (confirm('Are you sure you want to remove this friend?')) {
      this.friendshipService.removeFriend(this.profileUserId).subscribe({
        next: () => {
          this.friendIds.delete(this.profileUserId!);
        },
        error: (err) => console.error('Error removing friend:', err)
      });
    }
  }

  goToChat(): void {
    if (!this.profileUserId || !this.currentUser) return;
    this.showChat = true;
    this.messages = [];
    this.newMessage = '';
    this.messagesError = '';
    this.loadConversation(this.profileUserId);
  }

  closeChat(): void {
    this.showChat = false;
  }

  private loadConversation(friendId: number): void {
    this.messagingService.getConversation(friendId).subscribe({
      next: (messages: MessageDTO[]) => {
        this.messages = messages;
        setTimeout(() => this.scrollMessagesToBottom(), 100);
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.messagesError = 'Error loading conversation';
      }
    });
  }

  sendMessage(): void {
    if (!this.profileUserId || !this.newMessage.trim() || this.isSendingMessage) return;

    this.isSendingMessage = true;
    this.messagingService.sendMessage(this.profileUserId, this.newMessage.trim()).subscribe({
      next: (message: MessageDTO) => {
        this.messages.push(message);
        this.newMessage = '';
        this.isSendingMessage = false;
        setTimeout(() => this.scrollMessagesToBottom(), 50);
      },
      error: (error) => {
        console.error('Error sending message:', error);
        this.isSendingMessage = false;
        this.messagesError = 'Error sending message';
      }
    });
  }

  private scrollMessagesToBottom(): void {
    const container = document.querySelector('.chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  isImageMessage(message: MessageDTO): boolean {
    return !!message.mediaType && message.mediaType.startsWith('image/');
  }

  isVideoMessage(message: MessageDTO): boolean {
    return !!message.mediaType && message.mediaType.startsWith('video/');
  }

  isAudioMessage(message: MessageDTO): boolean {
    return !!message.mediaType && message.mediaType.startsWith('audio/');
  }

  private checkIfOwnProfile(): void {
    const myId = localStorage.getItem('userId');
    if (myId && this.profileUserId) {
      this.isOwnProfile = (+myId === this.profileUserId);
    }
  }

  private loadProfileData(): void {
    if (this.isOwnProfile || !this.profileUserId) {
      this.loadMyProfile();
    } else {
      this.loadExternalProfile(this.profileUserId);
    }
  }

  private loadMyProfile(): void {
    this.userService.getMyProfile().subscribe({
      next: (user: UserProfile) => {
        this.currentUser = this.normalizeUserProfile(user);
        this.loadUserPostsForProfile(user.id);
        this.loading = false;
      },
      error: (err) => this.handleProfileError(err)
    });
  }

  private loadExternalProfile(id: number): void {
    this.userService.getUserById(id).subscribe({
      next: (user: UserProfile) => {
        this.currentUser = this.normalizeUserProfile(user);
        this.loadUserPostsForProfile(user.id);
        this.loading = false;
      },
      error: (err) => this.handleProfileError(err)
    });
  }

  private handleProfileError(error: any): void {
    console.error('Error loading profile:', error);
    this.loading = false;
    this.error = 'Error loading profile';
    if (error.status === 401) {
      this.error = 'Session expired. Please log in again.';
      setTimeout(() => window.location.href = '/signin', 2000);
    }
  }

  private loadUserPostsForProfile(userId: number): void {
    this.forumService.getPosts().subscribe({
      next: (posts: ForumPost[]) => {
        this.userPosts = posts
          .filter(post => post.userId === userId)
          .map(post => this.normalizeForumPost(post));
        this.userPosts.forEach(post => {
          this.loadPostReaction(post);
          this.loadCommentsForPost(post);
        });
        this.recalculateUserStats();
      },
      error: (err) => console.error('Error loading posts:', err)
    });
  }

  private loadCommentsForPost(post: ForumPost): void {
    this.forumService.getPostComments(post.id).subscribe({
      next: (comments: ForumComment[]) => {
        post.comments = this.getOrganizedComments(comments);
        this.recalculateUserStats();
      },
      error: (err) => console.error('Error loading comments:', err)
    });
  }

  private loadCurrentUser(): void {
    this.userService.getMyProfile().subscribe({
      next: (user: UserProfile) => {
        // Stored if needed for business logic
      },
      error: (err) => console.error('Error loading current user:', err)
    });
  }

  openInGoogleMaps(coordinates: string): void {
    window.open(`https://www.google.com/maps/search/?api=1&query=${coordinates}`, '_blank');
  }

  loadUserStats(): void {
    this.recalculateUserStats();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAvatarLetter(username?: string): string {
    if (!username || username.length === 0) {
      return 'U';
    }
    return username.charAt(0).toUpperCase();
  }

  editProfile(): void {
    this.showEditProfile = true;
  }

  onProfileUpdated(updatedData: EditProfileData): void {
    // Update local data
    if (this.currentUser) {
      this.currentUser.username = updatedData.username;
      this.currentUser.profileImage = this.normalizeAssetUrl(updatedData.profileImage);
    }
    
    // Reload data to ensure everything is up to date
    this.loadProfileData();
    this.loadUserStats();
    this.loadUnreadNotificationCount();
  }

  closeEditProfile(): void {
    this.showEditProfile = false;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  formatRoles(roles: any[] | undefined): string {
    if (!roles || roles.length === 0) return 'User';
    return roles.map(r => {
      let roleName = typeof r === 'string' ? r : (r.name || 'User');
      return roleName.replace('ROLE_', '');
    }).join(', ');
  }

  ngOnDestroy(): void {
    if (this.refreshTimerId !== null) {
      window.clearInterval(this.refreshTimerId);
    }
  }

  // Methods for notifications
  viewNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
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

  loadUnreadNotificationCount(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadNotificationCount = response.unreadCount;
      },
      error: (error: any) => {
        console.error('Error loading notification count:', error);
      }
    });
  }

  markNotificationAsRead(notificationId: number): void {
    this.notificationService.markAsRead(notificationId).subscribe({
      next: () => {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
          this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
        }
      },
      error: (error: any) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllNotificationsAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.read = true);
        this.unreadNotificationCount = 0;
      },
      error: (error: any) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'MESSAGE_RECEIVED': return '💬';
      case 'POST_REACTION': return '❤️';
      case 'COMMENT_REACTION': return '💬';
      case 'POST_SHARED': return '📤';
      default: return '🔔';
    }
  }

  private startRefreshLoop(): void {
    if (this.refreshTimerId !== null) {
      window.clearInterval(this.refreshTimerId);
    }

    this.refreshTimerId = window.setInterval(() => {
      this.loadUnreadNotificationCount();
      if (this.showNotifications) {
        this.loadNotifications();
      }
    }, 15000);
  }

  // Methods for likes
  reactToPost(postId: number, reactionType: string): void {
    const post = this.userPosts.find(p => p.id === postId);
    if (!post) return;

    if (post.userReaction === undefined) {
      this.loadPostReaction(post, (resolvedReaction) => {
        this.submitPostReaction(post, reactionType, resolvedReaction);
      });
      return;
    }

    const oldReaction = post.userReaction ?? null;
    this.submitPostReaction(post, reactionType, oldReaction);
  }

  private loadPostReaction(post: ForumPost, onLoaded?: (reactionType: string | null) => void): void {
    this.reactionService.getMyPostReaction(post.id).subscribe({
      next: (reaction: any) => {
        const reactionType = reaction?.type ?? null;
        post.userReaction = reactionType;
        onLoaded?.(reactionType);
      },
      error: (error: any) => {
        console.error('Error loading post reaction:', error);
        post.userReaction = null;
        onLoaded?.(null);
      }
    });
  }

  private submitPostReaction(post: ForumPost, reactionType: string, oldReaction: string | null): void {
    this.reactionService.reactToPost(post.id, reactionType).subscribe({
      next: (reaction: any) => {
        this.hideReactionMenu();

        if (reaction === null) {
          if (oldReaction) {
            this.decrementReactionCount(post, oldReaction);
          }
          post.userReaction = null;
          return;
        }

        const newReactionType = reaction.type;

        if (oldReaction && oldReaction !== newReactionType) {
          this.decrementReactionCount(post, oldReaction);
        }

        if (!oldReaction || oldReaction !== newReactionType) {
          this.incrementReactionCount(post, newReactionType);
        }

        post.userReaction = newReactionType;
      },
      error: (error: any) => {
        console.error('Error reacting to post:', error);
      }
    });
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

  // Methods for comments
  openComments(postId: number): void {
    const post = this.userPosts.find(p => p.id === postId);
    if (!post) return;

    post.showComments = !post.showComments;

    if (post.showComments && !post.comments) {
      this.loadPostComments(postId);
    }
  }

  loadPostComments(postId: number): void {
    this.forumService.getPostComments(postId).subscribe({
      next: (comments: ForumComment[]) => {
        const post = this.userPosts.find(p => p.id === postId);
        if (post) {
          post.comments = this.getOrganizedComments(comments);
          this.loadUserReactionsForPost(postId);
          this.recalculateUserStats();
        }
      },
      error: (error: any) => {
        console.error('Error loading comments:', error);
      }
    });
  }

  // Organize comments hierarchically
  getOrganizedComments(comments: ForumComment[]): ForumComment[] {
    if (!comments || comments.length === 0) {
      return [];
    }

    const topLevelComments: ForumComment[] = [];
    const repliesMap: { [key: number]: ForumComment[] } = {};

    // Separate top-level comments and replies
    comments.forEach(comment => {
      if (comment.parentCommentId) {
        if (!repliesMap[comment.parentCommentId]) {
          repliesMap[comment.parentCommentId] = [];
        }
        repliesMap[comment.parentCommentId].push(comment);
      } else {
        topLevelComments.push(comment);
      }
    });

    // Recursive function to nest replies
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

  loadUserReactionsForPost(postId: number): void {
    const post = this.userPosts.find(p => p.id === postId);
    if (!post || !post.comments) return;

    // Recursive function to load reactions
    const loadReactionsRecursively = (comments: ForumComment[]) => {
      comments.forEach(comment => {
        this.reactionService.getMyCommentReaction(comment.id).subscribe({
          next: (reaction: any) => {
            comment.userReaction = reaction ? reaction.type : null;
          },
          error: (error: any) => {
            console.error('Error loading comment reaction:', error);
          }
        });

        // Load reactions for nested replies
        if ((comment as any).replies) {
          loadReactionsRecursively((comment as any).replies);
        }
      });
    };

    loadReactionsRecursively(post.comments);
  }

  addComment(postId: number, contenu: string): void {
    if (!contenu.trim()) return;

    this.forumService.addComment(postId, contenu).subscribe({
      next: (comment: ForumComment) => {
        const post = this.userPosts.find(p => p.id === postId);
        if (post) {
          if (!post.comments) {
            post.comments = [];
          }
          post.comments.push(comment);
          this.newCommentContent[postId] = '';
        }
      },
      error: (error: any) => {
        console.error('Error adding comment:', error);
      }
    });
  }

  reactToComment(commentId: number, reactionType: string): void {
    // Recursive function to find the comment in the hierarchy
    const findAndUpdateComment = (comments: ForumComment[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          const oldReaction = comment.userReaction;

          // If same reaction, toggle (remove)
          if (oldReaction === reactionType) {
            this.reactionService.reactToComment(commentId, reactionType).subscribe({
              next: (reaction: any) => {
                comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1);
                comment.userReaction = null;
              },
              error: (error: any) => {
                console.error('Error reacting to comment:', error);
              }
            });
          } else {
            // Add or change reaction
            this.reactionService.reactToComment(commentId, reactionType).subscribe({
              next: (reaction: any) => {
                if (oldReaction) {
                  comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1);
                }
                if (reaction !== null) {
                  comment.likeCount = (comment.likeCount || 0) + 1;
                  comment.userReaction = reactionType;
                }
              },
              error: (error: any) => {
                console.error('Error reacting to comment:', error);
              }
            });
          }
          return true;
        }

        // Search in nested replies
        if ((comment as any).replies) {
          if (findAndUpdateComment((comment as any).replies)) {
            return true;
          }
        }
      }
      return false;
    };

    // Search in all posts
    for (const post of this.userPosts) {
      if (post.comments) {
        if (findAndUpdateComment(post.comments)) {
          break;
        }
      }
    }
  }

  // Content for new comment
  newCommentContent: { [postId: number]: string } = {};

  // Reaction menu variables
  reactionMenuPostId: number | null = null;
  showReactionMenuFlag: boolean = false;

  // Variables for comment replies
  showReplyForm: number | null = null;
  replyContent: { [commentId: number]: string } = {};

  // Reaction menu methods
  toggleReactionMenu(postId: number): void {
    if (this.reactionMenuPostId === postId) {
      this.reactionMenuPostId = null;
      this.showReactionMenuFlag = false;
    } else {
      this.reactionMenuPostId = postId;
      this.showReactionMenuFlag = true;
    }
  }

  showReactionMenu(postId: number): void {
    this.reactionMenuPostId = postId;
    this.showReactionMenuFlag = true;
  }

  hideReactionMenu(): void {
    this.showReactionMenuFlag = false;
  }

  // Comment reply methods
  toggleReplyForm(commentId: number): void {
    this.showReplyForm = this.showReplyForm === commentId ? null : commentId;
  }

  cancelReply(commentId: number): void {
    this.showReplyForm = null;
    this.replyContent[commentId] = '';
  }

  replyToComment(parentCommentId: number): void {
    const content = this.replyContent[parentCommentId];
    if (!content || !content.trim()) return;

    this.forumService.replyToComment(parentCommentId, content).subscribe({
      next: (newReply: ForumComment) => {
        // Recursive function to find the parent comment
        const findAndAddReply = (comments: ForumComment[]): boolean => {
          for (const comment of comments) {
            if (comment.id === parentCommentId) {
              if (!comment.replies) {
                comment.replies = [];
              }
              comment.replies.push(newReply);
              return true;
            }

            // Search in nested replies
            if ((comment as any).replies) {
              if (findAndAddReply((comment as any).replies)) {
                return true;
              }
            }
          }
          return false;
        };

        // Search in all posts
        for (const post of this.userPosts) {
          if (post.comments) {
            if (findAndAddReply(post.comments)) {
              this.replyContent[parentCommentId] = '';
              this.showReplyForm = null;
              break;
            }
          }
        }
      },
      error: (error: any) => {
        console.error('Error replying to comment:', error);
      }
    });
  }

  // Reaction emoji method
  getReactionEmoji(type: string | null | undefined): string {
    switch (type) {
      case 'LIKE': return '👍';
      case 'DISLIKE': return '👎';
      case 'LOVE': return '❤️';
      default: return '👍';
    }
  }

  // Total reaction count method
  getTotalReactionCount(post: ForumPost): string {
    const total = (post.likeCount || 0) + (post.dislikeCount || 0) + (post.loveCount || 0);
    return total.toString();
  }

  private normalizeUserProfile(user: UserProfile): UserProfile {
    return {
      ...user,
      profileImage: this.normalizeAssetUrl(user.profileImage)
    };
  }

  private normalizeForumPost(post: ForumPost): ForumPost {
    return {
      ...post,
      mediaUrl: this.normalizeAssetUrl(post.mediaUrl),
      userProfileImage: this.normalizeAssetUrl(post.userProfileImage)
    };
  }

  private normalizeAssetUrl(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    if (value.startsWith('/uploads/')) {
      return `${this.backendBaseUrl}/api/files${value}`;
    }

    if (value.startsWith('/')) {
      return `${this.backendBaseUrl}${value}`;
    }

    return value;
  }

  private recalculateUserStats(): void {
    const totalPosts = this.userPosts.length;
    const totalComments = this.userPosts.reduce((sum, post) => sum + this.countComments(post.comments), 0);
    const totalLikes = this.userPosts.reduce(
      (sum, post) => sum + (post.likeCount || 0) + (post.loveCount || 0),
      0
    );

    this.userStats = {
      totalPosts,
      totalComments,
      totalLikes
    };
  }

  private countComments(comments?: ForumComment[]): number {
    if (!comments || comments.length === 0) {
      return 0;
    }

    return comments.reduce((sum, comment) => sum + 1 + this.countComments(comment.replies), 0);
  }
}
