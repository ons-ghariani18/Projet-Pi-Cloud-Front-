import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ForumComment, ForumPostDetails, ForumService } from '../services/forum.service';

@Component({
  selector: 'app-forum-post-detail',
  templateUrl: './forum-post-detail.component.html',
  styleUrls: ['./forum-post-detail.component.css']
})
export class ForumPostDetailComponent implements OnInit {
  details?: ForumPostDetails;
  postId = 0;
  newComment = '';
  errorMessage = '';

  constructor(private forumService: ForumService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.postId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDetails();
  }

  loadDetails(): void {
    this.forumService.getPostDetails(this.postId).subscribe({
      next: (data) => (this.details = data),
      error: () => (this.errorMessage = 'Chargement du post impossible.')
    });
  }

  addComment(): void {
    if (!this.newComment.trim()) return;
    this.forumService.addComment(this.postId, this.newComment.trim()).subscribe({
      next: () => {
        this.newComment = '';
        this.loadDetails();
      }
    });
  }

  likeComment(commentId: number): void {
    this.forumService.likeComment(commentId).subscribe({
      next: () => this.loadDetails()
    });
  }

  deleteComment(commentId: number): void {
    this.forumService.deleteComment(commentId).subscribe({
      next: () => this.loadDetails()
    });
  }

  back(): void {
    this.router.navigate(['/forum']);
  }

  trackComment(_: number, c: ForumComment): number {
    return c.id;
  }
}
