import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BranchDTO, CommitDTO, MergeResultResponse } from '../models/versioning';

@Injectable({
  providedIn: 'root'
})
export class VersioningService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) { }

  getBranches(startupId: number | string): Observable<BranchDTO[]> {
    return this.http.get<BranchDTO[]>(`${this.apiUrl}/branches/startup/${startupId}`);
  }

  getBranchById(branchId: string): Observable<BranchDTO> {
    return this.http.get<BranchDTO>(`${this.apiUrl}/branches/${branchId}`);
  }

  createBranch(nom: string, startupId: string, parentBranchId: string | null): Observable<BranchDTO> {
    return this.http.post<BranchDTO>(`${this.apiUrl}/branches`, { 
      nom, 
      startup_id: startupId, 
      parent_branch_id: parentBranchId 
    });
  }

  startMerge(sourceId: string, targetId: string): Observable<MergeResultResponse> {
    return this.http.post<MergeResultResponse>(`${this.apiUrl}/branches/${sourceId}/merge-into/${targetId}`, {});
  }

  resolveConflict(sessionId: string, blocName: string, choice: string, customTags?: string[]): Observable<any> {
    const body = { 
      bloc_name: blocName, 
      choice, 
      custom_tags: customTags 
    };
    return this.http.post(`${this.apiUrl}/merge/${sessionId}/resolve`, body);
  }

  finalizeMerge(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/merge/${sessionId}/finalize`, {});
  }

  getCommits(mainBranchId: string): Observable<CommitDTO[]> {
    return this.http.get<CommitDTO[]>(`${this.apiUrl}/commits/branch/${mainBranchId}`);
  }

  restoreCommit(mainBranchId: string, commitId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/branches/${mainBranchId}/restore/${commitId}`, {});
  }

  updateBranchBlock(branchId: string, blocName: string, tags: string[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/branches/${branchId}/blocs/${blocName}`, { tags });
  }

  updateBranchSnapshot(branchId: string, snapshot: { [key: string]: string[] }): Observable<any> {
    return this.http.put(`${this.apiUrl}/branches/${branchId}/snapshot`, snapshot);
  }

  getVersionHistory(startupId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/versions/startup/${startupId}`);
  }

  getVersions(startupId: number | string): Observable<any[]> {
    return this.getVersionHistory(startupId);
  }
}