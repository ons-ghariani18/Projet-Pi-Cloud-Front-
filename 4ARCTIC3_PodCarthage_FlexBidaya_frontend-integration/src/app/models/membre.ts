export interface Membre {
  id?: number;
  nomPrenom: string;
  role: string;
  email: string;
  statutMembre: string;
}

export interface InviteMembreRequest {
  nomPrenom: string;
  email: string;
  role: string;
  statutMembre: string;
}

export interface ProposeRequest {
  token: string;
  blockName: string;
  oldValue: string;
  newValue: string;
}

export interface BmcProposal {
  id: number;
  blockName: string;
  oldValue: string;
  newValue: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  member?: Membre;
}
