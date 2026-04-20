import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProposeRequest, BmcProposal } from '../models/membre';

export interface BusinessPlanDTO {
  id?: number;
  startupId: number;
  partenairesCles: string;
  activitesCles: string;
  ressourcesCles: string;
  propositionValeurs: string;
  relationsClients: string;
  canauxDistribution: string;
  segmentsClients: string;
  structuresCouts: string;
  fluxRevenus: string;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessPlanService {
  private apiUrl = 'http://localhost:8080/api/bmc';

  constructor(private http: HttpClient) { }

  // Join via Magic Link (Returns Member Info)
  joinByToken(token: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/join?token=${token}`);
  }

  // Get BMC Content via Token
  getBmcByToken(token: string): Observable<BusinessPlanDTO> {
    return this.http.get<BusinessPlanDTO>(`${this.apiUrl}/view?token=${token}`);
  }

  getProposalsByToken(token: string): Observable<BmcProposal[]> {
    return this.http.get<BmcProposal[]>(`${this.apiUrl}/proposals?token=${token}`);
  }

  getByToken(token: string): Observable<BusinessPlanDTO> {
    return this.getBmcByToken(token);
  }

  create(dto: any): Observable<BusinessPlanDTO> {
    return this.http.post<BusinessPlanDTO>(this.apiUrl.replace('/bmc', '/business-plans'), dto);
  }

  update(id: number, dto: any): Observable<BusinessPlanDTO> {
    return this.http.put<BusinessPlanDTO>(`${this.apiUrl.replace('/bmc', '/business-plans')}/${id}`, dto);
  }

  // Member Proposals (Public)
  proposeChange(request: ProposeRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/propose`, request);
  }

  // Admin Review (Protected)
  getPendingProposals(startupId: number): Observable<BmcProposal[]> {
    return this.http.get<BmcProposal[]>(`${this.apiUrl}/proposals/${startupId}/pending`);
  }

  getProposals(startupId: number): Observable<BmcProposal[]> {
    return this.getPendingProposals(startupId);
  }

  getAllProposals(startupId: number): Observable<BmcProposal[]> {
    return this.http.get<BmcProposal[]>(`${this.apiUrl}/proposals/${startupId}/all`);
  }

  approveProposal(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/proposals/${id}/approve`, {});
  }

  rejectProposal(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/proposals/${id}/reject`, {});
  }

  reviewProposal(proposalId: number, status: 'APPROVED' | 'REJECTED'): Observable<any> {
    return status === 'APPROVED' ? this.approveProposal(proposalId) : this.rejectProposal(proposalId);
  }


  // BMC Data (Compatibility)
  getByStartupId(startupId: number): Observable<BusinessPlanDTO[]> {
    return this.http.get<BusinessPlanDTO[]>(`http://localhost:8080/api/business-plans/startup/${startupId}`);
  }
}

