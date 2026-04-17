import { Membre } from './membre';
import { Credit } from './credit';

export interface Startup {
  id?: number;
  nom: string;          // Backend uses 'nom'
  description: string;
  secteur: string;      // Backend uses 'secteur'
  stade: string;        // Backend uses 'stade'
  dateCreation: string; // Backend uses 'dateCreation'
  typeClient: string;   // Backend uses 'typeClient'
  mrr: number;
  budgetInitial: number; // Backend uses 'budgetInitial'
  membres?: Membre[];    // Backend uses 'membres'
  credits?: Credit[];    // Backend uses 'credits' (List)
  statut?: string;       // Backend uses 'statut' (Active, Archived, etc.)

  
  // UI ONLY FIELDS (augmented by service)
  sub?: string;
  dates?: string;
  status?: string;      // UI status (Approved, Pending, Rejected)
}
