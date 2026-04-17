export interface Membre {
  id?: number;
  nomPrenom: string;    // Backend uses 'nomPrenom'
  role: string;
  email: string;
  statutMembre: string; // Backend uses 'statutMembre'
}
