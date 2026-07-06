import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { ForumService } from '../services/forum.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  currentView: 'users' | 'posts' | 'stats' = 'posts';
  currentUsername: string = 'Ahmed Manssouri';
  users: any[] = [];
  posts: any[] = [];
  usersError: string = '';
  postsError: string = '';
  selectedPost: any = null;
  selectedUser: any = null;
  showComments: boolean = false;
  showUserFriends: boolean = false;
  showCreateUserForm: boolean = false;

  // User creation form
  newUser: any = {
    username: '',
    email: '',
    password: ''
  };
  createUserError: string = '';
  createUserSuccess: string = '';

  // Statistics
  loginStats: any = [];
  registrationStats: any = [];
  statsError: string = '';

  constructor(
    private adminService: AdminService,
    private forumService: ForumService,
    private sanitizer: DomSanitizer,
    private router: Router
  ) {}

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('roles');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    this.router.navigate(['/signin']);
  }

  getSafeUrl(url: string): any {
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit(): void {
    this.currentUsername = this.getCurrentUsername();
    this.loadPosts();
  }

  getCurrentUsername(): string {
    const token = localStorage.getItem('token');
    if (!token) return 'Ahmed Manssouri';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.username || 'Ahmed Manssouri';
    } catch (e) {
      return 'Ahmed Manssouri';
    }
  }

  // Navigation to statistics
  goToStats(): void {
    this.currentView = 'stats';
    this.loadStats();
  }

  // Load statistics
  loadStats(): void {
    this.adminService.getLoginStats().subscribe({
      next: (data) => {
        this.loginStats = data;
      },
      error: (err) => {
        console.error('Error loading login statistics:', err);
        this.statsError = 'Error loading statistics';
      }
    });

    this.adminService.getRegistrationStats().subscribe({
      next: (data) => {
        this.registrationStats = data;
      },
      error: (err) => {
        console.error('Error loading registration statistics:', err);
      }
    });
  }

  loadUsers(): void {
    this.adminService.getAllUsers().subscribe({
      next: (data) => {
        // Filter to hide admins from the list
        this.users = data.filter(user => {
          const roles = user.roles || [];
          return !roles.some((role: any) => role.name === 'ROLE_ADMIN' || role === 'ROLE_ADMIN');
        });
        // Load friends for each user
        this.users.forEach(user => {
          this.adminService.getUserFriends(user.id).subscribe({
            next: (friends) => {
              user.friends = friends;
            },
            error: (err) => {
              console.error('Error loading friends:', err);
              user.friends = [];
            }
          });
        });
        this.usersError = '';
      },
      error: (err) => {
        this.usersError = 'Error loading users';
        console.error(err);
      }
    });
  }

  loadPosts(): void {
    this.adminService.getAllPostsWithDetails().subscribe({
      next: (data) => {
        this.posts = data;
        console.log('Admin Posts Loaded:', this.posts.length);
        if (this.posts.length > 0) {
          console.log('Sample mediaUrl:', this.posts[0].mediaUrl?.substring(0, 50));
        }
        this.posts.forEach(post => {
          this.forumService.getPostComments(post.id).subscribe({
            next: (comments) => {
              post.comments = comments;
            },
            error: (err) => {
              console.error('Error loading comments:', err);
              post.comments = [];
            }
          });

          // Load reactions for each post
          this.adminService.getPostLikes(post.id).subscribe({
            next: (likes) => {
              post.likeCount = likes;
            },
            error: (err) => {
              console.error('Error loading likes:', err);
              post.likeCount = 0;
            }
          });

          this.adminService.getPostDislikes(post.id).subscribe({
            next: (dislikes) => {
              post.dislikeCount = dislikes;
            },
            error: (err) => {
              console.error('Error loading dislikes:', err);
              post.dislikeCount = 0;
            }
          });

          this.adminService.getPostLoves(post.id).subscribe({
            next: (loves) => {
              post.loveCount = loves;
            },
            error: (err) => {
              console.error('Error loading loves:', err);
              post.loveCount = 0;
            }
          });
        });
        this.postsError = '';
      },
      error: (err) => {
        this.postsError = 'Error loading posts';
        console.error(err);
      }
    });
  }

  goToUsers(): void {
    this.currentView = 'users';
    this.loadUsers();
  }

  goToPosts(): void {
    this.currentView = 'posts';
    this.loadPosts();
  }

  toggleUserFriends(user: any): void {
    if (this.selectedUser === user) {
      this.showUserFriends = !this.showUserFriends;
    } else {
      this.selectedUser = user;
      this.showUserFriends = true;
    }
  }

  togglePostComments(post: any): void {
    if (this.selectedPost === post) {
      this.showComments = !this.showComments;
    } else {
      this.selectedPost = post;
      this.showComments = true;
    }
  }

  deletePost(postId: number): void {
    if (confirm('Are you sure you want to delete this post?')) {
      this.adminService.deletePost(postId).subscribe({
        next: () => {
          this.posts = this.posts.filter(p => p.id !== postId);
          if (this.selectedPost && this.selectedPost.id === postId) {
            this.selectedPost = null;
            this.showComments = false;
          }
        },
        error: (err) => {
          console.error('Error deleting post:', err);
          alert('Error deleting post');
        }
      });
    }
  }

  getPostReactionCounts(post: any): { like: number; dislike: number; love: number } {
    return {
      like: post.likeCount || 0,
      dislike: post.dislikeCount || 0,
      love: post.loveCount || 0
    };
  }

  getCommentReactionCounts(comment: any): { like: number } {
    return { like: comment.likeCount || 0 };
  }

  // Create a user
  toggleCreateUserForm(): void {
    this.showCreateUserForm = !this.showCreateUserForm;
    this.createUserError = '';
    this.createUserSuccess = '';
    this.newUser = { username: '', email: '', password: '' };
  }

  createUser(): void {
    if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
      this.createUserError = 'All fields are required';
      return;
    }

    this.adminService.createUser(this.newUser).subscribe({
      next: () => {
        this.createUserSuccess = 'User created successfully';
        this.createUserError = '';
        this.newUser = { username: '', email: '', password: '' };
        this.showCreateUserForm = false;
        this.loadUsers();
        setTimeout(() => {
          this.createUserSuccess = '';
        }, 3000);
      },
      error: (err) => {
        this.createUserError = 'Error creating user';
        console.error(err);
      }
    });
  }

  // Block a user
  blockUser(userId: number): void {
    if (confirm('Are you sure you want to block this user?')) {
      this.adminService.blockUser(userId).subscribe({
        next: () => {
          const user = this.users.find(u => u.id === userId);
          if (user) user.blocked = true;
        },
        error: (err) => {
          console.error('Error blocking user:', err);
          alert('Error blocking user');
        }
      });
    }
  }

  // Unblock a user
  unblockUser(userId: number): void {
    if (confirm('Are you sure you want to unblock this user?')) {
      this.adminService.unblockUser(userId).subscribe({
        next: () => {
          const user = this.users.find(u => u.id === userId);
          if (user) user.blocked = false;
        },
        error: (err) => {
          console.error('Error unblocking user:', err);
          alert('Error unblocking user');
        }
      });
    }
  }

  // Statistics helper methods
  getMaxCount(stats: any[]): number {
    if (!stats || stats.length === 0) return 1;
    return Math.max(...stats.map(s => s.count || 0), 1);
  }

  getTotalCount(stats: any[]): number {
    if (!stats || stats.length === 0) return 0;
    return stats.reduce((sum, s) => sum + (s.count || 0), 0);
  }

  // ─── SVG Chart helpers ───────────────────────────────────────────────────
  private readonly CHART_PADDING_LEFT = 60;
  private readonly CHART_PADDING_RIGHT = 40;
  private readonly CHART_TOP = 30;
  private readonly CHART_BOTTOM = 210; // x-axis y position
  private readonly POINT_SPACING = 80;

  getSvgWidth(stats: any[]): number {
    const minWidth = 800; // Minimum width for readability
    if (!stats || stats.length < 2) return minWidth;
    return Math.max(minWidth, this.CHART_PADDING_LEFT + this.CHART_PADDING_RIGHT + (stats.length - 1) * this.POINT_SPACING);
  }

  getPointX(index: number, stats: any[]): number {
    const usable = this.getSvgWidth(stats) - this.CHART_PADDING_LEFT - this.CHART_PADDING_RIGHT;
    if (stats.length < 2) return this.CHART_PADDING_LEFT + usable / 2;
    return this.CHART_PADDING_LEFT + (index / (stats.length - 1)) * usable;
  }

  getPointY(count: number, stats: any[]): number {
    const max = this.getMaxCount(stats);
    const ratio = max === 0 ? 0 : count / max;
    return this.CHART_BOTTOM - ratio * (this.CHART_BOTTOM - this.CHART_TOP);
  }

  /** mapY : converts a percentage (0-100) to SVG coordinate for gridlines */
  mapY(pct: number, stats: any[]): number {
    return this.CHART_BOTTOM - (pct / 100) * (this.CHART_BOTTOM - this.CHART_TOP);
  }

  getLinePoints(stats: any[]): string {
    if (!stats || stats.length === 0) return '';
    return stats.map((s, i) =>
      `${this.getPointX(i, stats)},${this.getPointY(s.count, stats)}`
    ).join(' ');
  }

  getAreaPoints(stats: any[]): string {
    if (!stats || stats.length === 0) return '';
    const linePoints = stats.map((s, i) =>
      `${this.getPointX(i, stats)},${this.getPointY(s.count, stats)}`
    ).join(' ');
    const lastX = this.getPointX(stats.length - 1, stats);
    const firstX = this.getPointX(0, stats);
    return `${firstX},${this.CHART_BOTTOM} ${linePoints} ${lastX},${this.CHART_BOTTOM}`;
  }

  getYLabels(stats: any[]): number[] {
    const max = this.getMaxCount(stats);
    if (max === 0) return [0];
    const steps = 4;
    const labels = new Set<number>();
    for (let i = 0; i <= steps; i++) {
      labels.add(Math.round((max / steps) * i));
    }
    return Array.from(labels).sort((a, b) => a - b);
  }

  /** Show X labels every N points to avoid overload */
  shouldShowLabel(index: number, stats: any[]): boolean {
    if (stats.length <= 10) return true;
    const step = Math.ceil(stats.length / 10);
    return index % step === 0 || index === stats.length - 1;
  }

  // ─── Export PDF ─────────────────────────────────────────────────────────
  exportToPDF(): void {
    const data = document.getElementById('stats-to-export');
    if (!data) return;

    const exportBtn = document.querySelector('.export-pdf-btn') as HTMLElement;
    if (exportBtn) exportBtn.style.display = 'none';

    html2canvas(data, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#f5f6fa'
    }).then(canvas => {
      const imgWidth = 208;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const contentDataURL = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add a custom title to the PDF
      pdf.setFontSize(20);
      pdf.setTextColor(30, 41, 59);
      pdf.text('FlexBidaya Activity Report', 105, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated on ${new Date().toLocaleString()}`, 105, 22, { align: 'center' });

      pdf.addImage(contentDataURL, 'PNG', 1, 30, imgWidth, imgHeight);
      
      const fileName = `flexbidaya_stats_${new Date().getTime()}.pdf`;
      pdf.save(fileName);
      
      if (exportBtn) exportBtn.style.display = 'flex';
    }).catch(err => {
      console.error('PDF Error:', err);
      if (exportBtn) exportBtn.style.display = 'flex';
    });
  }
}
