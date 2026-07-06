import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ForumPost, ForumService } from '../services/forum.service';

@Component({
  selector: 'app-forum-list',
  templateUrl: './forum-list.component.html',
  styleUrls: ['./forum-list.component.css']
})
export class ForumListComponent implements OnInit {
  posts: ForumPost[] = [];
  titre = '';
  contenu = '';
  errorMessage = '';

  constructor(private forumService: ForumService, private router: Router) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.forumService.getPosts().subscribe({
      next: (data) => {
        this.posts = data;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les posts. Verifiez votre session.';
      }
    });
  }

  createPost(): void {
    if (!this.titre.trim() || !this.contenu.trim()) return;
    this.forumService.createPost({ titre: this.titre.trim(), contenu: this.contenu.trim() }).subscribe({
      next: () => {
        this.titre = '';
        this.contenu = '';
        this.loadPosts();
      },
      error: () => {
        this.errorMessage = 'Creation du post impossible.';
      }
    });
  }

  likePost(postId: number): void {
    this.forumService.likePost(postId).subscribe({
      next: () => this.loadPosts()
    });
  }

  openPost(postId: number): void {
    this.router.navigate(['/forum/posts', postId]);
  }
}
