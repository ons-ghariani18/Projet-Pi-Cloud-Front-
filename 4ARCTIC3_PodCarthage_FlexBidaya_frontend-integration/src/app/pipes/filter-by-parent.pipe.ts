import { Pipe, PipeTransform } from '@angular/core';
import { ForumComment } from '../services/forum.service';

@Pipe({
  name: 'filterByParent'
})
export class FilterByParentPipe implements PipeTransform {
  transform(comments: ForumComment[], parentId: number): ForumComment[] {
    if (!comments || !parentId) {
      return [];
    }
    return comments.filter(comment => comment.parentCommentId === parentId);
  }
}
