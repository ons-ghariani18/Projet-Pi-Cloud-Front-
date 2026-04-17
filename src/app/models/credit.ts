export interface Credit {
  id?: number;
  montant: number;
  tauxInteret: number; // Backend uses 'tauxInteret'
  dureeMois: number;   // Backend uses 'dureeMois'
  source: string;
}
